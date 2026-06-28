/* ============================================================
   RONYX · install.js
   ONE command to build everything.

   After you fill in setup/.env, run:
     cd setup
     npm install
     npm run backend      ← this file

   It runs setup.js (database, collections, indexes, storage)
   then seed.js (sample exams + questions) in order.
   ============================================================ */

const { execSync } = require('child_process');

function step(label, cmd) {
  console.log('\n========================================');
  console.log('▶ ' + label);
  console.log('========================================');
  execSync(cmd, { stdio: 'inherit' });
}

try {
  step('1/2  Building backend schema', 'node setup.js');
  step('2/2  Seeding data',            'node seed.js');
  console.log('\n✅ Everything is in your database.');
  console.log('Now set CONFIGURED: true in js/config.js and you are live.\n');
} catch (e) {
  console.error('\n✗ Something failed. Scroll up to see which step, fix it, and run again.');
  process.exit(1);
}
