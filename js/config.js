/* ============================================================
   RUNYX · config.js
   YOUR FRONTEND "ENV" FILE — this is the one place you edit.

   These values are PUBLIC by design and safe to expose in the browser.
   Security is enforced by Appwrite Platforms + collection permissions.

   The IDs below already match what setup.js creates, so after you
   run the backend setup you only need to fill in 3 things:
     • ENDPOINT
     • PROJECT_ID
     • CONFIGURED: true

   Load BEFORE appwrite.js / data.js:
     <script src="/js/config.js"></script>
   ============================================================ */

window.RUNYX_CONFIG = {

  // Flip to true once ENDPOINT + PROJECT_ID are filled in.
  CONFIGURED: true,

  // From Appwrite → Overview (Settings)
  ENDPOINT:   'https://nyc.cloud.appwrite.io/v1',
  PROJECT_ID: '6a332fd80025b72ea503',

  // These match setup.js — no need to change them.
  DATABASE_ID: '6a371466003655df6e05',
  COLLECTIONS: {
    users:         'users',
    exams:         'exams',
    questions:     'questions',
    attempts:      'attempts',
    results:       'results',
    drafts:        'drafts',
    notifications: 'notifications',
    notes:         'notes',
    books:         'books',
  },
  BUCKETS: {
    uploads: 'uploads',
  },
};
