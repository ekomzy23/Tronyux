/* ============================================================
   RONYX · api/push.js — Vercel Serverless Function
   Sends Web Push notifications to subscribed devices.

   Environment variables required (set in Vercel dashboard):
     VAPID_EMAIL       — e.g. mailto:you@example.com
     VAPID_PUBLIC_KEY  — from: npx web-push generate-vapid-keys
     VAPID_PRIVATE_KEY — from: npx web-push generate-vapid-keys
   ============================================================ */
'use strict';

const webpush = require('web-push');

module.exports = async function handler(req, res) {
  /* Only POST */
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  /* VAPID must be configured */
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_PUBLIC_KEY) {
    console.error('[push] VAPID keys not configured');
    return res.status(200).json({ sent: 0, failed: 0, reason: 'Push not configured — set VAPID env vars in Vercel.' });
  }

  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@ronyx.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  var body = req.body || {};
  var subscriptions = body.subscriptions;
  var title  = body.title  || 'Ronyx';
  var msg    = body.body   || '';
  var link   = body.link   || '/pages/student/notifications.html';
  var tag    = body.tag    || 'ronyx-notif';

  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return res.status(200).json({ sent: 0, failed: 0, reason: 'No subscriptions provided' });
  }

  var payload = JSON.stringify({ title: title, body: msg, link: link, tag: tag });

  var results = await Promise.allSettled(
    subscriptions.map(function(sub) {
      return webpush.sendNotification(sub, payload, { TTL: 86400 });
    })
  );

  var sent   = results.filter(function(r) { return r.status === 'fulfilled'; }).length;
  var failed = results.filter(function(r) { return r.status === 'rejected';  }).length;

  console.log('[push] sent:', sent, 'failed:', failed);
  return res.status(200).json({ sent: sent, failed: failed });
};
