/* ============================================================
   RUNYX · data.js
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
  const cfg = window.RUNYX_CONFIG || { CONFIGURED: false };

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
      // create profile on first use
      try {
        return await databases.createDocument(DB, C.users, u.$id,
          { name: u.name || 'Student', email: u.email || '', role: 'student', level: 1 },
          ownerPerms(u.$id));
      } catch (err) { return null; }
    }
  }
  async function getLevel() {
    const local = parseInt(localStorage.getItem('runyx_level'));
    if (local) return local;
    const p = await getProfile();
    const lvl = (p && p.level) || 1;
    localStorage.setItem('runyx_level', lvl);
    return lvl;
  }
  async function setLevel(level) {
    localStorage.setItem('runyx_level', parseInt(level));
    if (!databases) return null;
    const u = await currentUser(); if (!u) return null;
    try { return await databases.updateDocument(DB, C.users, u.$id, { level: parseInt(level) }); }
    catch (e) { return null; }
  }

  /* ---- EXAMS (filtered by level) ---- */
  async function listExams(level) {
    if (!databases) return [];
    const res = await databases.listDocuments(DB, C.exams, [Query.equal('status', 'published'), Query.limit(100)]);
    let docs = res.documents;
    if (level) {
      const L = parseInt(level);
      docs = docs.filter(e => (e.level || 0) === L || (e.level || 0) === 0); // 0 = all years
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
    sessionStorage.setItem('runyx_attemptId', doc.$id);
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
  async function listNotifications() {
    if (!databases) return [];
    const u = await currentUser(); if (!u) return [];
    const res = await databases.listDocuments(DB, C.notifications, [Query.equal('userId', u.$id)]);
    return res.documents;
  }

  /* ---- BOOKS (library) ---- */
  async function listBooks() {
    if (!databases) return [];
    const res = await databases.listDocuments(DB, C.books, [Query.limit(100)]);
    return res.documents;
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

  window.RunyxData = {
    currentUser, getProfile, getLevel, setLevel,
    listExams, getExam, listQuestions,
    startAttempt, saveAnswers, submitAttempt,
    listResults, listNotifications,
    listBooks, getBook, fileViewUrl, uploadFile,
  };
})();
