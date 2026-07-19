/* ============================================================
   RONYX · launch-data.js
   Student-side data layer for Launch features:
     • Competitions  • Points / Wallet  • Study Rooms

   Load after data.js on any Launch page:
     <script src="/js/launch-data.js"></script>
   ============================================================ */

(function () {
  const cfg = window.RONYX_CONFIG || { CONFIGURED: false };
  const C   = cfg.COLLECTIONS || {};

  let db = null, Query = null, IDref = null, Perm = null, RoleRef = null;
  if (cfg.CONFIGURED && window.Appwrite) {
    const client = new Appwrite.Client().setEndpoint(cfg.ENDPOINT).setProject(cfg.PROJECT_ID);
    db    = new Appwrite.Databases(client);
    Query = Appwrite.Query; IDref = Appwrite.ID;
    Perm  = Appwrite.Permission; RoleRef = Appwrite.Role;
  }
  const DB = cfg.DATABASE_ID;

  /* ── helpers ─────────────────────────────────────────────────── */
  async function currentUser() {
    if (!window.account) return null;
    try { return await window.account.get(); } catch { return null; }
  }

  /* ── COMPETITIONS ─────────────────────────────────────────────── */

  async function listCompetitions() {
    if (!db) return [];
    try {
      const r = await db.listDocuments(DB, C.competitions, [
        Query.orderDesc('$createdAt'), Query.limit(50),
      ]);
      return r.documents;
    } catch (e) { return []; }
  }

  async function getCompetition(id) {
    if (!db) return null;
    return db.getDocument(DB, C.competitions, id);
  }

  /* Returns results for this competition, sorted best-first.
     Each item is a full result document + computed rank.            */
  async function getCompetitionLeaderboard(comp) {
    if (!db || !comp.examId) return [];
    try {
      const filters = [
        Query.equal('examId', comp.examId),
        Query.limit(100),
        Query.orderDesc('score'),
      ];
      /* Filter by date window */
      if (comp.startDate) filters.push(Query.greaterThanEqual('$createdAt', comp.startDate));
      if (comp.endDate)   filters.push(Query.lessThanEqual('$createdAt', comp.endDate));

      const r = await db.listDocuments(DB, C.results, filters);
      return r.documents.map((doc, i) => ({ ...doc, rank: i + 1 }));
    } catch (e) { return []; }
  }

  /* ── POINTS ───────────────────────────────────────────────────── */

  async function getMyBalance() {
    const u = await currentUser(); if (!u) return 0;
    try {
      const doc = await db.getDocument(DB, C.users, u.$id);
      return doc.points || 0;
    } catch { return 0; }
  }

  async function listMyLedger(limit) {
    if (!db) return [];
    const u = await currentUser(); if (!u) return [];
    try {
      const r = await db.listDocuments(DB, C.points_ledger, [
        Query.equal('userId', u.$id),
        Query.orderDesc('$createdAt'),
        Query.limit(limit || 30),
      ]);
      return r.documents;
    } catch { return []; }
  }

  /* Call this from submitted.html (after scoring) or study-room.html.
     Creates a ledger entry and increments the user's points total.    */
  async function awardPoints(points, reason, type, refId) {
    if (!db || points <= 0) return;
    const u = await currentUser(); if (!u) return;
    try {
      /* Get current balance first */
      let bal = 0;
      try { const profile = await db.getDocument(DB, C.users, u.$id); bal = profile.points || 0; } catch {}
      const newBal = bal + points;

      /* Write ledger entry */
      const perms = [Perm.read(RoleRef.user(u.$id)), Perm.update(RoleRef.user(u.$id))];
      await db.createDocument(DB, C.points_ledger, IDref.unique(), {
        userId: u.$id,
        points,
        reason: reason || '',
        type:   type   || 'bonus',
        refId:  refId  || null,
        balance: newBal,
      }, perms);

      /* Update user total */
      await db.updateDocument(DB, C.users, u.$id, { points: newBal });
    } catch (e) { console.warn('[Launch] awardPoints:', e.message); }
  }

  /* ── STUDY ROOMS ──────────────────────────────────────────────── */

  async function listStudyRooms(level) {
    if (!db) return [];
    try {
      const filters = [
        Query.equal('status', 'open'),
        Query.orderDesc('$createdAt'),
        Query.limit(50),
      ];
      if (level && level !== 0) filters.push(Query.equal('level', level));
      const r = await db.listDocuments(DB, C.study_rooms, filters);
      return r.documents;
    } catch { return []; }
  }

  async function getStudyRoom(id) {
    if (!db) return null;
    return db.getDocument(DB, C.study_rooms, id);
  }

  async function createStudyRoom(data) {
    if (!db) return null;
    const u = await currentUser(); if (!u) return null;
    /* Generate a unique Jitsi room slug: ronyx-<random> */
    const slug = 'ronyx-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
    const perms = [
      Perm.read(RoleRef.users()),
      Perm.update(RoleRef.user(u.$id)),
      Perm.delete(RoleRef.user(u.$id)),
    ];
    return db.createDocument(DB, C.study_rooms, IDref.unique(), {
      title:        data.title        || 'Study Room',
      description:  data.description  || '',
      bookId:       data.bookId       || null,
      bookTitle:    data.bookTitle    || '',
      hostId:       u.$id,
      hostName:     data.hostName     || u.name || 'Host',
      jitsiRoom:    slug,
      status:       'open',
      scheduledAt:  data.scheduledAt  || null,
      level:        data.level        || 0,
      attendeeCount: 1,
    }, perms);
  }

  async function incrementAttendees(roomId) {
    if (!db) return;
    try {
      const room = await db.getDocument(DB, C.study_rooms, roomId);
      await db.updateDocument(DB, C.study_rooms, roomId, {
        attendeeCount: (room.attendeeCount || 0) + 1,
      });
    } catch {}
  }

  async function endStudyRoom(roomId) {
    if (!db) return;
    try { await db.updateDocument(DB, C.study_rooms, roomId, { status: 'ended' }); } catch {}
  }

  window.RonyxLaunch = {
    /* competitions */
    listCompetitions,
    getCompetition,
    getCompetitionLeaderboard,
    /* points */
    getMyBalance,
    listMyLedger,
    awardPoints,
    /* study rooms */
    listStudyRooms,
    getStudyRoom,
    createStudyRoom,
    incrementAttendees,
    endStudyRoom,
  };
})();
