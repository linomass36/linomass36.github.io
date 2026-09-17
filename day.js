/* ─────────────────────────────────────────────────────────────────────────
   day.js — one place decides when a day starts.

   A day here ends at 05:00, not midnight. Work that runs past midnight
   belongs to the day it started, and a session logged at half past two is
   entered against the evening it happened in, not the morning you are
   still awake for.

   The closure log has worked this way since it was written; nothing else
   did. The Life Log keyed its days by the UTC date, Journal and the grind
   board by the local calendar date, and each page that read them repeated
   whichever convention its store used — so the same 02:00 session was
   yesterday on one page, today on another, and tomorrow on a third if you
   were far enough east. This file replaces all of them.

   THE BOUNDARY IS THE CLOSURE LOG'S SETTING. `ct_anatomy_v1.meta.rollover`
   already had a control on the Anatomy page's Log tab; it now governs every
   store in the hub rather than one. Absent or unreadable, the answer is 5.

   USE:
     CTDay.today()        the day we are in now
     CTDay.key(ts)        the day a timestamp belongs to
     CTDay.offset(n)      n days from today (negative for the past)
     CTDay.shift(key, n)  n days from a given day key
     CTDay.startMs(key)   the instant that day begins, for ranges
     CTDay.rollover()     the hour it turns over, for a page that says so
     CTDay.watch(fn)      call fn when the day changes under an open page

   Every consumer falls back to its old behaviour when this file has not
   loaded, so a page that forgets the script tag is wrong by a few hours
   rather than broken.
   ───────────────────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  var DEFAULT_ROLLOVER = 5;
  var ANATOMY_KEY = 'ct_anatomy_v1';

  /* The setting is read from localStorage, and key() is called once per
     session in loops that run over a year of them, so the answer is held for
     a second at a time. A rollover change that takes a moment to be believed
     costs nothing; a JSON.parse per session costs a visible pause. */
  var cached = null, cachedAt = 0;

  function rollover() {
    var now = Date.now();
    if (cached !== null && now - cachedAt < 1000) return cached;
    var v = DEFAULT_ROLLOVER;
    try {
      var raw = localStorage.getItem(ANATOMY_KEY);
      if (raw) {
        var m = JSON.parse(raw).meta;
        if (m && (m.rollover === 0 || m.rollover)) {
          var n = +m.rollover;
          if (!isNaN(n) && n >= 0 && n < 24) v = n;
        }
      }
    } catch (e) {}
    cached = v; cachedAt = now;
    return v;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoLocal(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // The day a moment belongs to. No argument means now.
  function key(ts) {
    var d = (ts === undefined || ts === null) ? new Date() : new Date(ts);
    if (isNaN(d.getTime())) return '';
    d.setHours(d.getHours() - rollover());
    return isoLocal(d);
  }

  function today() { return key(); }

  // n days from today, in day keys. offset(-1) is yesterday.
  function offset(n) {
    var d = new Date();
    d.setHours(d.getHours() - rollover());
    d.setDate(d.getDate() + (n || 0));
    return isoLocal(d);
  }

  // n days from a day key. Noon anchoring keeps it clear of DST.
  function shift(dayKey, n) {
    if (!dayKey) return '';
    var d = new Date(dayKey + 'T12:00:00');
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + (n || 0));
    return isoLocal(d);
  }

  // The instant a day begins: its own date at the rollover hour.
  function startMs(dayKey) {
    if (!dayKey) return NaN;
    var d = new Date(dayKey + 'T00:00:00');
    if (isNaN(d.getTime())) return NaN;
    d.setHours(rollover(), 0, 0, 0);
    return d.getTime();
  }

  function between(a, b) {
    if (!a || !b) return 0;
    var x = new Date(a + 'T12:00:00'), y = new Date(b + 'T12:00:00');
    if (isNaN(x.getTime()) || isNaN(y.getTime())) return 0;
    return Math.round((y - x) / 86400000);
  }

  /* ── "you are looking at this again" ─────────────────────────────────────
     WHAT SHIPPED BROKEN: the Season checklist showed day one's ticks on day
     two. Not a storage bug — the ticks were filed under the right day the
     whole time. The PAGE was a picture. It painted once at load, and on a
     phone that load was two days ago: the tab is never closed, iOS restores
     it from the back-forward cache without running a line of script, and what
     came back on screen was the render from the night before, ticks and all.
     Acting on it would have meant re-ticking rows already ticked and trusting
     a board that had stopped reading its own store.

     Standing.html had solved this for itself, with the listeners and the
     comment explaining why. Nothing else had, so the one surface that IS a
     checklist was the one that went stale. It belongs here, beside the
     boundary it depends on, so the next page to need it inherits it.

     It fires when EITHER day changes: the hub's own day, which turns at the
     rollover, and the local calendar date, which the datelines print. Keying
     it to one of them would leave the other stale for five hours — which is
     what the timer it replaces did.

     The listeners are the load-bearing part and the timer is the backstop,
     not the other way round. A suspended phone does not run timers; what it
     does reliably is fire pageshow and visibilitychange on the way back. */
  var watchers = [], bound = false, timer = null, lastStamp = null;

  function stamp() { return key() + '|' + isoLocal(new Date()); }

  function fire() {
    var s = stamp();
    if (s !== lastStamp) {
      var prev = lastStamp;
      lastStamp = s;
      /* A copy, so a watcher that unwatches itself cannot skip the next. */
      watchers.slice().forEach(function (fn) {
        /* One page's throw must not stop the rest of the page repainting. */
        try { fn(key(), prev); } catch (e) {}
      });
    }
    arm();
  }

  function arm() {
    if (timer) { clearTimeout(timer); timer = null; }
    var now = new Date();
    var mid = new Date(now); mid.setHours(24, 0, 0, 0);
    var roll = new Date(now); roll.setHours(rollover(), 0, 0, 0);
    if (roll.getTime() <= now.getTime()) roll.setDate(roll.getDate() + 1);
    /* Five seconds past the edge, so a clock a shade fast cannot fire while
       it is still yesterday and then sit quiet until tomorrow. */
    var ms = Math.min(mid.getTime(), roll.getTime()) + 5000 - Date.now();
    if (!(ms > 0)) ms = 1000;
    timer = setTimeout(fire, ms);
  }

  function watch(fn) {
    if (typeof fn !== 'function') return function () {};
    if (lastStamp === null) lastStamp = stamp();
    watchers.push(fn);
    if (!bound) {
      bound = true;
      try {
        if (w.document) {
          w.document.addEventListener('visibilitychange', function () {
            if (!w.document.hidden) fire();
          });
        }
        if (w.addEventListener) {
          w.addEventListener('pageshow', function () { fire(); });
          w.addEventListener('focus', function () { fire(); });
        }
        arm();
      } catch (e) {}
    }
    return function () {
      var i = watchers.indexOf(fn);
      if (i >= 0) watchers.splice(i, 1);
    };
  }

  w.CTDay = {
    DEFAULT_ROLLOVER: DEFAULT_ROLLOVER,
    rollover: rollover,
    key: key, today: today, offset: offset, shift: shift,
    startMs: startMs, between: between,
    isoLocal: isoLocal,
    watch: watch,
    /* Exposed for the test, which drives the boundary rather than waiting
       for it — per CLAUDE.md, nothing here may read the wall clock to decide
       whether a day has passed. */
    _stamp: stamp, _fire: fire
  };
})(window);
