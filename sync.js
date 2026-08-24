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
        var days = window.hubSync.backups();
        txt += row('daily copies', days.length
          ? days.map(function (d) { return d.day + ' (' + d.keys + ' keys, ' + d.kb + 'KB)'; }).join(', ')
          : 'none yet');
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

        window.hubSync.backups().slice().reverse().forEach(function (d) {
          var r = document.createElement('button');
          r.textContent = '⤺ ' + d.day;
          r.title = 'Put back the copy kept on ' + d.day;
          r.style.cssText = 'margin-top:8px;margin-right:8px;font:600 11px "IBM Plex Mono",monospace;padding:6px 12px;' +
            'border-radius:16px;border:1px solid #B98900;background:#FFFBF0;color:#8a6600;cursor:pointer;';
          r.onclick = function () { window.hubSync.restoreDay(d.day); };
          p.appendChild(r);
        });

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
          extra += row('this device', Object.keys(mine).length + ' keys, ' + Math.round(sizeOf(mine) / 1024) + ' KB held');
          /* The number that used to matter was how close the whole store was
             to 950 KB. Now only the hot half is ever pushed, so the line
             worth reading is how the two halves compare — and how far back
             the archive reaches. */
          if (window.Archive) {
            var hotKb = Math.round(sizeOf(hotHalf(mine)) / 1024);
            var allKb = Math.round(sizeOf(mine) / 1024);
            extra += row('synced', hotKb + ' KB of 950 — the last ' + window.Archive.HOT_DAYS + ' days');
            extra += row('archived', Math.max(allKb - hotKb, 0) + ' KB before ' + window.Archive.cutoff() +
                         (archiveBlocked ? ' — BLOCKED, publish the archive rule' : ''));
          }
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

  /* Mirrors `touched` to localStorage synchronously on every real edit, so a
     key that was edited and then lost to navigation (the user taps to a
     different hub page inside the 800ms debounce window, killing this
     page's pending push along with the rest of its JS) is not lost — the
     next page's hydrate() reads this back and still owes it to the cloud. */
  var PENDING = '__sync_pending';
  function readPending() {
    try { var o = JSON.parse(localStorage.getItem(PENDING)); return (o && typeof o === 'object') ? o : {}; }
    catch (e) { return {}; }
  }

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

  /* A phone drops a request, sleeps a tab, or walks out of signal. Any of
     those used to kill syncing until a manual reload. boot() only covers
     the case where the SDK never finished loading in the first place — once
     booted it's a no-op, so on its own this did nothing for the far more
     common case: sync was already up, the tab got backgrounded (which
     mobile browsers routinely suspend the network/listeners of), and the
     live onSnapshot listener came back stale or not at all. Now, if sync
     is already running, coming back to the tab forces the same fetch the
     "Sync now" button does — reconcile(), gated exactly like hydrate(), so
     this can never turn into an unconditional push — instead of trusting a
     listener that may not have survived being backgrounded.

     visibilitychange can fire more than once for one real foregrounding
     (some browsers pair it with other focus events), so this is throttled:
     at most one reconcile pass per 10s, no matter how many events land. */
  var lastResync = 0;
  function resync() {
    if (!uid) { boot(); return; }
    var now = Date.now();
    if (now - lastResync < 10000) return;
    lastResync = now;
    reconcile('resume').catch(function (e) { fail('resync', e); });
  }
  window.addEventListener('online', resync);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) resync(); });

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
        return reconcile('manual').catch(function (e) { fail('sync now', e); });
      };
      hydrate();
    });
  }

  function docRef() { return db.collection('hubData').doc(uid); }
  /* An older compat build — or anything standing in for Firestore — may not
     offer subcollections at all. Nothing in the archive path is allowed to
     throw synchronously into the hydrate chain: a missing archive must cost
     the archive, never the sync. */
  function archCol() {
    var d = docRef();
    if (!d || typeof d.collection !== 'function') return null;
    var c = d.collection('archive');
    return (c && typeof c.doc === 'function') ? c : null;
  }
  function archRef(name) { var c = archCol(); return c ? c.doc(name) : null; }

  /* What this device has already sent to the archive, so an unchanged
     quarter is not rewritten on every push. Kept under a __sync key, which
     means the cloud never sees it and an incoming sync cannot clear it. */
  var ARCH_SENT = '__sync_arch', ARCH_PULLED = '__sync_arch_pulled';
  function archSent() {
    try { var o = JSON.parse(localStorage.getItem(ARCH_SENT)); return (o && typeof o === 'object') ? o : {}; }
    catch (e) { return {}; }
  }
  function setArchSent(o) { try { localStorage.setItem(ARCH_SENT, JSON.stringify(o)); } catch (e) {} }
  var archiveBlocked = false;   // rules not published yet — fall back to one document

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

  /* The cloud's copy of a splittable key is only the last 120 days. Writing
     it here verbatim would delete every older day this device holds — the
     whole archive, silently, on one sync. Archive.rejoin keeps ours and
     takes theirs. See archive.js. */
  /* Keys this device has edited but not yet confirmed pushed. `protect`
     is that same set (or the pending set carried over from a page that
     navigated away before it could push — see PENDING below): a key in it
     is strictly newer here than whatever the cloud is holding, so an
     incoming sync must leave it alone rather than overwrite an unpushed
     edit with an older value. */
  function applyToLocal(store, protect) {
    var changed = false;
    var A = window.Archive;
    Object.keys(store).forEach(function (k) {
      if (protect && protect[k]) return;
      var incoming = store[k];
      if (A && A.splittable(k)) incoming = A.rejoin(k, incoming, localStorage.getItem(k));
      if (localStorage.getItem(k) !== incoming) { localStorage.setItem(k, incoming); changed = true; }
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
    var changed = applyToLocal(store, touched);
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
      var prev = {}, n = 0, A = window.Archive;
      Object.keys(store).forEach(function (k) {
        if (touched[k]) return;   // an unpushed local edit — applyToLocal won't touch it either
        var was = localStorage.getItem(k);
        var incoming = (A && A.splittable(k)) ? A.rejoin(k, store[k], was) : store[k];
        if (was !== null && was !== incoming) { prev[k] = was; n += was.length; }
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

  /* Local keys the given cloud store has never seen. Covers three cases the
     same way: the doc does not exist yet (first sync anywhere), it exists
     but is missing keys this device holds (two devices seeding the same
     brand-new account within moments of each other — whichever write lands
     first "wins" the exists check, and without this the second device would
     just say "already there" and never correct it), or this device is still
     carrying an edit a previous page never got to push. */
  function localOnly(cloudStore) {
    var mine = localSnapshot(), out = {};
    Object.keys(mine).forEach(function (k) { if (!(k in cloudStore)) out[k] = 1; });
    return out;
  }

  /* The one place that decides what a sync pass actually does: pull
     anything newer from the cloud, and — only if this device genuinely owes
     it something (an edit, or a key the cloud has never seen) — push that
     up. Never an unconditional push. hydrate(), the manual "Sync now"
     button, and resuming from background all funnel through this, so
     there's exactly one definition of "safe to push" instead of the manual
     button quietly having its own, looser one. Resolves true if a reload
     was triggered (the caller should do nothing further), false otherwise. */
  function reconcile(reason) {
    return docRef().get().then(function (snap) {
      cloudRead = true;                       // we know what the cloud holds
      if (snap.exists && applyIfNewer(snap)) { location.reload(); return true; }
      var cloudStore = (snap.exists && (snap.data() || {}).store) || {};
      var owed = localOnly(cloudStore);
      Object.keys(owed).forEach(function (k) { touched[k] = touched[k] || 1; });
      if (Object.keys(touched).length) return pushNow(snap.exists ? reason : 'seed').then(function () { return false; });
      syncedLabel();
      return false;
    });
  }

  function hydrate() {
    touched = readPending();  // an edit the last page made but navigated away
                               // before it could push is still owed to the
                               // cloud — carry it forward, don't drop it.
    reconcile('reconcile').then(function (reloading) {
      if (reloading) return;
      watch();
      patch();
      hydrateArchive().then(function () {
        dailyBackup();    // once we know we are in step, keep today's copy
        syncedLabel();
      });
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

      /* Split the growing stores before measuring: the main document carries
         the last 120 days, and each older quarter goes to its own document
         where the 1 MiB limit applies per quarter instead of per lifetime.
         If the archive cannot be written — the rule for the subcollection
         has not been published yet — we fall back to the single document
         exactly as before, so nothing is ever lost by trying. */
      var chunks = [], hotStore = merged;
      if (window.Archive && !archiveBlocked) {
        hotStore = {};
        Object.keys(merged).forEach(function (key) {
          var r = window.Archive.split(key, merged[key]);
          if (!r) { hotStore[key] = merged[key]; return; }
          hotStore[key] = r.hot;
          Object.keys(r.cold).forEach(function (period) {
            chunks.push({ name: window.Archive.docName(key, period), body: r.cold[period] });
          });
        });
      }

      var bytes = sizeOf(hotStore);
      if (bytes > LIMIT) {
        lastErr = 'payload ' + Math.round(bytes / 1024) + ' KB — over the 1 MB document limit';
        console.error('[sync] ' + lastErr, biggestKeys(hotStore));
        UI.set('offline', 'Too big: ' + (bytes / 1048576).toFixed(2) + ' MB');
        return;
      }

      var rev = Date.now();
      localStorage.setItem('__sync_rev', String(rev)); // our own write — don't echo-reload
      return writeArchive(chunks).then(function (ok) {
        // The archive write failed, so the cold half must not be dropped from
        // the payload. Push everything in one document, as before.
        var payload = ok ? hotStore : merged;
        if (!ok && sizeOf(payload) > LIMIT) {
          lastErr = 'archive unavailable and the whole store is over the 1 MB limit';
          console.error('[sync] ' + lastErr);
          UI.set('offline', 'Archive blocked — publish the rule');
          return;
        }
        return docRef().set({ store: payload, updatedAt: rev }).then(function () {
          touched = {};
          localStorage.removeItem(PENDING);
          if (ok && chunks.length) archived = true;
          syncedLabel();
        });
      });
    }).catch(function (e) { fail('push' + (reason ? ' (' + reason + ')' : ''), e); });
  }

  var archived = false;

  /* Write the quarters that changed, and only those: a quarter that has
     already gone up is byte-for-byte fixed, so re-sending it every push
     would be pure cost. Resolves true when the archive is usable and false
     when it is not — the caller falls back to one document on false. */
  function writeArchive(chunks) {
    if (!chunks.length) return Promise.resolve(true);
    if (!archCol()) { archiveBlocked = true; return Promise.resolve(false); }
    var sent = archSent(), pending = chunks.filter(function (c) { return sent[c.name] !== c.body.length; });
    if (!pending.length) return Promise.resolve(true);
    var writes;
    try {
      writes = pending.map(function (c) {
        return archRef(c.name).set({ body: c.body, updatedAt: Date.now() }).then(function () {
          sent[c.name] = c.body.length;
        });
      });
    } catch (e) { archiveBlocked = true; return Promise.resolve(false); }
    return Promise.all(writes).then(function () {
      setArchSent(sent);
      archiveBlocked = false;
      console.log('[sync] archived ' + pending.length + ' quarter' + (pending.length === 1 ? '' : 's'));
      return true;
    }).catch(function (e) {
      archiveBlocked = true;
      lastErr = 'archive write refused — ' + (e && e.message ? e.message : e);
      console.warn('[sync] ' + lastErr + ' — keeping everything in one document for now');
      return false;
    });
  }

  /* Pull every archived quarter down once, and fold it into what this device
     holds. Additive: a day already here always wins, so this can run on any
     device at any time and never overwrite anything newer. */
  function hydrateArchive() {
    if (!window.Archive) return Promise.resolve();
    var col = archCol();
    if (!col || typeof col.get !== 'function') return Promise.resolve();
    var q;
    try { q = col.get(); } catch (e) { return Promise.resolve(); }
    if (!q || typeof q.then !== 'function') return Promise.resolve();
    return q.then(function (qs) {
      if (!qs || typeof qs.forEach !== 'function') return;
      var A = window.Archive, applied = 0;
      applyingRemote = true;
      qs.forEach(function (d) {
        var meta = A.parseDocName(d.id); if (!meta) return;
        var body = (d.data() || {}).body; if (typeof body !== 'string') return;
        var before = localStorage.getItem(meta.key);
        var after = A.join(meta.key, before, body);
        if (after !== before) { try { localStorage.setItem(meta.key, after); applied++; } catch (e) {} }
      });
      applyingRemote = false;
      if (applied) console.log('[sync] folded ' + applied + ' archived quarter' + (applied === 1 ? '' : 's') + ' back in');
      try { localStorage.setItem(ARCH_PULLED, String(Date.now())); } catch (e) {}
    }).catch(function (e) {
      applyingRemote = false;
      console.warn('[sync] could not read the archive —', e && e.message ? e.message : e);
    });
  }

  /* ─────────── A copy a day ───────────
     Kept on the device, under a __sync key, which means two things: the
     cloud never sees it (so it costs nothing against the 1 MB document
     limit) and an incoming sync can never overwrite it. That is the point
     — the copy you want after a bad arrival is the one the arrival could
     not touch. Three days, oldest dropped first. */
  var DAILY_KEY = '__sync_daily', DAILY_KEEP = 3, DAILY_MAX = 700 * 1024;

  function readDaily() {
    try { var a = JSON.parse(localStorage.getItem(DAILY_KEY)); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function writeDaily(list) {
    try { localStorage.setItem(DAILY_KEY, JSON.stringify(list)); return true; }
    catch (e) {                                   // out of room: drop the oldest and try again
      if (list.length > 1) return writeDaily(list.slice(1));
      console.warn('[sync] no room for a daily backup', e);
      return false;
    }
  }

  /* The copy kept here is the hot half — the last 120 days plus everything
     live. That is what a bad arrival can damage and what you would want back
     in a hurry; the older quarters are immutable and already in the cloud's
     archive. Keeping the whole store instead is what used to push this over
     DAILY_MAX at around month 13, after which no backup was taken at all and
     the only sign was a console warning nobody had open. */
  function hotHalf(store) {
    var A = window.Archive;
    if (!A) return store;
    var out = {};
    Object.keys(store).forEach(function (k) {
      var r = A.split(k, store[k]);
      out[k] = r ? r.hot : store[k];
    });
    return out;
  }

  function dailyBackup() {
    var day = new Date().toISOString().slice(0, 10);
    var all = readDaily();
    if (all.length && all[all.length - 1].day === day) return;   // today is already kept
    var store = hotHalf(localSnapshot());
    var bytes = sizeOf(store);
    if (!Object.keys(store).length) return;
    if (bytes > DAILY_MAX) {
      lastErr = 'daily backup skipped — ' + Math.round(bytes / 1024) + ' KB is too much to keep on the device';
      console.warn('[sync] ' + lastErr);
      UI.set('offline', 'No daily backup — too big');
      return;
    }
    all.push({ day: day, at: Date.now(), store: store });
    while (all.length > DAILY_KEEP) all.shift();
    if (writeDaily(all)) console.log('[sync] kept a copy of ' + Object.keys(store).length + ' keys for ' + day);
  }

  window.hubSync.backups = function () {
    return readDaily().map(function (b) {
      return { day: b.day, at: new Date(b.at).toLocaleString(), keys: Object.keys(b.store).length,
               kb: Math.round(sizeOf(b.store) / 1024) };
    });
  };

  /* Put a day back. Additive by default: it restores the keys that day
     held and leaves anything newer alone, because the usual reason to
     reach for this is that one thing was lost, not that everything was. */
  window.hubSync.restoreDay = function (day) {
    var b = readDaily().filter(function (x) { return x.day === day; })[0];
    if (!b) { alert('No backup kept for ' + day); return; }
    var names = Object.keys(b.store);
    if (!confirm('Put back ' + names.length + ' keys as they were on ' + b.day + '?\n\n' +
                 names.join(', ') + '\n\nAnything you have changed since will be overwritten.')) return;
    names.forEach(function (k) { localStorage.setItem(k, b.store[k]); });   // patched → marked as ours
    pushNow('restore').then(function () { location.reload(); });
  };

  function pushSoon() { clearTimeout(pushTimer); UI.set('saving', 'Saving…'); pushTimer = setTimeout(pushNow, 800); }

  function patch() {
    var setItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      setItem(k, v);
      if (!applyingRemote && String(k).indexOf('__sync') !== 0) {
        touched[k] = 1;
        try { setItem(PENDING, JSON.stringify(touched)); } catch (e) {}
        pushSoon();
      }
    };
    var removeItem = localStorage.removeItem.bind(localStorage);
    localStorage.removeItem = function (k) {
      removeItem(k);
      if (!applyingRemote && String(k).indexOf('__sync') !== 0) {
        touched[k] = 'del';
        try { setItem(PENDING, JSON.stringify(touched)); } catch (e) {}
        pushSoon();
      }
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
