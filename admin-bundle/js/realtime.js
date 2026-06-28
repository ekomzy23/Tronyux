/* ============================================================
   RONYX ADMIN · realtime.js
   Live updates. Subscribe to a collection; your callback fires
   whenever any document is created, updated, or deleted.

   This is the same mechanism the student app uses to reflect
   admin changes instantly.

   Usage:
     RonyxRealtime.subscribe(RONYX.COLLECTIONS.exams, () => reload());
   ============================================================ */

window.RonyxRealtime = (function () {
  const cfg = window.RONYX_CONFIG || { CONFIGURED: false };
  let client = null;
  if (cfg.CONFIGURED && window.Appwrite) {
    client = new Appwrite.Client().setEndpoint(cfg.ENDPOINT).setProject(cfg.PROJECT_ID);
  }

  function subscribe(collectionId, callback) {
    if (!client) return () => {};
    const channel = `databases.${cfg.DATABASE_ID}.collections.${collectionId}.documents`;
    try { return client.subscribe(channel, callback); }
    catch (e) { return () => {}; }
  }

  return { subscribe };
})();
