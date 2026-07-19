/* ============================================================
   RONYX · setup.js
   Builds the entire Appwrite backend in one run:
     • 1 database
     • 8 collections (with attributes + indexes)
     • 1 storage bucket

   RUN ONCE:
     cd setup
     cp .env.example .env      (then fill in .env)
     npm install
     npm run setup

   Safe to re-run — anything that already exists is skipped.
   ============================================================ */

require('dotenv').config();
const {
  Client, Databases, Storage, Permission, Role, IndexType,
} = require('node-appwrite');

// ---- connect (uses the SECRET key — server side only) ----
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const storage   = new Storage(client);

const DB = 'ronyx';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// swallow "already exists" (409) so the script is re-runnable
async function safe(label, fn) {
  try { await fn(); console.log('  ✓', label); }
  catch (e) {
    if (e.code === 409) console.log('  • exists:', label);
    else console.log('  ✗', label, '→', e.message);
  }
}

// ---- attribute helpers ----
const aStr  = (c, k, size, req = false, def = undefined) => safe(`${c}.${k}`, () => databases.createStringAttribute(DB, c, k, size, req, def));
const aInt  = (c, k, req = false, def = undefined) => safe(`${c}.${k}`, () => databases.createIntegerAttribute(DB, c, k, req, undefined, undefined, def));
const aFloat= (c, k, req = false, def = undefined) => safe(`${c}.${k}`, () => databases.createFloatAttribute(DB, c, k, req, undefined, undefined, def));
const aBool = (c, k, req = false, def = undefined) => safe(`${c}.${k}`, () => databases.createBooleanAttribute(DB, c, k, req, def));
const aDate = (c, k, req = false) => safe(`${c}.${k}`, () => databases.createDatetimeAttribute(DB, c, k, req));
const aEnum = (c, k, els, req = false, def = undefined) => safe(`${c}.${k}`, () => databases.createEnumAttribute(DB, c, k, els, req, def));

// per-user collections: each document is owned by its creator (set in data.js)
const ownerPerms = [ Permission.create(Role.users()) ];
// shared content students can read; writes happen via admin/functions later
const sharedPerms = [
  Permission.read(Role.users()),
  Permission.create(Role.users()),   // permissive for development — lock down later with Teams
  Permission.update(Role.users()),
  Permission.delete(Role.users()),
];

async function run() {
  console.log('\n▶ Creating database…');
  await safe('database ronyx', () => databases.create(DB, 'Ronyx'));

  console.log('\n▶ Creating collections…');
  await safe('users',         () => databases.createCollection(DB, 'users',         'Users',         ownerPerms,  true));
  await safe('exams',         () => databases.createCollection(DB, 'exams',         'Exams',         sharedPerms, false));
  await safe('questions',     () => databases.createCollection(DB, 'questions',     'Questions',     sharedPerms, false));
  await safe('attempts',      () => databases.createCollection(DB, 'attempts',      'Attempts',      ownerPerms,  true));
  await safe('results',       () => databases.createCollection(DB, 'results',       'Results',       ownerPerms,  true));
  await safe('drafts',        () => databases.createCollection(DB, 'drafts',        'Drafts',        ownerPerms,  true));
  await safe('notifications', () => databases.createCollection(DB, 'notifications', 'Notifications', ownerPerms,  true));
  await safe('notes',         () => databases.createCollection(DB, 'notes',         'Notes',         ownerPerms,  true));
  await safe('books',         () => databases.createCollection(DB, 'books',         'Books',         sharedPerms, false));
  await safe('equations',     () => databases.createCollection(DB, 'equations',     'Equations',     sharedPerms, false));

  console.log('\n▶ users attributes…');
  await aStr('users','name',128,true);
  await aStr('users','email',256,true);
  await aEnum('users','role',['student','lecturer','dept_admin','faculty_admin','super_admin','examiner','moderator','invigilator','candidate'],false,'student');
  await aStr('users','department',128);
  await aStr('users','faculty',128);
  await aStr('users','institution',128);
  await aStr('users','avatar',512);
  await aInt('users','level',false,1);          // Year 1–5

  console.log('\n▶ exams attributes…');
  await aStr('exams','title',256,true);
  await aStr('exams','courseCode',64);
  await aEnum('exams','type',['final','mid','quiz','practice','assignment','ca'],false,'quiz');
  await aInt('exams','durationMinutes',false,60);
  await aInt('exams','totalMarks',false,0);
  await aInt('exams','questionsCount',false,0);
  await aDate('exams','startAt');
  await aDate('exams','endAt');
  await aStr('exams','instructions',5000);
  await aEnum('exams','status',['draft','published','closed'],false,'draft');
  await aInt('exams','passMark',false,50);
  await aBool('exams','negativeMarking',false,false);
  await aBool('exams','shuffle',false,false);
  await aInt('exams','maxAttempts',false,1);
  await aStr('exams','accessCode',64);
  await aStr('exams','createdBy',64);
  await aInt('exams','level',false,0);          // Year 1–5 (0 = all years)

  console.log('\n▶ questions attributes…');
  await aStr('questions','examId',64,true);
  await aEnum('questions','type',['mcq','multi','truefalse','theory','fill','match','upload'],false,'mcq');
  await aStr('questions','text',500000,true);
  await aStr('questions','options',500000);      // JSON string of choices
  await aStr('questions','correctAnswer',500000);
  await aInt('questions','marks',false,1);
  await aEnum('questions','difficulty',['easy','medium','hard'],false,'medium');
  await aStr('questions','topic',128);
  await aStr('questions','subject',128);
  await aStr('questions','tags',512);

  console.log('\n▶ attempts attributes…');
  await aStr('attempts','examId',64,true);
  await aStr('attempts','userId',64,true);
  await aEnum('attempts','status',['in_progress','submitted','marked'],false,'in_progress');
  await aStr('attempts','answers',1000000);       // JSON string of all answers
  await aDate('attempts','startedAt');
  await aDate('attempts','submittedAt');
  await aInt('attempts','score',false,0);

  console.log('\n▶ results attributes…');
  await aStr('results','attemptId',64,true);
  await aStr('results','examId',64,true);
  await aStr('results','userId',64,true);
  await aInt('results','score',false,0);
  await aInt('results','totalMarks',false,0);
  await aFloat('results','percentage',false,0);
  await aStr('results','grade',8);
  await aInt('results','rank',false,0);
  await aStr('results','breakdown',20000);        // JSON of per-question analysis
  await aBool('results','published',false,false);

  console.log('\n▶ drafts attributes (autosave)…');
  await aStr('drafts','key',256,true);
  await aStr('drafts','value',1000000);
  await aStr('drafts','userId',64);
  await aDate('drafts','updatedAt');

  console.log('\n▶ notifications attributes…');
  await aStr('notifications','userId',64,true);
  await aStr('notifications','title',256,true);
  await aStr('notifications','body',1000);
  await aStr('notifications','type',32);
  await aBool('notifications','read',false,false);
  await aDate('notifications','createdAt');

  console.log('\n▶ notes attributes…');
  await aStr('notes','userId',64,true);
  await aStr('notes','examId',64);
  await aStr('notes','title',256);
  await aStr('notes','content',20000);
  await aEnum('notes','kind',['note','flashcard','plan'],false,'note');

  console.log('\n▶ books attributes…');
  await aStr('books','title',256,true);
  await aStr('books','author',128);
  await aStr('books','subject',128);
  await aStr('books','cover',16);          // emoji
  await aStr('books','summary',60000);     // the AI summary
  await aStr('books','takeaways',5000);    // JSON array of key points
  await aInt('books','readMinutes',false,10);
  await aInt('books','pages',false,0);
  await aStr('books','fileId',64);         // PDF in storage
  await aStr('books','faculty',256);
  await aStr('books','department',256);
  await aStr('books','courseCode',64);
  await aStr('books','category',64);       // e.g. "books","summaries","research","materials","notes","past"

  console.log('\n▶ equations attributes…');
  await aStr('equations','name',128,true);
  await aStr('equations','category',64);
  await aStr('equations','latex',1000,true);

  // attributes are processed asynchronously — wait before indexing
  console.log('\n⏳ waiting for attributes to be ready…');
  await sleep(8000);

  console.log('\n▶ indexes…');
  await safe('exams.byStatus',        () => databases.createIndex(DB,'exams','byStatus',IndexType.Key,['status']));
  await safe('questions.byExam',      () => databases.createIndex(DB,'questions','byExam',IndexType.Key,['examId']));
  await safe('attempts.byUser',       () => databases.createIndex(DB,'attempts','byUser',IndexType.Key,['userId']));
  await safe('results.byUser',        () => databases.createIndex(DB,'results','byUser',IndexType.Key,['userId']));
  await safe('drafts.byKeyUser',      () => databases.createIndex(DB,'drafts','byKeyUser',IndexType.Key,['key','userId']));
  await safe('notifications.byUser',  () => databases.createIndex(DB,'notifications','byUser',IndexType.Key,['userId']));

  /* Patch: notifications was created with ownerOnly (create-only).
     Appwrite checks collection-level READ before any operation — without it,
     all createDocument calls return 401.  updateCollection is idempotent. */
  console.log('\n▶ patching notifications permissions…');
  try {
    await databases.updateCollection(DB, 'notifications', 'Notifications', [
      Permission.read(Role.users()),
      Permission.create(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ], true);
    console.log('  ✓ notifications.permissions');
  } catch(e) { console.log('  ✗ notifications.permissions →', e.message); }
  await safe('notes.byUser',          () => databases.createIndex(DB,'notes','byUser',IndexType.Key,['userId']));
  await safe('books.bySubject',        () => databases.createIndex(DB,'books','bySubject',IndexType.Key,['subject']));
  await safe('equations.byCategory',   () => databases.createIndex(DB,'equations','byCategory',IndexType.Key,['category']));

  console.log('\n▶ storage bucket…');
  await safe('uploads bucket', () => storage.createBucket(
    'uploads', 'Uploads',
    [ Permission.read(Role.users()), Permission.create(Role.users()) ],
    true,                    // file-level security
    true,                    // enabled
    10485760,                // 10 MB
    ['pdf','doc','docx','jpg','jpeg','png'],
  ));

  console.log('\n✅ Done. Backend is built.');
  console.log('Next: put your ENDPOINT + PROJECT_ID into js/config.js and set CONFIGURED: true.\n');
}

run();
