/* ============================================================
   RONYX · nexus-data.js
   Self-contained data + Appwrite Realtime layer for Nexus.
   Depends on:  appwrite SDK, config.js, appwrite.js (for window.account)
   Exposes:     window.NexusData
   ============================================================ */

(function () {
  'use strict';

  const cfg = window.RONYX_CONFIG || { CONFIGURED: false };
  const { Client, Databases, Query, ID, Permission, Role } = window.Appwrite || {};

  let _client = null, _db = null;

  if (cfg.CONFIGURED && Client) {
    _client = new Client().setEndpoint(cfg.ENDPOINT).setProject(cfg.PROJECT_ID);
    _db     = new Databases(_client);
  }

  const DB = cfg.DATABASE_ID;
  const C  = () => cfg.COLLECTIONS;

  /* ── Auth helper ──────────────────────────────────────── */

  async function getMe() {
    if (!window.account) return null;
    try { return await window.account.get(); } catch (_) { return null; }
  }

  /* ── Identity ─────────────────────────────────────────── */

  const _adj = ['Quasar','Photon','Nebula','Pulsar','Prism','Vector','Cipher',
    'Nova','Axiom','Zenith','Flux','Orbit','Echo','Phase','Vortex',
    'Sigma','Alpha','Delta','Omega','Gamma','Terra','Solar','Lunar','Astro'];

  function nexusHandle(uid) {
    let h = 0;
    for (let i = 0; i < uid.length; i++) h = (h * 37 + uid.charCodeAt(i)) >>> 0;
    const word = _adj[h % _adj.length];
    const num  = (h >>> 8) % 256;
    return `${word}-${num.toString(16).toUpperCase().padStart(2,'0')}`;
  }

  function userColor(uid) {
    let h = 0;
    for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360},70%,62%)`;
  }

  /* ── Rooms ────────────────────────────────────────────── */

  async function listRooms(level) {
    if (!_db) return [];
    const q = [Query.equal('status','open'), Query.orderDesc('$createdAt'), Query.limit(40)];
    if (level && level > 0) q.push(Query.equal('level', level));
    const res = await _db.listDocuments(DB, C().nexus_rooms, q);
    return res.documents;
  }

  async function getRoom(id) {
    return await _db.getDocument(DB, C().nexus_rooms, id);
  }

  async function createRoom(data) {
    const me = await getMe();
    if (!me) throw new Error('Not authenticated');
    return await _db.createDocument(DB, C().nexus_rooms, ID.unique(), {
      title:        data.title,
      subject:      data.subject || '',
      emoji:        data.emoji   || '⬡',
      hostId:       me.$id,
      hostName:     me.name || 'Student',
      level:        data.level || 0,
      status:       'open',
      memberCount:  1,
      lastActivity: new Date().toISOString(),
    });
  }

  async function updateMemberCount(roomId, delta) {
    try {
      const room = await getRoom(roomId);
      const n    = Math.max(0, (room.memberCount || 0) + delta);
      await _db.updateDocument(DB, C().nexus_rooms, roomId,
        { memberCount: n, lastActivity: new Date().toISOString() });
    } catch (_) {}
  }

  async function endRoom(roomId) {
    await _db.updateDocument(DB, C().nexus_rooms, roomId, { status: 'ended' });
  }

  /* ── Messages ─────────────────────────────────────────── */

  // Appwrite enum only allows these values for nexus_messages.type
  const VALID_MSG_TYPES = new Set(['text','quiz','note','focus','drop','system','typing']);

  async function listMessages(roomId, limit) {
    if (!_db) return [];
    const res = await _db.listDocuments(DB, C().nexus_messages, [
      Query.equal('roomId', roomId),
      Query.orderAsc('$createdAt'),
      Query.limit(limit || 80),
    ]);
    return res.documents;
  }

  async function sendMessage(roomId, text, type, extra) {
    const me = await getMe();
    if (!me) throw new Error('Not authenticated');
    const uid = me.$id;

    // Map virtual types (join_request, kicked, etc.) to 'system' with _vtype in extra
    let dbType = type || 'text';
    let dbExtra = extra || null;
    if (!VALID_MSG_TYPES.has(dbType)) {
      dbExtra = Object.assign({}, dbExtra || {}, { _vtype: dbType });
      dbType = 'system';
    }

    return await _db.createDocument(DB, C().nexus_messages, ID.unique(), {
      roomId,
      userId:    uid,
      userName:  me.name || 'Student',
      userColor: userColor(uid),
      handle:    nexusHandle(uid),
      text:      text || '',
      type:      dbType,
      extra:     dbExtra ? JSON.stringify(dbExtra) : '',
      reactions: JSON.stringify({}),
      pinned:    false,
    });
  }

  async function editMessage(msgId, text) {
    if (!_db) return;
    await _db.updateDocument(DB, C().nexus_messages, msgId, { text });
  }

  async function deleteMessage(msgId) {
    if (!_db) return;
    await _db.deleteDocument(DB, C().nexus_messages, msgId);
  }

  /* Keeper admits a requesting user — stored as 'system' with _vtype:'join_approved' */
  async function admitUser(roomId, targetUserId, targetHandle) {
    const me = await getMe();
    if (!me) return;
    return await _db.createDocument(DB, C().nexus_messages, ID.unique(), {
      roomId,
      userId:    me.$id,
      userName:  me.name || 'Student',
      userColor: userColor(me.$id),
      handle:    nexusHandle(me.$id),
      text:      `${targetHandle} was admitted to the Hive.`,
      type:      'system',
      extra:     JSON.stringify({ userId: targetUserId, _vtype: 'join_approved' }),
      reactions: JSON.stringify({}),
      pinned:    false,
    });
  }

  /* Keeper removes a member — stored as 'system' with _vtype:'kicked' */
  async function kickUser(roomId, targetUserId, targetHandle) {
    const me = await getMe();
    if (!me) return;
    return await _db.createDocument(DB, C().nexus_messages, ID.unique(), {
      roomId,
      userId:    me.$id,
      userName:  me.name || 'Student',
      userColor: userColor(me.$id),
      handle:    nexusHandle(me.$id),
      text:      `${targetHandle} was removed from the Hive.`,
      type:      'system',
      extra:     JSON.stringify({ userId: targetUserId, _vtype: 'kicked' }),
      reactions: JSON.stringify({}),
      pinned:    false,
    });
  }

  async function addReaction(msgId, slot) {
    const msg = await _db.getDocument(DB, C().nexus_messages, msgId);
    let r;
    try { r = JSON.parse(msg.reactions); } catch(_) { r = {}; }
    r[slot] = (r[slot] || 0) + 1;
    await _db.updateDocument(DB, C().nexus_messages, msgId, { reactions: JSON.stringify(r) });
  }

  async function pinMessage(msgId, pinned) {
    await _db.updateDocument(DB, C().nexus_messages, msgId, { pinned });
  }

  /* ── Realtime ─────────────────────────────────────────── */

  function subscribeRoom(roomId, onEvent) {
    if (!_client) return () => {};
    const ch = `databases.${DB}.collections.${C().nexus_messages}.documents`;
    return _client.subscribe(ch, ev => {
      const doc = ev.payload;
      if (doc && doc.roomId === roomId) onEvent(ev.events, doc);
    });
  }

  function subscribeRoomDoc(roomId, onEvent) {
    if (!_client) return () => {};
    const ch = `databases.${DB}.collections.${C().nexus_rooms}.documents.${roomId}`;
    return _client.subscribe(ch, ev => onEvent(ev.events, ev.payload));
  }

  /* ── Export ───────────────────────────────────────────── */
  window.NexusData = {
    getMe,
    nexusHandle,
    userColor,
    listRooms,
    getRoom,
    createRoom,
    updateMemberCount,
    endRoom,
    listMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    admitUser,
    kickUser,
    addReaction,
    pinMessage,
    subscribeRoom,
    subscribeRoomDoc,
  };
})();
