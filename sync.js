/* ─────────────────────────────────────────────────────────────
   sync.js — cross-device storage sync for the hub.

   Injected into every hub page automatically by the GitHub Action
   (see .github/workflows/deploy.yml) so the raw exported files are
   never hand-edited. Depends on window.APP_CONFIG from config.js.

   What it does, in order:
     1. Loads the Firebase SDK (app + auth + firestore).
     2. Confirms the signed-in user is the owner. If not (or nobody
        is signed in), bounces to the gate — hub pages are protected.
     3. Pulls the owner's Firestore doc into localStorage BEFORE the
        app boots (one reload on first hydrate = correct first paint).
     4. Monkey-patches localStorage.setItem/removeItem to debounce-push
        the whole namespace back to Firestore.
     5. Live-listens for changes from your other devices and applies
        them, reloading so the app re-reads the fresh state.
   ───────────────────────────────────────────────────────────── */
(function () {
  var C = window.APP_CONFIG || {};
  var FB = C.firebase || {};
  var EMAIL = (C.authorizedEmail || '').toLowerCase();
  var GATE = C.gateUrl || 'index.html';

  if (!FB.apiKey || FB.apiKey.indexOf('PASTE') === 0) {
    console.warn('[sync] Firebase not configured — running local-only, no cloud sync.');
    return;
  }

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
      s.onerror = function () { console.error('[sync] failed to load', urls[i]); status('SDK load failed', '#C0392B'); };
      document.head.appendChild(s);
    })();
  }

  var db, uid, unsub, pushTimer, applyingRemote = false;

  // On-screen status chip (tap for details) so sync problems are visible per device.
  var _st = '';
  function status(txt, color) {
    _st = txt;
    var el = document.getElementById('__sync_status');
    if (!el) {
      el = document.createElement('div');
      el.id = '__sync_status';
      el.style.cssText = 'position:fixed;left:8px;bottom:7px;z-index:2147483000;font:600 9.5px/1 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.1em;padding:3px 7px;border-radius:20px;border:1px solid #E4E2DD;background:rgba(255,253,248,.9);cursor:pointer;';
      el.title = 'tap for sync details';
      el.onclick = function () { alert('SYNC\n' + _st + '\n\nuid: ' + (uid || '—') + '\ndomain: ' + location.hostname); };
      (document.body || document.documentElement).appendChild(el);
    }
    el.textContent = 'sync: ' + txt;
    el.style.color = color || '#9C9B93';
  }
  status('starting…');

  function start() {
    try {
      if (!firebase.apps.length) firebase.initializeApp(FB);
      firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      db = firebase.firestore();
    } catch (e) { console.error('[sync] init', e); status('init error', '#C0392B'); return; }

    firebase.auth().onAuthStateChanged(function (u) {
      var owner = u && u.email && (!EMAIL || u.email.toLowerCase() === EMAIL);
      if (!owner) {
        status(u ? 'wrong account' : 'signed out', '#B7791F');
        // Not the owner (or not signed in) → send them to the gate.
        var here = location.pathname.split('/').pop();
        if (here !== GATE) location.replace(GATE);
        return;
      }
      uid = u.uid;
      status('signed in…', '#0F6E56');
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

  // Returns true if any local value was created/changed by the remote store.
  function applyToLocal(store) {
    var changed = false;
    Object.keys(store).forEach(function (k) {
      if (localStorage.getItem(k) !== store[k]) { localStorage.setItem(k, store[k]); changed = true; }
    });
    return changed;
  }

  // Apply a remote doc if its revision is newer than what this device last saw.
  // Reloads once so the app re-reads localStorage. The revision guard replaces
  // the old per-session flag, so a fresh cloud update lands on EVERY device.
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

  function hydrate() {
    docRef().get().then(function (snap) {
      if (snap.exists) {
        var n = Object.keys((snap.data() && snap.data().store) || {}).length;
        if (applyIfNewer(snap)) { status('updating…', '#0F6E56'); location.reload(); return; }
        status('synced ✓ (' + n + ')', '#0F6E56');
      } else {
        pushNow(); // first run for this account: seed the cloud from local
      }
      watch();
      patch();
    }).catch(function (e) {
      console.error('[sync] hydrate failed', e);
      status('read ERR: ' + (e && e.code || 'x'), '#C0392B');
      watch(); patch();
    });
  }

  function pushNow() {
    if (!uid) return;
    var rev = Date.now();
    localStorage.setItem('__sync_rev', String(rev)); // our own write — don't echo-reload
    var n = Object.keys(localSnapshot()).length;
    docRef().set({ store: localSnapshot(), updatedAt: rev })
      .then(function () { status('saved ✓ (' + n + ')', '#0F6E56'); })
      .catch(function (e) { console.error('[sync] push failed', e); status('save ERR: ' + (e && e.code || 'x'), '#C0392B'); });
  }
  function pushSoon() { clearTimeout(pushTimer); pushTimer = setTimeout(pushNow, 800); }

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
      if (applyIfNewer(snap)) { status('updating…', '#0F6E56'); location.reload(); }
    }, function (e) { console.error('[sync] listener', e); status('watch ERR: ' + (e && e.code || 'x'), '#C0392B'); });
  }
})();
