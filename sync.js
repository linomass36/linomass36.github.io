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
      el.addEventListener('click', function () { if (typeof window.hubSync === 'object') window.hubSync.syncNow(); });
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
    syncNow: function () { console.log('[sync] manual sync requested'); }
  };

  if (!FB.apiKey || FB.apiKey.indexOf('PASTE') === 0) {
    console.warn('[sync] Firebase not configured — running local-only, no cloud sync.');
    UI.set('off', 'Local only');
    return;
  }

  UI.set('connecting', 'Connecting…');

  var SDK = '10.12.2';
  var BASE = 'https://www.gstatic.com/firebasejs/' + SDK + '/';
  loadSeq([
    BASE + 'firebase-app-compat.js',
    BASE + 'firebase-auth-compat.js',
    BASE + 'firebase-firestore-compat.js'
  ], start);

  function loadSeq(urls, done) {
    var i = 0;
    (function next() {
      if (i >= urls.length) return done();
      var s = document.createElement('script');
      s.src = urls[i];
      s.onload = function () { i++; next(); };
      s.onerror = function () { console.error('[sync] failed to load', urls[i]); UI.set('offline', 'Offline'); };
      document.head.appendChild(s);
    })();
  }

  var db, uid, unsub, pushTimer, applyingRemote = false, lastSync = 0;

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
      window.hubSync.syncNow = function () { UI.set('saving', 'Saving…'); return pushNow(); };
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
    applyingRemote = true;
    var changed = applyToLocal(store);
    localStorage.setItem('__sync_rev', rev);
    applyingRemote = false;
    return changed;
  }

  function syncedLabel() {
    lastSync = Date.now();
    UI.set('synced', 'Synced ✓');
  }

  function hydrate() {
    docRef().get().then(function (snap) {
      if (snap.exists) {
        if (applyIfNewer(snap)) { location.reload(); return; }
      } else {
        pushNow(); // first run for this account: seed the cloud from local
      }
      watch();
      patch();
      syncedLabel();
    }).catch(function (e) {
      console.error('[sync] hydrate failed', e);
      UI.set('offline', 'Offline');
      watch(); patch();
    });
  }

  function pushNow() {
    if (!uid) return Promise.resolve();
    var rev = Date.now();
    localStorage.setItem('__sync_rev', String(rev)); // our own write — don't echo-reload
    UI.set('saving', 'Saving…');
    return docRef().set({ store: localSnapshot(), updatedAt: rev })
      .then(function () { syncedLabel(); })
      .catch(function (e) { console.error('[sync] push failed', e); UI.set('offline', 'Offline'); });
  }
  function pushSoon() { clearTimeout(pushTimer); UI.set('saving', 'Saving…'); pushTimer = setTimeout(pushNow, 800); }

  function patch() {
    var setItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      setItem(k, v);
      if (!applyingRemote && String(k).indexOf('__sync') !== 0) pushSoon();
    };
    var removeItem = localStorage.removeItem.bind(localStorage);
    localStorage.removeItem = function (k) {
      removeItem(k);
      if (!applyingRemote) pushSoon();
    };
  }

  function watch() {
    if (unsub) unsub();
    unsub = docRef().onSnapshot(function (snap) {
      if (!snap.exists) return;
      if (snap.metadata && snap.metadata.hasPendingWrites) return; // our own write echoing back
      if (applyIfNewer(snap)) { location.reload(); return; }
      syncedLabel();
    }, function (e) { console.error('[sync] listener', e); UI.set('offline', 'Offline'); });
  }
})();
