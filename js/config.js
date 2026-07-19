/* ============================================================
   RONYX · config.js
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

window.RONYX_CONFIG = {

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
    /* Launch features — added by setup-launch.js */
    competitions:  'competitions',
    study_rooms:   'study_rooms',
    points_ledger: 'points_ledger',
    /* Nexus chat — added by setup-nexus.js */
    nexus_rooms:    'nexus_rooms',
    nexus_messages: 'nexus_messages',
    /* Social layer — added by setup-social.js */
    social_posts:    'social_posts',
    social_follows:  'social_follows',
    social_comments: 'social_comments',
  },

  /* Paystack — paste your PUBLIC key here when you're ready to enable payouts.
     Leave empty to keep the withdrawal UI hidden.                              */
  PAYSTACK_PUBLIC_KEY: '',
  BUCKETS: {
    uploads: 'uploads',
  },

  /* Web Push (VAPID) — run: npx web-push generate-vapid-keys
     Paste the PUBLIC key here. Store PRIVATE key + VAPID_EMAIL in Vercel env vars.
     Leave empty string to disable push (API route will no-op gracefully). */
  VAPID_PUBLIC_KEY: 'BMM8SNemvtt5TNK8sotNsRcOrP8k-sA6ktcgMOONepFlzqX1pMDr59PYajIaM1G9gVjHKOIqsFXzKcK3WAkm-7w',
};
