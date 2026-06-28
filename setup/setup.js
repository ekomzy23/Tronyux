/* ============================================================
   RONYX · setup.js  (comprehensive — run to build or repair)
   Creates database, all collections, all attributes, indexes,
   and the uploads storage bucket.

   Safe to re-run — existing resources are skipped or updated.

   Run:
     cd setup && node setup.js
   ============================================================ */

require('dotenv').config();
const { Client, Databases, Storage, Permission, Role, IndexType } = require('node-appwrite');

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT   || 'https://nyc.cloud.appwrite.io/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID  || '6a332fd80025b72ea503')
  .setKey(process.env.APPWRITE_API_KEY);

const dbs = new Databases(client);
const str = new Storage(client);

// Must match js/config.js  DATABASE_ID
const DB = process.env.APPWRITE_DATABASE_ID || '6a371466003655df6e05';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function safe(label, fn) {
  try { const r = await fn(); console.log('  ✓', label); return r; }
  catch (e) {
    if (e.code === 409) console.log('  · skip (exists):', label);
    else                console.log('  ✗ FAIL:', label, '→', e.message);
  }
}

/* ---- attribute helpers ---- */
const aStr   = (c,k,sz,req=false,def=undefined)   => safe(`${c}.${k}`, () => dbs.createStringAttribute(DB,c,k,sz,req,def));
const aInt   = (c,k,req=false,def=undefined)       => safe(`${c}.${k}`, () => dbs.createIntegerAttribute(DB,c,k,req,undefined,undefined,def));
const aFloat = (c,k,req=false,def=undefined)       => safe(`${c}.${k}`, () => dbs.createFloatAttribute(DB,c,k,req,undefined,undefined,def));
const aBool  = (c,k,req=false,def=undefined)       => safe(`${c}.${k}`, () => dbs.createBooleanAttribute(DB,c,k,req,def));
const aDate  = (c,k,req=false)                     => safe(`${c}.${k}`, () => dbs.createDatetimeAttribute(DB,c,k,req));

/* Create enum; if it exists try to update it to include new values */
async function aEnum(c, k, vals, req=false, def=undefined) {
  try {
    await dbs.createEnumAttribute(DB, c, k, vals, req, def);
    console.log('  ✓', `${c}.${k}`);
  } catch(e) {
    if (e.code === 409) {
      try {
        await dbs.updateEnumAttribute(DB, c, k, vals, req, def);
        console.log('  ↑ updated enum:', `${c}.${k}`);
      } catch(e2) {
        console.log('  · skip enum (exists):', `${c}.${k}`);
      }
    } else {
      console.log('  ✗', `${c}.${k}`, '→', e.message);
    }
  }
}

/* ---- permissions ---- */
const shared    = [
  Permission.read(Role.users()),
  Permission.create(Role.users()),
  Permission.update(Role.users()),
  Permission.delete(Role.users()),
];
const ownerOnly = [Permission.create(Role.users())];  // doc-level security handles read/update/delete

async function run() {
  console.log('\n══════════════════════════════════════');
  console.log('  RONYX · Appwrite Backend Setup');
  console.log('══════════════════════════════════════');
  console.log('  Endpoint :', process.env.APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1');
  console.log('  Project  :', process.env.APPWRITE_PROJECT_ID || '6a332fd80025b72ea503');
  console.log('  Database :', DB);
  console.log();

  /* ---- Database ---- */
  console.log('▶ database…');
  await safe('database', () => dbs.create(DB, 'Ronyx'));

  /* ---- Collections ---- */
  console.log('\n▶ collections…');
  await safe('users',         () => dbs.createCollection(DB,'users',        'Users',         shared,    true));
  await safe('exams',         () => dbs.createCollection(DB,'exams',        'Exams',         shared,    false));
  await safe('questions',     () => dbs.createCollection(DB,'questions',    'Questions',     shared,    false));
  await safe('attempts',      () => dbs.createCollection(DB,'attempts',     'Attempts',      ownerOnly, true));
  await safe('results',       () => dbs.createCollection(DB,'results',      'Results',       ownerOnly, true));
  await safe('drafts',        () => dbs.createCollection(DB,'drafts',       'Drafts',        ownerOnly, true));
  await safe('notifications', () => dbs.createCollection(DB,'notifications','Notifications', ownerOnly, true));
  await safe('notes',         () => dbs.createCollection(DB,'notes',        'Notes',         ownerOnly, true));
  await safe('books',         () => dbs.createCollection(DB,'books',        'Books',         shared,    false));

  /* ---- USERS ---- */
  console.log('\n▶ users attributes…');
  await aStr('users','name',128,true);
  await aStr('users','email',256,true);
  await aEnum('users','role',
    ['student','lecturer','dept_admin','faculty_admin','super_admin','examiner','moderator','invigilator'],
    false,'student');
  await aStr('users','department',256);
  await aStr('users','faculty',128);
  await aStr('users','institution',256);
  await aStr('users','avatar',512);
  await aInt('users','level',false,1);
  await aStr('users','phone',32);
  await aStr('users','bio',500);

  /* ---- EXAMS ---- */
  console.log('\n▶ exams attributes…');
  await aStr('exams','title',256,true);
  await aStr('exams','courseCode',64);
  await aEnum('exams','type',
    ['final','mid','quiz','practice','assignment','ca'],false,'quiz');
  await aInt('exams','durationMinutes',false,60);
  await aInt('exams','totalMarks',false,0);
  await aInt('exams','questionsCount',false,0);
  await aDate('exams','startAt');
  await aDate('exams','endAt');
  await aStr('exams','instructions',5000);
  await aEnum('exams','status',
    ['draft','published','live','closed','archived'],false,'draft');
  await aInt('exams','passMark',false,50);
  await aBool('exams','negativeMarking',false,false);
  await aBool('exams','shuffle',false,false);
  await aInt('exams','maxAttempts',false,1);
  await aStr('exams','accessCode',64);
  await aStr('exams','createdBy',64);
  await aInt('exams','level',false,0);
  await aStr('exams','department',256);
  await aInt('exams','semester',false,0);
  await aStr('exams','subject',256);
  await aStr('exams','academicYear',32);
  await aStr('exams','faculty',256);
  await aEnum('exams','format',['mixed','objective','theory'],false,'mixed');
  await aStr('exams','description',1000);

  /* ---- QUESTIONS ---- */
  console.log('\n▶ questions attributes…');
  await aStr('questions','examId',64,true);
  await aEnum('questions','type',
    ['mcq','multi','truefalse','theory','fill','matching','ordering',
     'programming','mathematical','image','audio','upload'],
    false,'mcq');
  await aStr('questions','text',5000,true);
  await aStr('questions','options',10000);
  await aStr('questions','correctAnswer',5000);
  await aFloat('questions','marks',false,1);
  await aEnum('questions','difficulty',['easy','medium','hard'],false,'medium');
  await aStr('questions','topic',256);
  await aStr('questions','subject',128);
  await aStr('questions','tags',512);
  await aEnum('questions','status',['draft','published','archived'],false,'draft');
  await aStr('questions','outcome',256);
  await aStr('questions','explanation',3000);

  /* ---- ATTEMPTS ---- */
  console.log('\n▶ attempts attributes…');
  await aStr('attempts','examId',64,true);
  await aStr('attempts','userId',64,true);
  await aEnum('attempts','status',['in_progress','submitted','marked'],false,'in_progress');
  await aStr('attempts','answers',1000000);
  await aDate('attempts','startedAt');
  await aDate('attempts','submittedAt');
  await aFloat('attempts','score',false,0);

  /* ---- RESULTS ---- */
  console.log('\n▶ results attributes…');
  await aStr('results','attemptId',64,true);
  await aStr('results','examId',64,true);
  await aStr('results','userId',64,true);
  await aFloat('results','score',false,0);
  await aFloat('results','totalMarks',false,0);
  await aFloat('results','percentage',false,0);
  await aStr('results','grade',8);
  await aInt('results','rank',false,0);
  await aStr('results','breakdown',50000);
  await aBool('results','published',false,false);
  await aDate('results','completedAt');

  /* ---- DRAFTS ---- */
  console.log('\n▶ drafts attributes…');
  await aStr('drafts','key',256,true);
  await aStr('drafts','value',1000000);
  await aStr('drafts','userId',64);
  await aDate('drafts','updatedAt');

  /* ---- NOTIFICATIONS ---- */
  console.log('\n▶ notifications attributes…');
  await aStr('notifications','userId',64,true);
  await aStr('notifications','title',256,true);
  await aStr('notifications','body',2000);
  await aStr('notifications','type',32);
  await aBool('notifications','read',false,false);
  await aStr('notifications','link',512);
  /* year: 0 = all students, 1-5 = specific year only */
  await aInt('notifications','year',false,0);

  /* ---- NOTES ---- */
  console.log('\n▶ notes attributes…');
  await aStr('notes','userId',64,true);
  await aStr('notes','examId',64);
  await aStr('notes','title',256);
  await aStr('notes','content',100000);
  await aEnum('notes','kind',['note','flashcard','plan'],false,'note');
  await aDate('notes','updatedAt');

  /* ---- BOOKS ---- */
  console.log('\n▶ books attributes…');
  await aStr('books','title',256,true);
  await aStr('books','author',128);
  await aStr('books','subject',128);
  await aStr('books','cover',16);
  await aStr('books','summary',100000);
  await aStr('books','takeaways',10000);
  await aInt('books','readMinutes',false,10);
  await aInt('books','pages',false,0);
  await aStr('books','fileId',64);
  await aStr('books','downloadUrl',512);
  await aStr('books','faculty',256);
  await aStr('books','department',256);
  await aStr('books','courseCode',64);

  /* ---- wait for async attribute processing ---- */
  console.log('\n⏳ waiting 12 s for attributes to be ready before indexing…');
  await sleep(12000);

  /* ---- INDEXES ---- */
  console.log('\n▶ indexes…');
  await safe('users.byRole',          () => dbs.createIndex(DB,'users','byRole',IndexType.Key,['role']));
  await safe('users.byDept',          () => dbs.createIndex(DB,'users','byDept',IndexType.Key,['department']));
  await safe('exams.byStatus',        () => dbs.createIndex(DB,'exams','byStatus',IndexType.Key,['status']));
  await safe('exams.byLevel',         () => dbs.createIndex(DB,'exams','byLevel',IndexType.Key,['level']));
  await safe('exams.byStatusLevel',   () => dbs.createIndex(DB,'exams','byStatusLevel',IndexType.Key,['status','level']));
  await safe('questions.byExam',      () => dbs.createIndex(DB,'questions','byExam',IndexType.Key,['examId']));
  await safe('questions.byType',      () => dbs.createIndex(DB,'questions','byType',IndexType.Key,['type']));
  await safe('questions.byStatus',    () => dbs.createIndex(DB,'questions','byStatus',IndexType.Key,['status']));
  await safe('questions.byExamType',  () => dbs.createIndex(DB,'questions','byExamType',IndexType.Key,['examId','type']));
  await safe('attempts.byUser',       () => dbs.createIndex(DB,'attempts','byUser',IndexType.Key,['userId']));
  await safe('attempts.byExam',       () => dbs.createIndex(DB,'attempts','byExam',IndexType.Key,['examId']));
  await safe('attempts.byStatus',     () => dbs.createIndex(DB,'attempts','byStatus',IndexType.Key,['status']));
  await safe('results.byUser',        () => dbs.createIndex(DB,'results','byUser',IndexType.Key,['userId']));
  await safe('results.byExam',        () => dbs.createIndex(DB,'results','byExam',IndexType.Key,['examId']));
  await safe('drafts.byKey',          () => dbs.createIndex(DB,'drafts','byKey',IndexType.Key,['key']));
  await safe('notifications.byUser',  () => dbs.createIndex(DB,'notifications','byUser',IndexType.Key,['userId']));
  await safe('notifications.byRead',  () => dbs.createIndex(DB,'notifications','byRead',IndexType.Key,['userId','read']));

  /* ── Fix notifications collection permissions ──────────────────────────────
     The collection was originally created with ownerOnly (no read permission).
     Appwrite checks collection-level permissions BEFORE document-level ones —
     students got 401 because they couldn't even query the collection.
     This updateCollection call is idempotent — safe to re-run any time.
     Students can now list the collection; document-level permissions still
     control which individual documents they can actually see. */
  console.log('\n▶ patching notifications collection permissions…');
  await safe('notifications.fixPerms', () => dbs.updateCollection(
    DB, 'notifications', 'Notifications',
    [
      Permission.read(Role.users()),          /* all logged-in users can query */
      Permission.create(Role.users()),        /* doc-level perms gate creation */
      Permission.update(Role.users()),        /* for marking read */
      Permission.delete(Role.label('admin')), /* only admin deletes */
    ],
    true   /* documentSecurity: keep ON so individual doc perms still apply */
  ));
  await safe('notes.byUser',          () => dbs.createIndex(DB,'notes','byUser',IndexType.Key,['userId']));
  await safe('books.bySubject',       () => dbs.createIndex(DB,'books','bySubject',IndexType.Key,['subject']));
  await safe('books.byFaculty',       () => dbs.createIndex(DB,'books','byFaculty',IndexType.Key,['faculty']));
  await safe('books.byDept',          () => dbs.createIndex(DB,'books','byDept',IndexType.Key,['department']));

  /* ---- STORAGE BUCKET ---- */
  console.log('\n▶ storage bucket…');
  await safe('uploads', () => str.createBucket(
    'uploads', 'Uploads',
    [
      Permission.read(Role.users()),
      Permission.create(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ],
    false,        // file-level security off  (collection-level perms above apply)
    true,         // enabled
    10485760,     // 10 MB max file size
    ['pdf','doc','docx','jpg','jpeg','png','gif','mp3','mp4','webm','ogg'],
    undefined,    // compression (default)
    true,         // encryption
    false,        // antivirus
  ));

  console.log('\n══════════════════════════════════════');
  console.log('  ✅ Backend setup complete!');
  console.log('══════════════════════════════════════');
  console.log('\n  Database ID  :', DB);
  console.log('  Collections  : users, exams, questions, attempts,');
  console.log('                 results, drafts, notifications, notes, books');
  console.log('  Storage      : uploads (10 MB — PDF/DOC/IMG/audio/video)\n');
}

run().catch(e => {
  console.error('\n✗ Fatal error:', e.message);
  process.exit(1);
});
