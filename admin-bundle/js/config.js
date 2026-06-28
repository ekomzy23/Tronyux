/* ============================================================
   RONYX ADMIN · config.js
   ============================================================ */

window.RONYX_CONFIG = {
  CONFIGURED: true,
  ENDPOINT:   'https://nyc.cloud.appwrite.io/v1',
  PROJECT_ID: '6a332fd80025b72ea503',

  /* Only this email can sign in as admin */
  ADMIN_EMAIL: 'tor704057@gmail.com',

  REQUIRE_ADMIN_TEAM: false,

  DATABASE_ID: '6a371466003655df6e05',
  COLLECTIONS: {
    users:'users', exams:'exams', questions:'questions', attempts:'attempts',
    results:'results', drafts:'drafts', notifications:'notifications',
    notes:'notes', books:'books',
  },
  BUCKETS: { uploads:'uploads' },
};
