/* ============================================================
   migrate_question_size.js
   Increases character limits on the questions collection.

   Run from this folder:
     node migrate_question_size.js
   ============================================================ */

require('dotenv').config();
const { Client, Databases } = require('node-appwrite');

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const DB = '6a371466003655df6e05';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const ENDPOINT   = process.env.APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const API_KEY    = process.env.APPWRITE_API_KEY;

/* Use raw REST PATCH so we can see the full response */
async function patchAttr(attr, required, size) {
  const url = `${ENDPOINT}/databases/${DB}/collections/questions/attributes/string/${attr}`;
  const body = JSON.stringify({ required, default: required ? null : '', size });
  const res  = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type':  'application/json',
      'X-Appwrite-Project': PROJECT_ID,
      'X-Appwrite-Key':     API_KEY,
    },
    body,
  });
  const text = await res.text();
  if (res.ok) {
    console.log('  updated questions.' + attr + ' -> ' + size);
  } else {
    console.error('  FAILED questions.' + attr + ' [' + res.status + ']:', text.slice(0, 300));
  }
}

(async () => {
  console.log('Updating questions attribute sizes...\n');
  await patchAttr('text',          true,  500000); await sleep(800);
  await patchAttr('options',       false, 500000); await sleep(800);
  await patchAttr('correctAnswer', false, 500000); await sleep(800);
  await patchAttr('explanation',   false, 500000);
  console.log('\nDone.');
})();
