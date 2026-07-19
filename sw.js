/* ============================================================
   RONYX · sw.js — Service Worker
   Handles Web Push notifications so students receive instant
   alerts even when the browser is closed or the screen is off.
   ============================================================ */
'use strict';

self.addEventListener('install', function(e) { self.skipWaiting(); });
self.addEventListener('activate', function(e) { e.waitUntil(clients.claim()); });

/* ── Push received ── */
self.addEventListener('push', function(event) {
  var data = {};
  if (event.data) {
    try { data = event.data.json(); } catch(e) { data = { body: event.data.text() }; }
  }

  var title   = data.title || 'Ronyx';
  var options = {
    body:              data.body   || '',
    icon:              '/assets/icon-192.png',
    badge:             '/assets/icon-72.png',
    vibrate:           [200, 100, 200],
    tag:               data.tag   || 'ronyx-notif',
    renotify:          true,
    requireInteraction: false,
    data:              { url: data.link || '/pages/student/notifications.html' },
    actions: [
      { action: 'view',    title: 'View'    },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ── Notification clicked ── */
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;

  var url = (event.notification.data && event.notification.data.url)
            || '/pages/student/notifications.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url.indexOf(self.location.origin) === 0 && 'focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
