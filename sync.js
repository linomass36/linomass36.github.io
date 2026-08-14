/* ─────────────────────────────────────────────────────────────
   sync.js — cross-device storage sync for the hub.

   Injected into every hub page automatically by the deploy Action so the
   raw exported files are never hand-edited. Depends on window.APP_CONFIG.

   What it does, in order:
     1. Loads the Firebase SDK (app + auth + firestore).
     2. Confirms the signed-in user is the owner. If not (or nobody is
        signed in), bounces to the gate — hub pages are protected.
     3. Pulls the owner's Firestore doc into localStorage BEFORE the app
        boots (one reload on first hydrate = correct first paint).
     4. Monkey-patches localStorage.setItem/removeItem to debounce-push
        the whole namespace back to Firestore.
     5. Live-listens for changes from your other devices and applies them.

   It also shows a small SYNC STATUS pill (bottom-left) so you can see at a
   glance whether syncing is live — grey = off/sign-in, amber = saving,
   green = synced, red = offline. Tap it to force a sync now. Everything is
   also exposed on window.hubSync for the console.
   ───────────────────────────────────────────────────────────── */
(function () {
  var C = window.APP_CONFIG || {};
  var FB = C.firebase || {};
  var EMAIL = (C.authorizedEmail || '').toLowerCase();
  var GATE = C.gateUrl || 'index.html';

  // ── Status pill ───────────────────────────────────────────────
  var UI = (function () {
    var el, dot, txt, state = 'init', detail = '';
    var COLORS = { off: '#B9B8B0', wait: '#B98900', ok: '#3B6D11', err: '#A32E27' };
    function build() {
      if (el || !document.body) return;
      el = document.createElement('button');
      el.id = 'hub-sync';
      el.type = 'button';
      el.setAttribute('aria-label', 'Sync status — tap to sync now');
      el.style.cssText = 'position:fixed;left:calc(9px + env(safe-area-inset-left,0px));' +
        'bottom:calc(8px + env(safe-area-inset-bottom,0px));z-index:2147483000;display:flex;' +
        'align-items:center;gap:6px;font:600 10px/1 "IBM Plex Mono",ui-monospace,monospace;' +
        'letter-spacing:.04em;color:#77786F;background:rgba(255,253,248,.9);border:1px solid #E4E2DD;' +
        'padding:4px 9px 4px 7px;border-radius:20px;cursor:pointer;-webkit-tap-highlight-color:transparent;' +
        'box-shadow:0 1px 4px rgba(26,27,26,.08);';
      dot = document.createElement('span');
      dot.style.cssText = 'width:7px;height:7px;border-radius:50%;flex:none;background:' + COLORS.off + ';';
      txt = document.createElement('span');
      el.appendChild(dot); el.appendChild(txt);
      el.addEventListener('click', function () { if (typeof window.hubSync === 'object') window.hubSync.panel(); });
      document.body.appendChild(el);
      apply();
    }
    function apply() {
      if (!el) return;
      var kind = state === 'saving' || state === 'connecting' ? 'wait'
        : state === 'synced' ? 'ok'
        : state === 'offline' ? 'err' : 'off';
      dot.style.background = COLORS[kind];
      dot.style.animation = kind === 'wait' ? 'hubSyncPulse 1s infinite' : 'none';
      txt.textContent = detail;
    }
    // pulse keyframes (once)
    var st = document.createElement('style');
    st.textContent = '@keyframes hubSyncPulse{0%,100%{opacity:1}50%{opacity:.35}}';
    (document.head || document.documentElement).appendChild(st);
    return {
      set: function (s, d) {
        state = s; detail = d || s;
        console.log('[sync] ' + s + (d ? ' — ' + d : ''));
        window.__syncState = s;
        if (document.body) build(); else document.addEventListener('DOMContentLoaded', build, { once: true });
        apply();
      }
    };
  })();

  window.hubSync = {
    get state() { return window.__syncState; },
    syncNow: function () { console.log('[sync] manual sync requested'); },
    // Tap the pill → a small panel with everything needed to debug sync from a
    // phone (no console needed): account, device/cloud revision, whether the
    // cloud copy actually holds data, and the last error.
    panel: function () {
      var old = document.getElementById('hub-sync-panel');
      if (old) { old.remove(); return; }
      var p = document.createElement('div');
      p.id = 'hub-sync-panel';
      p.style.cssText = 'position:fixed;left:calc(9px + env(safe-area-inset-left,0px));' +
        'bottom:calc(44px + env(safe-area-inset-bottom,0px));z-index:2147483001;max-width:88vw;' +
        'font:11px/1.6 "IBM Plex Mono",ui-monospace,monospace;color:#26271F;background:#FFFDF8;' +
        'border:1px solid #E4E2DD;border-radius:12px;padding:12px 14px;box-shadow:0 8px 28px rgba(26,27,26,.18);white-space:pre-wrap;';
      function row(k, v) { return k + ': ' + v + String.fromCharCode(10); }
      function render(extra) {
        var u = null;
        try { u = firebase.auth().currentUser; } catch (e) {}
        var rev = localStorage.getItem('__sync_rev');
        var txt = '';
        txt += row('state', window.__syncState || '?');
        txt += row('version', (window.APP_CONFIG && window.APP_CONFIG.version) || '?');
        txt += row('account', u ? u.email : 'NOT SIGNED IN');
        txt += row('uid', u ? u.uid.slice(0, 10) + '…' : '—');
        txt += row('device rev', rev ? new Date(+rev).toLocaleString() : 'none');
        txt += extra;
        var u = null; try { u = JSON.parse(localStorage.getItem('__sync_undo')); } catch (e) {}
        txt += row('undo available', u && u.at ? new Date(u.at).toLocaleString() + ' (' + Object.keys(u.keys).length + ' keys)' : 'none');
        txt += row('last error', lastErr || 'none');
        p.textContent = txt;
        var btn = document.createElement('button');
        btn.textContent = 'Sync now';
        btn.style.cssText = 'margin-top:8px;margin-right:8px;font:600 11px "IBM Plex Mono",monospace;padding:6px 12px;border-radius:16px;border:1px solid #3B6D11;background:#3B6D11;color:#fff;cursor:pointer;';
        btn.onclick = function () { window.hubSync.syncNow(); };
        var undo = document.createElement('button');
        var uAt = 0;
        try { uAt = (JSON.parse(localStorage.getItem('__sync_undo')) || {}).at || 0; } catch (e) {}
        undo.textContent = uAt ? 'Undo last sync' : 'Nothing to undo';
        undo.disabled = !uAt;
        undo.style.cssText = 'margin-top:8px;margin-right:8px;font:600 11px "IBM Plex Mono",monospace;padding:6px 12px;' +
          'border-radius:16px;border:1px solid ' + (uAt ? '#A32E27' : '#DAD7D0') + ';background:' +
          (uAt ? '#FBF1F0' : '#fff') + ';color:' + (uAt ? '#A32E27' : '#B9B8B0') + ';cursor:' + (uAt ? 'pointer' : 'default') + ';';
        undo.onclick = function () { window.hubSync.undoLastSync(); };
        p.appendChild(undo);

        var cls = document.createElement('button');
        cls.textContent = 'Close';
        cls.style.cssText = 'margin-top:8px;font:600 11px "IBM Plex Mono",monospace;padding:6px 12px;border-radius:16px;border:1px solid #DAD7D0;background:#fff;color:#55564F;cursor:pointer;';
        cls.onclick = function () { p.remove(); };
        p.appendChild(btn); p.appendChild(cls);
      }
      render(row('cloud', 'checking…'));
      document.body.appendChild(p);
      try {
        docRef().get().then(function (snap) {
          if (!snap.exists) { render(row('cloud', 'NO DOC — never pushed')); return; }
          var d = snap.data() || {}; var store = d.store || {};
          var mine = localSnapshot();
          var extra = row('cloud rev', d.updatedAt ? new Date(+d.updatedAt).toLocaleString() : '?');
          extra += row('cloud keys', Object.keys(store).length);
          extra += row('this device', Object.keys(mine).length + ' keys, ' + Math.round(sizeOf(mine) / 1024) + ' KB of 950');
          extra += row('biggest', biggestKeys(mine).map(function (x) { return x.key + ' ' + x.kb + 'KB'; }).join(', '));
          // the keys that differ are exactly the ones that have not made it across
          var behind = Object.keys(mine).filter(function (k) { return store[k] !== mine[k]; });
          extra += row('not yet in the cloud', behind.length ? behind.join(', ') : 'none — in step');
          render(extra);
        }).catch(function (e) {
          render(row('cloud', 'READ FAILED: ' + ((e && e.code) || (e && e.message) || e)));
        });
      } catch (e) {
        render(row('cloud', 'unavailable: ' + e.message));
      }
    }
  };

  if (!FB.apiKey || FB.apiKey.indexOf('PASTE') === 0) {
    console.warn('[sync] Firebase not configured — running local-only, no cloud sync.');
    UI.set('off', 'Local only');
    return;
  }

  // Declared up here because the loader reports through them.
  var db, uid, unsub, pushTimer, applyingRemote = false, lastSync = 0, lastErr = '', cloudRead = false, touched = {};

  var SDK = '10.12.2';
  var BASE = 'https://www.gstatic.com/firebasejs/' + SDK + '/';
  var SDK_URLS = [
    BASE + 'firebase-app-compat.js',
    BASE + 'firebase-auth-compat.js',
    BASE + 'firebase-firestore-compat.js'
  ];
  var booted = false, loading = false;

  function boot() {
    if (booted || loading) return;
    loading = true;
    UI.set('connecting', 'Connecting…');
    loadSeq(SDK_URLS, function () { loading = false; booted = true; start(); },
      function (url) {
        loading = false;
        lastErr = 'sdk: could not load ' + url;
        console.error('[sync] giving up on', url, '— retrying when the network returns');
        // A blocked or dropped SDK is not the same as being offline, and
        // saying so is the difference between "wait" and "check your blocker".
        UI.set('offline', navigator.onLine === false ? 'Offline' : 'Sync library blocked');
      });
  }
  boot();

  // A phone drops a request, sleeps a tab, or walks out of signal. Any of
  // those used to kill syncing until a manual reload; now the moment the
  // network or the tab comes back, we try again.
  window.addEventListener('online', boot);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) boot(); });

  // Each script gets a few goes with a widening gap before we give up.
  function loadSeq(urls, done, fail) {
    var i = 0;
    next();
    function next() {
      if (i >= urls.length) return done();
      one(urls[i], 0);
    }
    function one(url, attempt) {
      var s = document.createElement('script');
      s.src = url + (attempt ? '?retry=' + attempt : '');
      s.onload = function () { i++; next(); };
      s.onerror = function () {
        s.remove();
        if (attempt < 2) {
          console.warn('[sync] retrying', url, '(' + (attempt + 1) + ')');
          setTimeout(function () { one(url, attempt + 1); }, 600 * Math.pow(2, attempt));
        } else fail(url);
      };
      document.head.appendChild(s);
    }
  }


  // Turn a Firebase error into a pill label that says what's actually wrong.
  // "permission-denied" is the big one: Firestore created in production mode
  // ships rules that deny EVERYONE (including the owner) until the rules from
  // DEPLOY.md are published — sync then fails silently on every device.
  function fail(stage, e) {
    var code = (e && e.code) || '';
    lastErr = stage + ': ' + (code || (e && e.message) || 'unknown');
    console.error('[sync] ' + stage + ' failed', e);
    if (code === 'permission-denied') {
      UI.set('offline', 'Blocked: publish Firestore rules');
    } else if (code === 'unauthenticated') {
      UI.set('off', 'Sign in to sync');
    } else if (code === 'unavailable') {
      UI.set('offline', 'Offline');
    } else {
      UI.set('offline', 'Sync error: ' + (code || 'unknown'));
    }
  }

  function start() {
    try {
      if (!firebase.apps.length) firebase.initializeApp(FB);
      firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      db = firebase.firestore();
    } catch (e) { console.error('[sync] init', e); UI.set('offline', 'Sync error'); return; }

    firebase.auth().onAuthStateChanged(function (u) {
      var owner = u && u.email && (!EMAIL || u.email.toLowerCase() === EMAIL);
      if (!owner) {
        // Not the owner (or not signed in) → send them to the gate.
        UI.set('off', 'Sign in to sync');
        var here = location.pathname.split('/').pop();
        if (here !== GATE) location.replace(GATE);
        return;
      }
      uid = u.uid;
      window.hubSync.syncNow = function () {
        UI.set('connecting', 'Checking…');
        return docRef().get().then(function (snap) {
          cloudRead = true;
          if (applyIfNewer(snap)) { location.reload(); return; }  // the cloud was ahead
          return pushNow();
        }).catch(function (e) { fail('sync now', e); });
      };
      hydrate();
    });
  }

  function docRef() { return db.collection('hubData').doc(uid); }

  function localSnapshot() {
    var o = {};
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('__sync') !== 0) o[k] = localStorage.getItem(k);
    }
    return o;
  }

  function biggestKeys(store) {
    return Object.keys(store)
      .map(function (k) { return { key: k, kb: Math.round((store[k] || '').length / 1024) }; })
      .sort(function (a, b) { return b.kb - a.kb; })
      .slice(0, 4);
  }

  function applyToLocal(store) {
    var changed = false;
    Object.keys(store).forEach(function (k) {
      if (localStorage.getItem(k) !== store[k]) { localStorage.setItem(k, store[k]); changed = true; }
    });
    return changed;
  }

  function applyIfNewer(snap) {
    if (!snap.exists) return false;
    var data = snap.data() || {};
    var rev = String(data.updatedAt || '');
    var store = data.store || {};
    if (rev && rev === localStorage.getItem('__sync_rev')) return false; // already applied
    keepUndo(store);
    applyingRemote = true;
    var changed = applyToLocal(store);
    localStorage.setItem('__sync_rev', rev);
    applyingRemote = false;
    return changed;
  }

  /* Whatever a remote change is about to land on top of is kept here first,
     so an arrival that turns out to be wrong is one tap away from being put
     back. Only the keys actually about to change, and only if it is small
     enough to be worth keeping. */
  function keepUndo(store) {
    try {
      var prev = {}, n = 0;
      Object.keys(store).forEach(function (k) {
        var was = localStorage.getItem(k);
        if (was !== null && was !== store[k]) { prev[k] = was; n += was.length; }
      });
      if (!n || n > 400000) return;
      localStorage.setItem('__sync_undo', JSON.stringify({ at: Date.now(), keys: prev }));
    } catch (e) {}
  }

  window.hubSync.undoLastSync = function () {
    var u = null;
    try { u = JSON.parse(localStorage.getItem('__sync_undo')); } catch (e) {}
    if (!u || !u.keys) { alert('Nothing to undo — no sync has replaced anything on this device.'); return; }
    var names = Object.keys(u.keys);
    if (!confirm('Put back what this device held before the last sync?\n\n' + names.join(', ') +
                 '\n\nfrom ' + new Date(u.at).toLocaleString())) return;
    names.forEach(function (k) { localStorage.setItem(k, u.keys[k]); });  // patched → marks them touched
    localStorage.removeItem('__sync_undo');
    pushNow('undo').then(function () { location.reload(); });
  };

  function syncedLabel() {
    lastSync = Date.now();
    UI.set('synced', 'Synced ✓');
  }

  function hydrate() {
    docRef().get().then(function (snap) {
      cloudRead = true;                       // we know what the cloud holds
      if (snap.exists) {
        if (applyIfNewer(snap)) { location.reload(); return; }
      } else {
        pushNow('seed'); // first run for this account: seed the cloud from local
      }
      watch();
      patch();
      syncedLabel();
    }).catch(function (e) {
      // We could not read the cloud, so we must not write over it: this
      // device's copy may be months behind. Listen and retry instead.
      cloudRead = false;
      fail('hydrate', e);
      watch(); patch();
      setTimeout(hydrate, 15000);
    });
  }

  var LIMIT = 950 * 1024;   // a Firestore document tops out at 1 MiB

  function sizeOf(o) {
    try { return new Blob([JSON.stringify(o)]).size; }
    catch (e) { return JSON.stringify(o).length; }
  }

  /* A push used to be: take everything this device holds and stamp it over
     the cloud. That is how a phone carrying a week-old copy can erase a
     laptop's evening of work. Now a push reads first and merges:

       the cloud's copy,
       + the keys this device actually edited since its last push,
       + any key the cloud has never seen.

     Nothing else of the cloud's is touched, so a stale device can only
     ever affect what was typed into it. And if the cloud moved since we
     last applied it, we take that first and let the reload re-push. */
  function pushNow(reason) {
    if (!uid) return Promise.resolve();
    if (!cloudRead) {                        // see hydrate()
      console.warn('[sync] holding the push back — this device has not read the cloud yet');
      UI.set('offline', 'Waiting to read the cloud');
      return Promise.resolve();
    }
    UI.set('saving', 'Saving…');
    return docRef().get().then(function (snap) {
      var d = (snap.exists && snap.data()) || {};
      var base = d.store || {};
      var cloudRev = String(d.updatedAt || '');
      var mine = String(localStorage.getItem('__sync_rev') || '');

      // The cloud has moved on since we last applied it — take it, don't
      // paste over it. applyIfNewer reloads, and the reload pushes again.
      if (cloudRev && mine && cloudRev !== mine && applyIfNewer(snap)) {
        console.warn('[sync] the cloud moved first — pulling that in before pushing');
        location.reload();
        return;
      }

      var local = localSnapshot();
      var merged = {}, k;
      for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) merged[k] = base[k];
      Object.keys(touched).forEach(function (key) {
        if (touched[key] === 'del') delete merged[key];
        else if (local[key] != null) merged[key] = local[key];
      });
      // additive only: anything the cloud has never held goes up as well
      Object.keys(local).forEach(function (key) { if (!(key in merged)) merged[key] = local[key]; });

      var bytes = sizeOf(merged);
      if (bytes > LIMIT) {
        lastErr = 'payload ' + Math.round(bytes / 1024) + ' KB — over the 1 MB document limit';
        console.error('[sync] ' + lastErr, biggestKeys(merged));
        UI.set('offline', 'Too big: ' + (bytes / 1048576).toFixed(2) + ' MB');
        return;
      }

      var rev = Date.now();
      localStorage.setItem('__sync_rev', String(rev)); // our own write — don't echo-reload
      return docRef().set({ store: merged, updatedAt: rev }).then(function () {
        touched = {};
        syncedLabel();
      });
    }).catch(function (e) { fail('push' + (reason ? ' (' + reason + ')' : ''), e); });
  }

  function pushSoon() { clearTimeout(pushTimer); UI.set('saving', 'Saving…'); pushTimer = setTimeout(pushNow, 800); }

  function patch() {
    var setItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      setItem(k, v);
      if (!applyingRemote && String(k).indexOf('__sync') !== 0) { touched[k] = 1; pushSoon(); }
    };
    var removeItem = localStorage.removeItem.bind(localStorage);
    localStorage.removeItem = function (k) {
      removeItem(k);
      if (!applyingRemote && String(k).indexOf('__sync') !== 0) { touched[k] = 'del'; pushSoon(); }
    };
  }

  function watch() {
    if (unsub) unsub();
    unsub = docRef().onSnapshot(function (snap) {
      if (!snap.exists) return;
      if (snap.metadata && snap.metadata.hasPendingWrites) return; // our own write echoing back
      if (applyIfNewer(snap)) { location.reload(); return; }
      syncedLabel();
    }, function (e) { fail('listener', e); });
  }
})();
