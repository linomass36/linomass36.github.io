/* ─────────────────────────────────────────────────────────────────────────
   feeds.js — readings written by something that is not a browser.

   The Mac reads the Anki collection every half hour and publishes to
   Firestore. This picks that up and lands it in localStorage, where
   systems.js already knows how to read it — so nothing downstream needs to
   learn about feeds at all, and the phone gets the number through the
   ordinary sync it already does.

   Two decisions worth stating.

   It reads feeds/{uid}, NOT the hubData doc sync.js owns. sync.js rewrites
   that document wholesale from localStorage on every push, so anything a
   script wrote into it from outside would survive until the next push from
   any device and then vanish. A separate document cannot be clobbered.

   It only writes when the incoming reading is NEWER than the stored one.
   Both the Mac and the hand-entry form on the Standing write ct_anki_v1, and
   without that check a stale feed would silently overwrite something typed
   thirty seconds ago. Whoever measured last wins, which is the only rule
   that stays correct when there are two writers.
   ───────────────────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  var FEEDS = {
    // feed field  →  the localStorage key systems.js already reads
    anki: 'ct_anki_v1'
  };

  function stamp(v) {
    if (!v || !v.at) return 0;
    var t = Date.parse(v.at);
    return isNaN(t) ? 0 : t;
  }

  function readLocal(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }

  /* Returns what changed, so a page can say "Anki updated" rather than
     silently redrawing and leaving you wondering whether it worked. */
  function apply(doc) {
    var changed = [];
    if (!doc || typeof doc !== 'object') return changed;
    Object.keys(FEEDS).forEach(function (field) {
      var incoming = doc[field];
      if (!incoming || typeof incoming !== 'object') return;
      var key = FEEDS[field];
      var mine = readLocal(key);
      if (stamp(incoming) <= stamp(mine)) return;   // ours is newer, or the same
      try {
        localStorage.setItem(key, JSON.stringify(incoming));
        changed.push(field);
      } catch (e) {}
    });
    return changed;
  }

  /* Firebase may not be on the page, may not be initialised, or the read may
     be refused by rules. None of those should cost you the page — a feed is
     an enhancement over a number you can always type in yourself. */
  function pull(onChange) {
    try {
      if (!w.firebase || !firebase.apps || !firebase.apps.length) return;
      var u = firebase.auth().currentUser;
      if (!u) return;
      firebase.firestore().collection('feeds').doc(u.uid).get()
        .then(function (snap) {
          if (!snap || !snap.exists) return;
          var changed = apply(snap.data());
          if (changed.length && typeof onChange === 'function') onChange(changed);
        })
        .catch(function () {});
    } catch (e) {}
  }

  function start(onChange) {
    try {
      if (!w.firebase || !firebase.auth) return;
      firebase.auth().onAuthStateChanged(function (u) { if (u) pull(onChange); });
    } catch (e) {}
  }

  w.Feeds = { FEEDS: FEEDS, apply: apply, pull: pull, start: start, stamp: stamp };
})(window);
