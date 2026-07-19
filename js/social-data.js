/* ============================================================
   RONYX · social-data.js
   Data layer for the social feed, follows, posts, comments.
   Depends on: Appwrite SDK, config.js, appwrite.js
   Exposes: window.SocialData
   ============================================================ */

(function () {
  'use strict';

  const cfg = window.RONYX_CONFIG || { CONFIGURED: false };
  const { Client, Databases, Query, ID } = window.Appwrite || {};

  let _db = null, _client = null;
  if (cfg.CONFIGURED && Client) {
    _client = new Client().setEndpoint(cfg.ENDPOINT).setProject(cfg.PROJECT_ID);
    _db     = new Databases(_client);
  }

  const DB = cfg.DATABASE_ID;
  const C  = () => cfg.COLLECTIONS;

  /* ── Auth ─────────────────────────────────────────────── */
  async function getMe() {
    if (!window.account) return null;
    try { return await window.account.get(); } catch (_) { return null; }
  }

  /* ── Handle / color (reuse same algo as nexus-data) ───── */
  const _adj = ['Quasar','Photon','Nebula','Pulsar','Prism','Vector','Cipher',
    'Nova','Axiom','Zenith','Flux','Orbit','Echo','Phase','Vortex',
    'Sigma','Alpha','Delta','Omega','Gamma','Terra','Solar','Lunar','Astro'];

  function nexusHandle(uid) {
    let h = 0;
    for (let i = 0; i < uid.length; i++) h = (h * 37 + uid.charCodeAt(i)) >>> 0;
    return `${_adj[h % _adj.length]}-${((h >>> 8) % 256).toString(16).toUpperCase().padStart(2,'0')}`;
  }

  function userColor(uid) {
    let h = 0;
    for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360},70%,62%)`;
  }

  /* ── Post likes (localStorage) ── */
  function getLiked() {
    try { return JSON.parse(localStorage.getItem('ronyx_liked') || '{}'); } catch(_) { return {}; }
  }
  function setLiked(map) {
    try { localStorage.setItem('ronyx_liked', JSON.stringify(map)); } catch(_){}
  }
  function isLiked(postId) { return !!getLiked()[postId]; }

  /* ── Comment likes (localStorage) ── */
  function getCmtLiked() {
    try { return JSON.parse(localStorage.getItem('ronyx_clikes') || '{}'); } catch(_) { return {}; }
  }
  function setCmtLiked(map) {
    try { localStorage.setItem('ronyx_clikes', JSON.stringify(map)); } catch(_){}
  }
  function isCommentLiked(cid) { return !!getCmtLiked()[cid]; }

  async function likeComment(cid) {
    const liked = getCmtLiked();
    if (liked[cid]) return;
    try {
      const c = await _db.getDocument(DB, C().social_comments, cid);
      await _db.updateDocument(DB, C().social_comments, cid, { likes: (c.likes || 0) + 1 });
    } catch(_) {}
    liked[cid] = 1;
    setCmtLiked(liked);
  }

  async function unlikeComment(cid) {
    const liked = getCmtLiked();
    if (!liked[cid]) return;
    try {
      const c = await _db.getDocument(DB, C().social_comments, cid);
      await _db.updateDocument(DB, C().social_comments, cid, { likes: Math.max(0, (c.likes || 1) - 1) });
    } catch(_) {}
    delete liked[cid];
    setCmtLiked(liked);
  }

  /* ── Posts ────────────────────────────────────────────── */

  async function createPost(content, type, subject) {
    const me = await getMe();
    if (!me) throw new Error('Not authenticated');
    return await _db.createDocument(DB, C().social_posts, ID.unique(), {
      userId:       me.$id,
      userHandle:   nexusHandle(me.$id),
      userColor:    userColor(me.$id),
      userName:     me.name || 'Student',
      content:      content.trim(),
      type:         type || 'note',
      subject:      subject || '',
      likes:        0,
      commentCount: 0,
    });
  }

  async function listFeed(limit, cursor) {
    if (!_db) return [];
    const q = [Query.orderDesc('$createdAt'), Query.limit(limit || 20)];
    if (cursor) q.push(Query.cursorAfter(cursor));
    const res = await _db.listDocuments(DB, C().social_posts, q);
    return res.documents;
  }

  async function listFollowingFeed(myId, limit, cursor) {
    if (!_db || !myId) return [];
    /* Get IDs of people I follow */
    const follows = await _db.listDocuments(DB, C().social_follows, [
      Query.equal('followerId', myId), Query.limit(100),
    ]);
    const ids = follows.documents.map(f => f.followingId);
    if (!ids.length) return [];
    const q = [
      Query.equal('userId', ids),
      Query.orderDesc('$createdAt'),
      Query.limit(limit || 20),
    ];
    if (cursor) q.push(Query.cursorAfter(cursor));
    const res = await _db.listDocuments(DB, C().social_posts, q);
    return res.documents;
  }

  async function getUserPosts(userId, limit) {
    if (!_db) return [];
    const res = await _db.listDocuments(DB, C().social_posts, [
      Query.equal('userId', userId),
      Query.orderDesc('$createdAt'),
      Query.limit(limit || 30),
    ]);
    return res.documents;
  }

  async function getPost(postId) {
    return await _db.getDocument(DB, C().social_posts, postId);
  }

  async function deletePost(postId) {
    await _db.deleteDocument(DB, C().social_posts, postId);
  }

  async function likePost(postId) {
    const liked = getLiked();
    if (liked[postId]) return; // already liked
    const post = await _db.getDocument(DB, C().social_posts, postId);
    await _db.updateDocument(DB, C().social_posts, postId, { likes: (post.likes || 0) + 1 });
    liked[postId] = 1;
    setLiked(liked);
  }

  async function unlikePost(postId) {
    const liked = getLiked();
    if (!liked[postId]) return;
    const post = await _db.getDocument(DB, C().social_posts, postId);
    await _db.updateDocument(DB, C().social_posts, postId, { likes: Math.max(0, (post.likes || 1) - 1) });
    delete liked[postId];
    setLiked(liked);
  }

  /* ── Comments ─────────────────────────────────────────── */

  async function listComments(postId, limit) {
    if (!_db) return [];
    const res = await _db.listDocuments(DB, C().social_comments, [
      Query.equal('postId', postId),
      Query.orderAsc('$createdAt'),
      Query.limit(limit || 50),
    ]);
    return res.documents;
  }

  async function createComment(postId, content, parentId) {
    const me = await getMe();
    if (!me) throw new Error('Not authenticated');
    const data = {
      postId,
      userId:     me.$id,
      userHandle: nexusHandle(me.$id),
      userColor:  userColor(me.$id),
      userName:   me.name || 'Student',
      content:    content.trim(),
    };
    if (parentId) data.parentId = parentId;
    let doc;
    try {
      doc = await _db.createDocument(DB, C().social_comments, ID.unique(), data);
    } catch(e) {
      if ((e.code === 400 || e.code === 'unknown') && data.parentId) {
        /* parentId attr not in schema yet — post as flat comment so it doesn't fail */
        delete data.parentId;
        doc = await _db.createDocument(DB, C().social_comments, ID.unique(), data);
      } else {
        throw e;
      }
    }
    /* Only top-level comments increment the post commentCount */
    if (!parentId) {
      try {
        const post = await _db.getDocument(DB, C().social_posts, postId);
        await _db.updateDocument(DB, C().social_posts, postId, { commentCount: (post.commentCount||0)+1 });
      } catch(_){}
    }
    return doc;
  }

  /* ── Follows ───────────────────────────────────────────── */

  async function followUser(targetId) {
    const me = await getMe();
    if (!me || me.$id === targetId) return;
    try {
      await _db.createDocument(DB, C().social_follows, ID.unique(), {
        followerId:  me.$id,
        followingId: targetId,
      });
    } catch(e) {
      if (!e.message?.includes('unique')) throw e; // ignore duplicate
    }
  }

  async function unfollowUser(targetId) {
    const me = await getMe();
    if (!me) return;
    const res = await _db.listDocuments(DB, C().social_follows, [
      Query.equal('followerId', me.$id),
      Query.equal('followingId', targetId),
      Query.limit(1),
    ]);
    if (res.documents.length) {
      await _db.deleteDocument(DB, C().social_follows, res.documents[0].$id);
    }
  }

  async function isFollowing(targetId) {
    const me = await getMe();
    if (!me) return false;
    const res = await _db.listDocuments(DB, C().social_follows, [
      Query.equal('followerId', me.$id),
      Query.equal('followingId', targetId),
      Query.limit(1),
    ]);
    return res.documents.length > 0;
  }

  async function getFollowCounts(userId) {
    const [followers, following] = await Promise.all([
      _db.listDocuments(DB, C().social_follows, [Query.equal('followingId', userId), Query.limit(1)]),
      _db.listDocuments(DB, C().social_follows, [Query.equal('followerId',  userId), Query.limit(1)]),
    ]);
    return { followers: followers.total, following: following.total };
  }

  async function listFollowers(userId) {
    const res = await _db.listDocuments(DB, C().social_follows, [
      Query.equal('followingId', userId), Query.limit(50),
    ]);
    return res.documents.map(f => f.followerId);
  }

  /* ── Profile ───────────────────────────────────────────── */

  async function getProfile(userId) {
    try { return await _db.getDocument(DB, C().users, userId); } catch(_) { return null; }
  }

  async function getPostCount(userId) {
    const res = await _db.listDocuments(DB, C().social_posts, [
      Query.equal('userId', userId), Query.limit(1),
    ]);
    return res.total;
  }

  /* ── Exports ───────────────────────────────────────────── */
  window.SocialData = {
    getMe, nexusHandle, userColor,
    isLiked, isCommentLiked,
    createPost, listFeed, listFollowingFeed, getUserPosts, getPost, deletePost,
    likePost, unlikePost,
    likeComment, unlikeComment,
    listComments, createComment,
    followUser, unfollowUser, isFollowing, getFollowCounts, listFollowers,
    getProfile, getPostCount,
  };
})();
