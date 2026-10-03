/*
 * OWNER: engagement module. Loaded into the service worker (vite.config.js → workbox.importScripts).
 *
 *   push              show the notification the server sent (services/pushChannel.js → buildPushPayload)
 *   notificationclick open the app at the notification's link, reusing an open tab when there is one
 *
 * Payload: { title, body, url, tag, notificationId, icon, badge, timestamp }. Only same-origin
 * paths are opened, whatever the payload says.
 */
/* global clients */

(function () {
  var DEFAULT_TITLE = "Kovij Fitness Zone";
  var DEFAULT_URL = "/member/dashboard";
  var ICON = "/icons/icon-192.png";
  // Android draws the badge from transparency only: the white K alone (scripts/generate-icons.mjs).
  var BADGE = "/icons/badge-96.png";

  function readPayload(event) {
    if (!event.data) return {};
    try {
      return event.data.json() || {};
    } catch (e) {
      return { body: event.data.text() };
    }
  }

  function safePath(value) {
    try {
      var url = new URL(value || DEFAULT_URL, self.location.origin);
      return url.origin === self.location.origin ? url.pathname + url.search + url.hash : DEFAULT_URL;
    } catch (e) {
      return DEFAULT_URL;
    }
  }

  self.addEventListener("push", function (event) {
    var data = readPayload(event);
    var title = String(data.title || DEFAULT_TITLE).slice(0, 120);
    var options = {
      body: String(data.body || "").slice(0, 240),
      icon: data.icon || ICON,
      badge: data.badge || BADGE,
      data: { url: safePath(data.url), notificationId: data.notificationId || null },
      timestamp: Number(data.timestamp) || Date.now(),
    };
    // Same kind replaces the previous one (e.g. a newer payment reminder) instead of stacking.
    if (data.tag) {
      options.tag = String(data.tag);
      options.renotify = true;
    }
    event.waitUntil(self.registration.showNotification(title, options));
  });

  self.addEventListener("notificationclick", function (event) {
    event.notification.close();
    var path = safePath(event.notification.data && event.notification.data.url);
    var target = new URL(path, self.location.origin).href;

    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windows) {
        // 1. A tab already on that page: focus it.
        for (var i = 0; i < windows.length; i += 1) {
          if (windows[i].url === target && "focus" in windows[i]) return windows[i].focus();
        }
        // 2. Any tab of the app: take it there.
        for (var j = 0; j < windows.length; j += 1) {
          var w = windows[j];
          if (new URL(w.url).origin === self.location.origin && "navigate" in w) {
            return w
              .navigate(target)
              .then(function (client) {
                return (client || w).focus();
              })
              .catch(function () {
                return clients.openWindow(target);
              });
          }
        }
        // 3. Nothing open: open a new window.
        return clients.openWindow(target);
      })
    );
  });
})();
