/* ============================================================
   RONYX · setup-social.js
   Creates the social layer collections:
     • social_posts    — posts, notes, questions, formulas
     • social_follows  — follow relationships
     • social_comments — comments on posts

   cd admin-bundle/setup
   node setup-social.js
   ============================================================ */

require('dotenv').config();
const { Client, Databases, Permission, Role, IndexType } = require('node-appwrite');

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DB    = process.env.APPWRITE_DATABASE_ID || 'ronyx';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function safe(label, fn) {
  try   { await fn(); console.log('  ✓', label); }
  catch (e) {
    if (e.code === 409) console.log('  • exists:', label);
    else console.log('  ✗', label, '→', e.message);
  }
}

const aStr  = (c, k, sz, req=false, def=undefined) =>
  safe(`${c}.${k}`, () => databases.createStringAttribute(DB, c, k, sz, req, def));
const aInt  = (c, k, req=false, def=undefined) =>
  safe(`${c}.${k}`, () => databases.createIntegerAttribute(DB, c, k, req, undefined, undefined, def));
const aEnum = (c, k, els, req=false, def=undefined) =>
  safe(`${c}.${k}`, () => databases.createEnumAttribute(DB, c, k, els, req, def));

const openPerms = [
  Permission.read(Role.users()),
  Permission.create(Role.users()),
  Permission.update(Role.users()),
  Permission.delete(Role.users()),
];

async function run() {
  console.log('\n▶ Creating social collections…');
  await safe('social_posts',    () => databases.createCollection(DB, 'social_posts',    'Social Posts',    openPerms, false));
  await safe('social_follows',  () => databases.createCollection(DB, 'social_follows',  'Social Follows',  openPerms, false));
  await safe('social_comments', () => databases.createCollection(DB, 'social_comments', 'Social Comments', openPerms, false));

  /* ── social_posts ── */
  console.log('\n▶ social_posts attributes…');
  await aStr ('social_posts', 'userId',       64,   true);
  await aStr ('social_posts', 'userHandle',   40);
  await aStr ('social_posts', 'userColor',    20);
  await aStr ('social_posts', 'userName',     128);
  await aStr ('social_posts', 'content',      2000, true);
  await aEnum('social_posts', 'type', ['note','question','formula','tip'], false, 'note');
  await aStr ('social_posts', 'subject',      200);
  await aInt ('social_posts', 'likes',        false, 0);
  await aInt ('social_posts', 'commentCount', false, 0);

  /* ── social_follows ── */
  console.log('\n▶ social_follows attributes…');
  await aStr('social_follows', 'followerId',  64, true);
  await aStr('social_follows', 'followingId', 64, true);

  /* ── social_comments ── */
  console.log('\n▶ social_comments attributes…');
  await aStr('social_comments', 'postId',     64,   true);
  await aStr('social_comments', 'userId',     64,   true);
  await aStr('social_comments', 'userHandle', 40);
  await aStr('social_comments', 'userColor',  20);
  await aStr('social_comments', 'userName',   128);
  await aStr('social_comments', 'content',    1000, true);
  await aStr('social_comments', 'parentId',   64);       // reply-to comment ID
  await aInt('social_comments', 'likes',      false, 0); // comment like count

  console.log('\n⏳ waiting for attributes…');
  await sleep(8000);

  console.log('\n▶ indexes…');
  await safe('social_posts.byUser',
    () => databases.createIndex(DB,'social_posts','byUser',IndexType.Key,['userId']));
  await safe('social_posts.byCreated',
    () => databases.createIndex(DB,'social_posts','byCreated',IndexType.Key,['$createdAt']));
  await safe('social_follows.byFollower',
    () => databases.createIndex(DB,'social_follows','byFollower',IndexType.Key,['followerId']));
  await safe('social_follows.byFollowing',
    () => databases.createIndex(DB,'social_follows','byFollowing',IndexType.Key,['followingId']));
  await safe('social_follows.unique',
    () => databases.createIndex(DB,'social_follows','unique',IndexType.Unique,['followerId','followingId']));
  await safe('social_comments.byPost',
    () => databases.createIndex(DB,'social_comments','byPost',IndexType.Key,['postId']));
  await safe('social_comments.byParent',
    () => databases.createIndex(DB,'social_comments','byParent',IndexType.Key,['parentId']));

  console.log('\n✅  Social schema ready. Run setup-social.js once more if any index failed.');
}

run();
