/* ─────────────────────────────────────────────────────────────
   sw.js — service worker for the installable hub.

   The deploy stamps __APP_VERSION__ into VERSION below, so each new
   deploy changes this file's bytes → the browser installs the new SW,
   wipes the old cache, and takes over immediately (skipWaiting +
   clients.claim). That's what makes the PWA update instantly.

   Strategy:
     • Navigations (HTML)   → network-first (new deploys land at once),
                              fall back to cache when offline.
     • Same-origin assets   → stale-while-revalidate (fast, self-updating).
     • Cross-origin (Firebase SDK, Google Fonts) and version.txt → never
       touched; they pass straight through.
   ───────────────────────────────────────────────────────────── */
var VERSION = '__APP_VERSION__';
var CACHE = 'hub-' + VERSION;

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.map(function (k) {
      return k === CACHE ? null : caches.delete(k);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;      // Firebase, fonts, etc.
  if (url.pathname.split('/').pop() === 'version.txt') return; // always fresh

  if (req.mode === 'navigate') {
    e.respondWith((async function () {
      try {
        var fresh = await fetch(req);
        var c = await caches.open(CACHE);
        c.put(req, fresh.clone());
        return fresh;
      } catch (err) {
        var cached = await caches.match(req);
        return cached || (await caches.match('./Hub.dc.html')) || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async function () {
    var cached = await caches.match(req);
    var network = fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        caches.open(CACHE).then(function (c) { c.put(req, res.clone()); });
      }
      return res;
    }).catch(function () { return cached; });
    return cached || network;
  })());
});
