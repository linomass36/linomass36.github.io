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

  w.CTDay = {
    DEFAULT_ROLLOVER: DEFAULT_ROLLOVER,
    rollover: rollover,
    key: key, today: today, offset: offset, shift: shift,
    startMs: startMs, between: between,
    isoLocal: isoLocal,
  };
})(window);
