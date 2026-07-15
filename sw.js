/* ─────────────────────────────────────────────────────────────
   sw.js — RETIRED.

   The caching service worker fought the hub's live-sync model: an
   installed app could keep serving a stale cached copy, so it stopped
   matching the website (old layout, old text, no sync). This version
   does the opposite of caching — it tears the old worker down:

     • deletes every cache it created,
     • unregisters itself,
     • reloads any open app windows so they load live content.

   New pages no longer register a service worker at all (see inject.py).
   Already-installed apps pick this file up on their next launch (the
   browser update-checks sw.js), self-heal, and go back to tracking the
   live site. Freshness is handled by per-version asset cache-busting +
   the version.txt self-heal check, which need no service worker.
   ───────────────────────────────────────────────────────────── */
self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    } catch (err) {}
    try { await self.registration.unregister(); } catch (err) {}
    try {
      var cls = await self.clients.matchAll({ type: 'window' });
      cls.forEach(function (c) { try { c.navigate(c.url); } catch (e) {} });
    } catch (err) {}
  })());
});

// Never serve from cache — always hit the network.
self.addEventListener('fetch', function () {});
