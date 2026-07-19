/* ============================================================
   RONYX · setup-launch.js
   Adds the three "Launch" feature collections to your Appwrite
   backend:  competitions  ·  study_rooms  ·  points_ledger
   Also adds  points  and  paystackEmail  to the users collection.

   Safe to re-run — existing attributes/indexes are skipped.

   Run from the setup folder:
     node setup-launch.js
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

const aStr  = (c, k, size, req = false, def = undefined) =>
  safe(`${c}.${k}`, () => databases.createStringAttribute(DB, c, k, size, req, def));
const aInt  = (c, k, req = false, def = undefined) =>
  safe(`${c}.${k}`, () => databases.createIntegerAttribute(DB, c, k, req, undefined, undefined, def));
const aBool = (c, k, req = false, def = undefined) =>
  safe(`${c}.${k}`, () => databases.createBooleanAttribute(DB, c, k, req, def));
const aDate = (c, k, req = false) =>
  safe(`${c}.${k}`, () => databases.createDatetimeAttribute(DB, c, k, req));
const aEnum = (c, k, els, req = false, def = undefined) =>
  safe(`${c}.${k}`, () => databases.createEnumAttribute(DB, c, k, els, req, def));

/* All three collections are readable by all logged-in users;
   writes are permissive during development — lock down with
   Appwrite Teams or Functions before public launch.           */
const openPerms = [
  Permission.read(Role.users()),
  Permission.create(Role.users()),
  Permission.update(Role.users()),
  Permission.delete(Role.users()),
];

async function run() {
  console.log('\n▶ Creating Launch collections…');
  await safe('competitions',  () => databases.createCollection(DB, 'competitions',  'Competitions',  openPerms, false));
  await safe('study_rooms',   () => databases.createCollection(DB, 'study_rooms',   'Study Rooms',   openPerms, false));
  await safe('points_ledger', () => databases.createCollection(DB, 'points_ledger', 'Points Ledger', openPerms, false));

  /* ── competitions ──────────────────────────────────────── */
  console.log('\n▶ competitions attributes…');
  await aStr ('competitions', 'title',            200,  true);
  await aStr ('competitions', 'description',      2000);
  await aStr ('competitions', 'examId',           64);        // which exam students compete on
  await aStr ('competitions', 'examTitle',        256);       // denormalised for fast display
  await aDate('competitions', 'startDate');
  await aDate('competitions', 'endDate');
  await aEnum('competitions', 'status',           ['draft','active','ended'], false, 'draft');
  await aStr ('competitions', 'prizeDescription', 500);
  await aInt ('competitions', 'pointsFirst',      false, 100);
  await aInt ('competitions', 'pointsSecond',     false, 50);
  await aInt ('competitions', 'pointsThird',      false, 25);
  await aInt ('competitions', 'pointsParticipant',false, 5);  // everyone who tries gets this
  await aInt ('competitions', 'eligibleLevel',    false, 0);  // 0 = all years
  await aStr ('competitions', 'bannerEmoji',      8,    false, '🏆');
  await aStr ('competitions', 'createdBy',        64);
  await aBool('competitions', 'pointsAwarded',    false, false); // flipped after top-3 payout

  /* ── study_rooms ───────────────────────────────────────── */
  console.log('\n▶ study_rooms attributes…');
  await aStr ('study_rooms', 'title',        200, true);
  await aStr ('study_rooms', 'description',  500);
  await aStr ('study_rooms', 'bookId',       64);
  await aStr ('study_rooms', 'bookTitle',    200);
  await aStr ('study_rooms', 'hostId',       64, true);
  await aStr ('study_rooms', 'hostName',     128);
  await aStr ('study_rooms', 'jitsiRoom',    120, true);   // unique Jitsi room slug
  await aEnum('study_rooms', 'status',       ['open','ended'], false, 'open');
  await aDate('study_rooms', 'scheduledAt');
  await aInt ('study_rooms', 'level',        false, 0);
  await aInt ('study_rooms', 'attendeeCount',false, 0);

  /* ── points_ledger ─────────────────────────────────────── */
  console.log('\n▶ points_ledger attributes…');
  await aStr ('points_ledger', 'userId',  64, true);
  await aInt ('points_ledger', 'points',  true);   // positive = earned, negative = redeemed
  await aStr ('points_ledger', 'reason',  200);
  await aEnum('points_ledger', 'type',    ['competition','exam_complete','study_room','referral','bonus','redemption'], false, 'bonus');
  await aStr ('points_ledger', 'refId',   64);     // competition or exam doc ID
  await aInt ('points_ledger', 'balance', false, 0);  // balance snapshot after this entry

  /* ── users — new fields ────────────────────────────────── */
  console.log('\n▶ users — adding points + paystackEmail…');
  await aInt('users', 'points',        false, 0);
  await aStr('users', 'paystackEmail', 256);

  console.log('\n⏳ waiting for attributes to propagate…');
  await sleep(8000);

  console.log('\n▶ indexes…');
  await safe('competitions.byStatus',
    () => databases.createIndex(DB,'competitions','byStatus',IndexType.Key,['status']));
  await safe('competitions.byExam',
    () => databases.createIndex(DB,'competitions','byExam',IndexType.Key,['examId']));
  await safe('study_rooms.byStatus',
    () => databases.createIndex(DB,'study_rooms','byStatus',IndexType.Key,['status']));
  await safe('study_rooms.byHost',
    () => databases.createIndex(DB,'study_rooms','byHost',IndexType.Key,['hostId']));
  await safe('points_ledger.byUser',
    () => databases.createIndex(DB,'points_ledger','byUser',IndexType.Key,['userId']));
  await safe('points_ledger.byType',
    () => databases.createIndex(DB,'points_ledger','byUserType',IndexType.Key,['userId','type']));

  console.log('\n✅  Launch schema ready.');
  console.log('Next: add the three collection IDs to COLLECTIONS in js/config.js,');
  console.log('      then run your app and open /pages/student/launch/competitions.html\n');
}

run();
