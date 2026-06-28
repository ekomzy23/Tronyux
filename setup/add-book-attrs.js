'use strict';
/* Adds the 3 missing books attributes: faculty, department, courseCode */
require('dotenv').config();
const { Client, Databases } = require('node-appwrite');

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT  || 'https://nyc.cloud.appwrite.io/v1')
  .setProject(process.env.APPWRITE_PROJECT_ID || '6a332fd80025b72ea503')
  .setKey(process.env.APPWRITE_API_KEY);

const dbs = new Databases(client);
const DB  = process.env.APPWRITE_DATABASE_ID || '6a371466003655df6e05';
const COL = 'books';

async function safe(label, fn) {
  try {
    await fn();
    console.log('  ✓', label);
  } catch (e) {
    if (e.code === 409) console.log('  · already exists:', label);
    else console.log('  ✗ FAILED:', label, '→', e.message);
  }
}

(async () => {
  console.log('\nAdding missing books attributes…\n');
  await safe('books.faculty',     () => dbs.createStringAttribute(DB, COL, 'faculty',     256, false));
  await safe('books.department',  () => dbs.createStringAttribute(DB, COL, 'department',  256, false));
  await safe('books.courseCode',  () => dbs.createStringAttribute(DB, COL, 'courseCode',  64,  false));

  /* Wait for attributes to become active before adding indexes */
  console.log('\nWaiting 10s for attributes to activate…');
  await new Promise(r => setTimeout(r, 10000));

  await safe('books.byFaculty', () => dbs.createIndex(DB, COL, 'byFaculty', 'key', ['faculty']));
  await safe('books.byDept',    () => dbs.createIndex(DB, COL, 'byDept',    'key', ['department']));

  console.log('\n✅ Done — faculty / department / courseCode are now in your database.\n');
})().catch(e => { console.error('\n✗ Fatal:', e.message); process.exit(1); });
