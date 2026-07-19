/* ============================================================
   RONYX · setup-nexus.js
   Creates the Nexus chat collections:
     • nexus_rooms    — study room records
     • nexus_messages — real-time messages, polls, knowledge drops

   cd admin-bundle/setup
   node setup-nexus.js
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
const aBool = (c, k, req=false, def=undefined) =>
  safe(`${c}.${k}`, () => databases.createBooleanAttribute(DB, c, k, req, def));
const aDate = (c, k, req=false) =>
  safe(`${c}.${k}`, () => databases.createDatetimeAttribute(DB, c, k, req));
const aEnum = (c, k, els, req=false, def=undefined) =>
  safe(`${c}.${k}`, () => databases.createEnumAttribute(DB, c, k, els, req, def));

const openPerms = [
  Permission.read(Role.users()),
  Permission.create(Role.users()),
  Permission.update(Role.users()),
  Permission.delete(Role.users()),
];

async function run() {
  console.log('\n▶ Creating Nexus collections…');
  await safe('nexus_rooms',    () => databases.createCollection(DB, 'nexus_rooms',    'Nexus Rooms',    openPerms, false));
  await safe('nexus_messages', () => databases.createCollection(DB, 'nexus_messages', 'Nexus Messages', openPerms, false));

  /* ── nexus_rooms ──────────────────────────────────────── */
  console.log('\n▶ nexus_rooms attributes…');
  await aStr ('nexus_rooms', 'title',       200, true);
  await aStr ('nexus_rooms', 'subject',     200);         // study subject / topic
  await aStr ('nexus_rooms', 'emoji',       8,   false, '⬡');
  await aStr ('nexus_rooms', 'hostId',      64,  true);
  await aStr ('nexus_rooms', 'hostName',    128);
  await aInt ('nexus_rooms', 'level',       false, 0);
  await aEnum('nexus_rooms', 'status',      ['open','ended'], false, 'open');
  await aInt ('nexus_rooms', 'memberCount', false, 0);
  await aDate('nexus_rooms', 'lastActivity');

  /* ── nexus_messages ───────────────────────────────────── */
  console.log('\n▶ nexus_messages attributes…');
  await aStr ('nexus_messages', 'roomId',    64,     true);
  await aStr ('nexus_messages', 'userId',    64,     true);
  await aStr ('nexus_messages', 'userName',  128);
  await aStr ('nexus_messages', 'userColor', 20);          // hsl(…) color string
  await aStr ('nexus_messages', 'handle',    40);          // Nexus handle e.g. "Quasar-7"
  await aStr ('nexus_messages', 'text',      4000);
  await aEnum('nexus_messages', 'type',
    ['text','quiz','note','focus','drop','system','typing'], false, 'text');
  await aStr ('nexus_messages', 'extra',     4000);        // JSON for quiz data, etc.
  await aStr ('nexus_messages', 'reactions', 500);         // JSON: {"v0":3,"v1":1,"v2":0,"v3":2}
  await aBool('nexus_messages', 'pinned',    false, false);

  console.log('\n⏳ waiting for attributes…');
  await sleep(8000);

  console.log('\n▶ indexes…');
  await safe('nexus_rooms.byStatus',
    () => databases.createIndex(DB,'nexus_rooms','byStatus',IndexType.Key,['status']));
  await safe('nexus_messages.byRoom',
    () => databases.createIndex(DB,'nexus_messages','byRoom',IndexType.Key,['roomId']));
  await safe('nexus_messages.byRoomType',
    () => databases.createIndex(DB,'nexus_messages','byRoomType',IndexType.Key,['roomId','type']));

  console.log('\n✅  Nexus schema ready.');
}

run();
