/* ============================================================
   RONYX ADMIN · admin-data.js
   Create / read / update / delete everything the admin manages.
   ============================================================ */

(function () {
  const cfg = window.RONYX_CONFIG || { CONFIGURED: false };
  let db = null, storage = null, Query = null, ID = null, Permission = null, Role = null;
  let _adminAccount = null;
  if (cfg.CONFIGURED && window.Appwrite) {
    const client = new Appwrite.Client().setEndpoint(cfg.ENDPOINT).setProject(cfg.PROJECT_ID);
    db      = new Appwrite.Databases(client);
    storage = new Appwrite.Storage(client);
    _adminAccount = new Appwrite.Account(client);
    Query = Appwrite.Query; ID = Appwrite.ID;
    Permission = Appwrite.Permission; Role = Appwrite.Role;
  }
  const DB = cfg.DATABASE_ID, C = cfg.COLLECTIONS || {};

  /* Cache admin user ID so each create() doesn't re-fetch */
  let _adminId = null;
  async function adminDocPerms() {
    if (!_adminId && _adminAccount) {
      try { _adminId = (await _adminAccount.get()).$id; } catch(e) {}
    }
    /* Document owned by admin: all students can read, only admin can update/delete */
    return _adminId ? [
      Permission.read(Role.users()),
      Permission.update(Role.user(_adminId)),
      Permission.delete(Role.user(_adminId)),
    ] : [Permission.read(Role.users())];
  }

  /* Friendly hint when Appwrite returns 401 on writes (usually a collection
     permissions issue — the notifications collection was created without a
     collection-level read permission which Appwrite requires before any op). */
  function wrapWrite(promise) {
    return promise.catch(function(e) {
      if ((e.code === 401 || e.code === 403) && typeof toast === 'function') {
        toast('Permission error (401). Run setup.js from admin-bundle/setup to fix collection permissions, then try again.', 'error');
      }
      throw e;
    });
  }

  // Fetch one page (max 100)
  const list = (col, filters = []) =>
    db ? db.listDocuments(DB, col, [Query.limit(100), ...filters]).then(r => r.documents)
       : Promise.resolve([]);

  // Fetch total count without loading all documents
  const count = async (col, filters = []) => {
    if (!db) return 0;
    try {
      const r = await db.listDocuments(DB, col, [Query.limit(1), ...filters]);
      return r.total;
    } catch { return 0; }
  };

  // Paginate through ALL documents (handles >100 items, e.g. 1000 questions)
  const listAll = async (col, filters = []) => {
    if (!db) return [];
    let docs = [], cursor = null;
    while (true) {
      const q = [Query.limit(100), ...filters];
      if (cursor) q.push(Query.cursorAfter(cursor));
      const res = await db.listDocuments(DB, col, q);
      docs = docs.concat(res.documents);
      if (res.documents.length < 100 || docs.length >= res.total) break;
      cursor = res.documents[res.documents.length - 1].$id;
    }
    return docs;
  };

  const get = (col, id) => db ? db.getDocument(DB, col, id) : Promise.resolve(null);
  const add = async (col, data, id) => {
    if (!db) return null;
    const perms = await adminDocPerms();
    return wrapWrite(db.createDocument(DB, col, id || ID.unique(), data, perms));
  };
  const upd = (col, id, data) => db ? wrapWrite(db.updateDocument(DB, col, id, data)) : Promise.resolve(null);
  const del = (col, id) => db ? wrapWrite(db.deleteDocument(DB, col, id)) : Promise.resolve(null);

  window.RonyxAdmin = {
    // exams
    listExams:   ()        => list(C.exams),
    getExam:     id        => get(C.exams, id),
    createExam:  d         => add(C.exams, d),
    updateExam:  (id, d)   => upd(C.exams, id, d),
    deleteExam:  id        => del(C.exams, id),

    // questions — uses paginated listAll so 1000+ questions work
    listQuestions:   examId => listAll(C.questions, examId ? [Query.equal('examId', examId)] : []),
    /* Single-page fetch for quick first paint; returns full {documents, total} response */
    listQuestionsPage: function(examId, cursor) {
      if (!db) return Promise.resolve({ documents: [], total: 0 });
      const filters = examId ? [Query.equal('examId', examId)] : [];
      const q = [Query.limit(100), ...filters];
      if (cursor) q.push(Query.cursorAfter(cursor));
      return db.listDocuments(DB, C.questions, q);
    },
    countQuestions:  examId => count(C.questions, examId ? [Query.equal('examId', examId)] : []),
    getQuestion:     id     => get(C.questions, id),
    createQuestion:  d      => add(C.questions, d),
    updateQuestion:  (id,d) => upd(C.questions, id, d),
    deleteQuestion:  id     => del(C.questions, id),

    // bulk-create questions (array of data objects)
    bulkCreateQuestions: async function(items) {
      const results = [];
      for (const d of items) {
        try { results.push(await add(C.questions, d)); }
        catch (e) { results.push({ error: e.message, data: d }); }
      }
      return results;
    },

    // books
    listBooks:  ()       => list(C.books),
    getBook:    id       => get(C.books, id),
    createBook: d        => add(C.books, d),
    updateBook: (id, d)  => upd(C.books, id, d),
    deleteBook: id       => del(C.books, id),

    // users — count-only by default; fetch list only when explicitly needed
    countUsers:        ()     => count(C.users),
    countStudents:     ()     => count(C.users, [Query.equal('role', 'student')]),
    listUsers:         ()     => list(C.users).catch(() => []),
    listUsersByRole:   role   => list(C.users, [Query.equal('role', role)]).catch(() => []),
    listUsersByDept:   dept   => list(C.users, [Query.equal('department', dept)]).catch(() => []),
    getUser:           id     => get(C.users, id),
    updateUser:        (id,d) => upd(C.users, id, d),
    deleteUser:        id     => del(C.users, id),

    // attempts
    listAttempts:  examId => list(C.attempts, examId ? [Query.equal('examId', examId)] : []).catch(() => []),
    getAttempt:    id     => get(C.attempts, id),
    updateAttempt: (id,d) => upd(C.attempts, id, d),

    // results
    listResults:  ()      => list(C.results).catch(() => []),
    getResult:    id      => get(C.results, id),
    updateResult: (id,d)  => upd(C.results, id, d),

    // notifications
    listNotifications:   ()  => list(C.notifications).catch(() => []),
    createNotification:  d   => add(C.notifications, d),
    deleteNotification:  id  => del(C.notifications, id),

    /* Fetch all Web Push subscriptions from student user documents */
    listPushSubscriptions: async function() {
      if (!db || !Query) return [];
      try {
        var users = await listAll(C.users, [Query.isNotNull('pushSubscription')]);
        return users.map(function(u) {
          try { return JSON.parse(u.pushSubscription); } catch(e) { return null; }
        }).filter(Boolean);
      } catch(e) { return []; }
    },

    /* Broadcast an announcement to students.
       year=0 or omitted → all students; year=1..5 → only that year.
       Retries without 'year' field if the attribute doesn't exist in
       the Appwrite collection yet (schema created before that attribute
       was added). This makes it safe to call before re-running setup.js. */
    broadcastAnnouncement: async function(title, body, type, link, year) {
      if (!db) return null;
      const perms = [
        Permission.read(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
      ];
      const data = {
        userId: 'broadcast',
        title:  title || 'Announcement',
        body:   body  || '',
        type:   type  || 'info',
        read:   false,
        link:   link  || '',
      };
      const y = parseInt(year) || 0;
      if (y > 0) data.year = y;
      try {
        return await wrapWrite(db.createDocument(DB, C.notifications, ID.unique(), data, perms));
      } catch(e) {
        if (data.year !== undefined) {
          delete data.year;
          return wrapWrite(db.createDocument(DB, C.notifications, ID.unique(), data, perms));
        }
        throw e;
      }
    },

    // files
    listFiles:  ()          => storage ? storage.listFiles(cfg.BUCKETS.uploads).then(r => r.files).catch(() => []) : Promise.resolve([]),
    uploadFile: file        => storage ? storage.createFile(cfg.BUCKETS.uploads, ID.unique(), file, [Permission.read(Role.users())]) : Promise.resolve(null),
    deleteFile: id          => storage ? storage.deleteFile(cfg.BUCKETS.uploads, id) : Promise.resolve(null),

    // book files — explicit read perms ensure students can access regardless of
    // the bucket's fileSecurityEnabled setting in the Appwrite console
    uploadBookFile: file => storage ? storage.createFile(
      cfg.BUCKETS.uploads, ID.unique(), file,
      [Permission.read(Role.users())]  /* all logged-in users can view */
    ) : Promise.resolve(null),
    deleteBookFile: fileId => storage ? storage.deleteFile(cfg.BUCKETS.uploads, fileId).catch(() => {}) : Promise.resolve(null),
    getBookFileUrl: fileId => storage && fileId ? storage.getFileView(cfg.BUCKETS.uploads, fileId).toString() : null,

    // dashboard counts — uses efficient count API calls
    countAll: async function () {
      const [exams, questions, users, attempts, results, submitted] = await Promise.all([
        count(C.exams),
        count(C.questions),
        count(C.users),
        count(C.attempts),
        count(C.results),
        count(C.attempts, [Query.equal('status', 'submitted')]),
      ]);
      const pending   = await count(C.attempts, [Query.equal('status', 'submitted')]).catch(() => 0);
      const liveExams = await count(C.exams,    [Query.equal('status', 'live')]).catch(() => 0);
      return { exams, questions, users, attempts, results, submitted, pending, liveExams };
    },
  };
})();
