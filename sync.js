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
      s.onerror = function () { console.error('[sync] failed to load', urls[i]); };
      document.head.appendChild(s);
    })();
  }

  var db, uid, unsub, pushTimer, applyingRemote = false;

  function start() {
    try {
      if (!firebase.apps.length) firebase.initializeApp(FB);
      firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      db = firebase.firestore();
    } catch (e) { console.error('[sync] init', e); return; }

    firebase.auth().onAuthStateChanged(function (u) {
      var owner = u && u.email && (!EMAIL || u.email.toLowerCase() === EMAIL);
      if (!owner) {
        // Not the owner (or not signed in) → send them to the gate.
        var here = location.pathname.split('/').pop();
        if (here !== GATE) location.replace(GATE);
        return;
      }
      uid = u.uid;
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
        if (applyIfNewer(snap)) { location.reload(); return; }
      } else {
        pushNow(); // first run for this account: seed the cloud from local
      }
      watch();
      patch();
    }).catch(function (e) {
      console.error('[sync] hydrate failed', e);
      watch(); patch();
    });
  }

  function pushNow() {
    if (!uid) return;
    var rev = Date.now();
    localStorage.setItem('__sync_rev', String(rev)); // our own write — don't echo-reload
    docRef().set({ store: localSnapshot(), updatedAt: rev })
      .catch(function (e) { console.error('[sync] push failed', e); });
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
      if (applyIfNewer(snap)) location.reload();
    }, function (e) { console.error('[sync] listener', e); });
  }
})();
