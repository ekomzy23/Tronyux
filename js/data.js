/* ============================================================
   RONYX · data.js
   Frontend data layer. Talks to Appwrite Databases.

   Load order on pages that need data:
     <script src="https://cdn.jsdelivr.net/npm/appwrite@16.0.2"></script>
     <script src="/js/config.js"></script>
     <script src="/js/appwrite.js"></script>
     <script src="/js/data.js"></script>

   If the backend isn't configured, functions return empty/safe
   values so pages never crash.
   ============================================================ */

(function () {
  const cfg = window.RONYX_CONFIG || { CONFIGURED: false };

  let databases = null, storage = null, Query = null, IDref = null, Perm = null, RoleRef = null;
  if (cfg.CONFIGURED && window.Appwrite) {
    const client = new Appwrite.Client().setEndpoint(cfg.ENDPOINT).setProject(cfg.PROJECT_ID);
    databases = new Appwrite.Databases(client);
    storage   = new Appwrite.Storage(client);
    Query = Appwrite.Query; IDref = Appwrite.ID; Perm = Appwrite.Permission; RoleRef = Appwrite.Role;
  }
  const DB = cfg.DATABASE_ID;
  const C  = cfg.COLLECTIONS || {};

  function ownerPerms(uid) {
    return [Perm.read(RoleRef.user(uid)), Perm.update(RoleRef.user(uid)), Perm.delete(RoleRef.user(uid))];
  }
  async function currentUser() {
    if (!cfg.CONFIGURED || !window.account) return null;
    try { return await window.account.get(); } catch { return null; }
  }

  /* ---- PROFILE (level lives here) ---- */
  async function getProfile() {
    if (!databases) return null;
    const u = await currentUser(); if (!u) return null;
    try {
      return await databases.getDocument(DB, C.users, u.$id);
    } catch (e) {
      // create profile on first login — pull signup data from sessionStorage if present
      const dept  = sessionStorage.getItem('ronyx_department') || '';
      const level = parseInt(sessionStorage.getItem('ronyx_level') || '1') || 1;
      sessionStorage.removeItem('ronyx_department');
      sessionStorage.removeItem('ronyx_level');
      sessionStorage.removeItem('ronyx_name');
      try {
        const perms = [
          Perm.read(RoleRef.users()),           // admin can read all profiles
          Perm.update(RoleRef.user(u.$id)),
          Perm.delete(RoleRef.user(u.$id)),
        ];
        return await databases.createDocument(DB, C.users, u.$id,
          { name: u.name || 'Student', email: u.email || '', role: 'student',
            department: dept, level },
          perms);
      } catch (err) { return null; }
    }
  }
  async function getLevel() {
    const local = parseInt(localStorage.getItem('ronyx_level'));
    if (local) return local;
    const p = await getProfile();
    const lvl = (p && p.level) || 1;
    localStorage.setItem('ronyx_level', lvl);
    return lvl;
  }
  async function setLevel(level) {
    localStorage.setItem('ronyx_level', parseInt(level));
    if (!databases) return null;
    const u = await currentUser(); if (!u) return null;
    try { return await databases.updateDocument(DB, C.users, u.$id, { level: parseInt(level) }); }
    catch (e) { return null; }
  }

  /* ---- EXAMS ---- */
  /* Fetches all published exams. Pass level=0 (or omit) to get everything.
     Client-side filtering in exams.html handles year / semester / type / format / search. */
  async function listExams(level) {
    if (!databases) return [];
    const filters = [Query.equal('status', 'published'), Query.limit(200), Query.orderDesc('$createdAt')];
    const res = await databases.listDocuments(DB, C.exams, filters);
    let docs = res.documents;
    /* Backward-compat: if a specific non-zero level is passed, still filter server-side */
    if (level && parseInt(level) !== 0) {
      const L = parseInt(level);
      docs = docs.filter(e => (e.level || 0) === L || (e.level || 0) === 0);
    }
    return docs;
  }
  async function getExam(id) { if (!databases) return null; return databases.getDocument(DB, C.exams, id); }
  async function listQuestions(examId) {
    if (!databases) return [];
    const res = await databases.listDocuments(DB, C.questions, [Query.equal('examId', examId), Query.limit(200)]);
    return res.documents;
  }

  /* ---- ATTEMPTS ---- */
  async function startAttempt(examId) {
    if (!databases) return null;
    const u = await currentUser();
    if (!u) return null;
    const doc = await databases.createDocument(DB, C.attempts, IDref.unique(),
      { examId, userId: u.$id, status: 'in_progress', answers: '{}', startedAt: new Date().toISOString() },
      ownerPerms(u.$id));
    sessionStorage.setItem('ronyx_attemptId', doc.$id);
    return doc;
  }
  async function saveAnswers(attemptId, answersObj) {
    if (!databases) return null;
    return databases.updateDocument(DB, C.attempts, attemptId, { answers: JSON.stringify(answersObj) });
  }
  async function submitAttempt(attemptId) {
    if (!databases) return null;
    return databases.updateDocument(DB, C.attempts, attemptId, { status: 'submitted', submittedAt: new Date().toISOString() });
  }

  /* ---- RESULTS ---- */
  async function listResults() {
    if (!databases) return [];
    const u = await currentUser(); if (!u) return [];
    const res = await databases.listDocuments(DB, C.results, [Query.equal('userId', u.$id)]);
    return res.documents;
  }

  /* ---- NOTIFICATIONS ---- */
  async function listNotifications(studentYear) {
    if (!databases) return [];
    const u = await currentUser(); if (!u) return [];
    /* No userId filter — Appwrite document permissions handle visibility:
       broadcast docs have Role.users() read, so all logged-in students see them.
       (Previously querying by userId caused 400 when the attribute had no index.) */
    try {
      const res = await databases.listDocuments(DB, C.notifications, [
        Query.orderDesc('$createdAt'), Query.limit(50)
      ]);
      const readLocal = JSON.parse(localStorage.getItem('ronyx_notif_read') || '{}');
      const yr = parseInt(studentYear) || 0;
      return res.documents
        /* Year filter: show if year=0/undefined (all), or matches student's year */
        .filter(n => !n.year || n.year === 0 || !yr || n.year === yr)
        .map(n => readLocal[n.$id] ? { ...n, read: true } : n);
    } catch (e) { return []; }
  }
  async function markNotificationRead(id) {
    if (!databases) return;
    /* Always persist to localStorage (works for broadcast & personal) */
    const readLocal = JSON.parse(localStorage.getItem('ronyx_notif_read') || '{}');
    readLocal[id] = true;
    localStorage.setItem('ronyx_notif_read', JSON.stringify(readLocal));
    /* Best-effort DB update */
    try { await databases.updateDocument(DB, C.notifications, id, { read: true }); } catch (e) {}
  }
  async function getUnreadCount() {
    if (!databases) return 0;
    try {
      const yr = await getLevel().catch(() => 0);
      const list = await listNotifications(yr);
      return list.filter(n => !n.read).length;
    } catch (e) { return 0; }
  }

  /* ---- BOOKS (library) ---- */
  async function listBooks() {
    if (!databases) return [];
    const res = await databases.listDocuments(DB, C.books, [Query.limit(100)]);
    return res.documents;
  }
  async function listAllBooks() {
    if (!databases) return [];
    let all = [], last = null;
    while (true) {
      const q = [Query.limit(100)];
      if (last) q.push(Query.cursorAfter(last));
      const res = await databases.listDocuments(DB, C.books, q);
      all = all.concat(res.documents);
      if (res.documents.length < 100) break;
      last = res.documents[res.documents.length - 1].$id;
    }
    return all;
  }
  async function getBook(id) { if (!databases) return null; return databases.getDocument(DB, C.books, id); }
  function fileViewUrl(fileId) {
    if (!storage || !fileId) return null;
    return storage.getFileView(cfg.BUCKETS.uploads, fileId);
  }

  /* ---- FILE UPLOAD ---- */
  async function uploadFile(file) {
    if (!storage) return null;
    return storage.createFile(cfg.BUCKETS.uploads, IDref.unique(), file);
  }

  /* Upload a student's own file — owner gets delete/update rights */
  async function uploadMyFile(file) {
    if (!storage) return null;
    const u = await currentUser();
    if (!u) throw new Error('Not logged in');
    return storage.createFile(cfg.BUCKETS.uploads, IDref.unique(), file, [
      Perm.read(RoleRef.users()),
      Perm.delete(RoleRef.user(u.$id)),
      Perm.update(RoleRef.user(u.$id)),
    ]);
  }

  /* Best-effort delete from storage */
  async function deleteMyFile(fileId) {
    if (!storage || !fileId) return;
    try { await storage.deleteFile(cfg.BUCKETS.uploads, fileId); } catch(e) {}
  }

  window.RonyxData = {
    currentUser, getProfile, getLevel, setLevel,
    listExams, getExam, listQuestions,
    startAttempt, saveAnswers, submitAttempt,
    listResults, listNotifications, markNotificationRead, getUnreadCount,
    listBooks, listAllBooks, getBook, fileViewUrl, uploadFile, uploadMyFile, deleteMyFile,
  };
})();
