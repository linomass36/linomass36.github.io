/* ─────────────────────────────────────────────────────────────────────────
   sw.js — offline, without the staleness.

   HISTORY. This file used to be a cache-first service worker, and it was
   retired because cache-first is exactly the wrong strategy for a hub whose
   whole point is live data: an installed app kept serving yesterday's copy,
   so the phone showed an old layout, old text and no sync. The fix at the
   time was to tear the worker down entirely and register nothing.

   That fixed staleness and left a different hole: with no worker at all, a
   phone with no signal gets nothing. Not a stale page — a blank one. Every
   page, every asset, is a network fetch away.

   So this is the same idea from the other side. NETWORK-FIRST:

     • Online, every request goes to the network and the network's answer is
       what you see. There is no path by which a cached copy is preferred
       over a live one, which is the property the old worker lacked.
     • What comes back is copied into a cache as a side effect.
     • Offline — and only when the fetch actually fails — the cached copy is
       served. You get the hub as you last saw it rather than a dead tab.
     • The cache is named for the app version, so a deploy starts a new one
       and the old is deleted the moment the new worker activates.

   Two things are deliberately never cached: version.txt, because the
   self-heal check has to be able to learn that a new version exists, and
   anything on the Firestore API host, because sync must never be answered
   from a cache.
   ───────────────────────────────────────────────────────────────────────── */

var VERSION = '__APP_VERSION__';
var CACHE = 'ct-hub-' + VERSION;

// Hosts whose responses must always come from the network or not at all.
var NEVER = /(^|\.)googleapis\.com$|(^|\.)firebaseio\.com$|(^|\.)firebase\.googleapis\.com$/;

self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    } catch (err) {}
    try { await self.clients.claim(); } catch (err) {}
  })());
});

function offlinePage() {
  return new Response(
    '<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Offline</title>' +
    '<style>body{margin:0;min-height:100vh;display:flex;align-items:center;' +
    'justify-content:center;background:#F7F5F1;color:#55564F;' +
    'font:15px/1.6 -apple-system,system-ui,sans-serif;padding:32px;text-align:center}' +
    'b{display:block;font-size:19px;color:#26271F;margin-bottom:8px}' +
    'span{display:block;margin-top:14px;font:11px/1.5 ui-monospace,monospace;color:#A6A79F}</style>' +
    '<div><b>No connection</b>This page has not been opened on this device yet, ' +
    'so there is no copy to fall back on. Pages you have visited still open offline.' +
    '<span>Anything you typed is safe in local storage and syncs when the signal returns.</span></div>',
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (NEVER.test(url.hostname)) return;
  if (url.pathname.split('/').pop() === 'version.txt') return;

  e.respondWith((async function () {
    try {
      var res = await fetch(req);
      // Opaque responses (cross-origin scripts, fonts) are worth keeping even
      // though we cannot read their status — they are what the page needs.
      if (res && (res.ok || res.type === 'opaque')) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { return c.put(req, copy); }).catch(function () {});
      }
      return res;
    } catch (err) {
      var hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return offlinePage();
      throw err;
    }
  })());
});
