/* ============================================================
   RONYX ADMIN · launch-admin-data.js
   Admin data layer for Launch features.
   Load on admin launch pages after admin-data.js.
   ============================================================ */

(function () {
  const cfg = window.RONYX_CONFIG || { CONFIGURED: false };
  const C   = cfg.COLLECTIONS || {};

  let db = null, Query = null, ID = null, Perm = null, Role = null;
  let _acct = null, _adminId = null;
  if (cfg.CONFIGURED && window.Appwrite) {
    const client = new Appwrite.Client().setEndpoint(cfg.ENDPOINT).setProject(cfg.PROJECT_ID);
    db    = new Appwrite.Databases(client);
    _acct = new Appwrite.Account(client);
    Query = Appwrite.Query; ID = Appwrite.ID;
    Perm  = Appwrite.Permission; Role = Appwrite.Role;
  }
  const DB = cfg.DATABASE_ID;

  async function adminPerms() {
    if (!_adminId && _acct) {
      try { _adminId = (await _acct.get()).$id; } catch {}
    }
    return _adminId ? [
      Perm.read(Role.users()),
      Perm.update(Role.user(_adminId)),
      Perm.delete(Role.user(_adminId)),
    ] : [Perm.read(Role.users())];
  }

  /* ── COMPETITIONS ─────────────────────────────────────────────── */

  async function listCompetitions() {
    if (!db) return [];
    try {
      const r = await db.listDocuments(DB, C.competitions, [
        Query.orderDesc('$createdAt'), Query.limit(100),
      ]);
      return r.documents;
    } catch { return []; }
  }

  async function createCompetition(data) {
    if (!db) return null;
    const perms = await adminPerms();
    return db.createDocument(DB, C.competitions, ID.unique(), {
      title:             data.title             || 'Competition',
      description:       data.description       || '',
      examId:            data.examId            || null,
      examTitle:         data.examTitle         || '',
      startDate:         data.startDate         || new Date().toISOString(),
      endDate:           data.endDate           || null,
      status:            data.status            || 'draft',
      prizeDescription:  data.prizeDescription  || '',
      pointsFirst:       data.pointsFirst       != null ? parseInt(data.pointsFirst) : 100,
      pointsSecond:      data.pointsSecond      != null ? parseInt(data.pointsSecond) : 50,
      pointsThird:       data.pointsThird       != null ? parseInt(data.pointsThird) : 25,
      pointsParticipant: data.pointsParticipant != null ? parseInt(data.pointsParticipant) : 5,
      eligibleLevel:     data.eligibleLevel     != null ? parseInt(data.eligibleLevel) : 0,
      bannerEmoji:       data.bannerEmoji       || '🏆',
      createdBy:         _adminId               || '',
      pointsAwarded:     false,
    }, perms);
  }

  async function updateCompetition(id, data) {
    if (!db) return null;
    return db.updateDocument(DB, C.competitions, id, data);
  }

  async function deleteCompetition(id) {
    if (!db) return;
    return db.deleteDocument(DB, C.competitions, id);
  }

  /* Sets status to 'ended' */
  async function endCompetition(id) {
    if (!db) return;
    return db.updateDocument(DB, C.competitions, id, { status: 'ended' });
  }

  /* ── COMPETITION LEADERBOARD ─────────────────────────────────── */

  async function getCompetitionLeaderboard(comp) {
    if (!db || !comp.examId) return [];
    try {
      const filters = [
        Query.equal('examId', comp.examId),
        Query.limit(200),
        Query.orderDesc('score'),
      ];
      if (comp.startDate) filters.push(Query.greaterThanEqual('$createdAt', comp.startDate));
      if (comp.endDate)   filters.push(Query.lessThanEqual('$createdAt', comp.endDate));

      const r = await db.listDocuments(DB, C.results, filters);
      return r.documents.map((doc, i) => ({ ...doc, rank: i + 1 }));
    } catch { return []; }
  }

  /* Award top-3 points + participation points.
     Can only be called once (pointsAwarded flag prevents re-runs). */
  async function awardCompetitionPoints(comp, leaderboard) {
    if (!db || comp.pointsAwarded) return { ok: false, msg: 'Already awarded' };

    const tiers = [
      { rank: 1, pts: comp.pointsFirst  || 100 },
      { rank: 2, pts: comp.pointsSecond || 50  },
      { rank: 3, pts: comp.pointsThird  || 25  },
    ];
    const participantPts = comp.pointsParticipant || 5;
    const reasons = ['🥇 1st place', '🥈 2nd place', '🥉 3rd place'];
    const seen = new Set();
    let awarded = 0;

    for (const entry of leaderboard) {
      if (!entry.userId || seen.has(entry.userId)) continue;
      seen.add(entry.userId);

      const tier = tiers.find(t => t.rank === entry.rank);
      const pts  = tier ? tier.pts : participantPts;
      const rsn  = tier ? reasons[entry.rank - 1] + ' in ' + comp.title
                        : 'Participated in ' + comp.title;

      try {
        /* Get current balance */
        let bal = 0;
        try { const u = await db.getDocument(DB, C.users, entry.userId); bal = u.points || 0; } catch {}
        const newBal = bal + pts;

        await db.createDocument(DB, C.points_ledger, ID.unique(), {
          userId:  entry.userId,
          points:  pts,
          reason:  rsn,
          type:    'competition',
          refId:   comp.$id,
          balance: newBal,
        }, [
          Perm.read(Role.user(entry.userId)),
          Perm.update(Role.user(entry.userId)),
        ]);

        await db.updateDocument(DB, C.users, entry.userId, { points: newBal });
        awarded++;
      } catch (e) { console.warn('points award failed for', entry.userId, e.message); }
    }

    /* Mark as awarded */
    await db.updateDocument(DB, C.competitions, comp.$id, { pointsAwarded: true, status: 'ended' });
    return { ok: true, awarded };
  }

  /* ── STUDY ROOMS ──────────────────────────────────────────────── */

  async function listAllRooms() {
    if (!db) return [];
    try {
      const r = await db.listDocuments(DB, C.study_rooms, [
        Query.orderDesc('$createdAt'), Query.limit(100),
      ]);
      return r.documents;
    } catch { return []; }
  }

  async function forceEndRoom(id) {
    if (!db) return;
    return db.updateDocument(DB, C.study_rooms, id, { status: 'ended' });
  }

  async function deleteRoom(id) {
    if (!db) return;
    return db.deleteDocument(DB, C.study_rooms, id);
  }

  window.RonyxLaunchAdmin = {
    listCompetitions,
    createCompetition,
    updateCompetition,
    deleteCompetition,
    endCompetition,
    getCompetitionLeaderboard,
    awardCompetitionPoints,
    listAllRooms,
    forceEndRoom,
    deleteRoom,
  };
})();
