/* ─────────────────────────────────────────────────────────────────────────
   wait.js — the rules of a wait, derived from the day it started.

   WHY THIS EXISTS. A decision made calmly on Thursday is re-litigated at
   02:00 on Saturday by a different person with the same phone. The plan was
   agreed once and in full — one ask, one bump, one week, then it is a no —
   and the failure mode is not forgetting it. It is arriving at Saturday
   night with a plausible reason why tonight is the exception.

   So the rules are not prose here, they are a gate: the page can say what
   today permits, because the dates are computed from the one fact worth
   storing — when the message actually went out. Everything else on the
   page is derived from that, per CLAUDE.md. A stored conclusion ("it is
   fine to write her") cannot notice that it disagrees with the calendar.

   THE TWO CLOCKS. She is in Warsaw, you are in Phoenix, and that gap is the
   whole reason the wait feels longer than it is: nine hours ahead means
   waking up to nothing is not silence, it is bedtime. So the elapsed figure
   this file reports is not hours, it is HER waking hours — the only count
   that answers "has she had a chance to answer yet".

   That conversion is real or it is nothing. `hers()` returns null when the
   runtime cannot resolve Europe/Warsaw rather than assuming an offset, for
   the same reason Money.convert() returns null on a missing rate: a number
   that is quietly wrong is worse than "not counted".
   ───────────────────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';
  /* Linked by Wait.html AND injected into every page by the deploy, because
     mornings.js reads its dates on pages that never heard of it. Loading
     twice is harmless but inlines the file twice behind the vault, so the
     second run bows out. */
  if (w.Wait) return;

  var KEY = 'ct_wait_v1';
  var ZONE = 'Europe/Warsaw';

  /* Her day, for the purposes of "could she have replied". Deliberately
     generous at both ends — the point is to stop counting 3am as silence,
     not to model her sleep. */
  var WAKE = 8, SLEEP = 23;

  /* The bump window. Saturday evening to the end of Sunday, because that is
     what was agreed, and because a weekday bump is the one that reads as
     pressure. 18:00 is "Saturday night" as distinct from "Saturday morning",
     which the plan explicitly gives away. */
  var BUMP_DOW = 6, BUMP_HOUR = 18;

  /* A bump the day after the ask is not a bump, it is the same message
     twice. If the ask itself went out on a Saturday evening, the window is
     the FOLLOWING weekend. */
  var MIN_GAP_MS = 24 * 3600 * 1000;

  var DAY_MS = 24 * 3600 * 1000;
  var CALL_IT_DAYS = 7;        // "about a week later, treat it as a no"
  var FLOOR_DAYS = 90;         // "no new reach for months unless something real changes"

  function readJSON(k, fb) {
    try { var r = localStorage.getItem(k); if (r) { var v = JSON.parse(r); if (v != null) return v; } }
    catch (e) {}
    return fb;
  }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  /* ── the store ──────────────────────────────────────────────────────────
     Four dates and nothing else. Not "am I allowed to text her" — that is an
     answer, and answers go stale the moment the clock moves past them. */
  function read() {
    var s = readJSON(KEY, null);
    if (!s || typeof s !== 'object') s = {};
    return {
      sent:   num(s.sent),     // the one ask
      bumped: num(s.bumped),   // the one bump, if it was used
      replied:num(s.replied),  // she wrote back
      closed: num(s.closed)    // the day the other door was shut
    };
  }
  function num(v) { var n = Number(v); return isFinite(n) && n > 0 ? n : null; }

  function write(s) { return writeJSON(KEY, s || {}); }
  function set(field, ts) {
    var s = read();
    s[field] = ts == null ? null : Number(ts);
    return write(s);
  }

  /* ── the gates ──────────────────────────────────────────────────────────
     All four derived from `sent`. Local time throughout: "Saturday night" is
     a Saturday night where the phone is, which is where the impulse is. */
  function gates(s) {
    s = s || read();
    if (!s.sent) return null;

    var opens = nextBumpOpen(s.sent);
    var closes = endOfDay(new Date(opens.getTime() + DAY_MS));   // the Sunday
    var last = s.bumped || s.sent;
    var callIt = new Date(last + CALL_IT_DAYS * DAY_MS);

    return {
      sent: new Date(s.sent),
      bumpOpens: opens,
      bumpCloses: closes,
      callIt: callIt,
      floor: new Date(callIt.getTime() + FLOOR_DAYS * DAY_MS)
    };
  }

  /* The first Saturday 18:00 that is at least a day clear of the ask. */
  function nextBumpOpen(sentTs) {
    var d = new Date(sentTs);
    var c = new Date(d.getFullYear(), d.getMonth(), d.getDate(), BUMP_HOUR, 0, 0, 0);
    /* Walk forward to a Saturday, then keep walking while it is too close. */
    while (c.getDay() !== BUMP_DOW || c.getTime() < sentTs + MIN_GAP_MS) {
      c = new Date(c.getFullYear(), c.getMonth(), c.getDate() + 1, BUMP_HOUR, 0, 0, 0);
    }
    return c;
  }

  function endOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  }

  /* ── what today permits ─────────────────────────────────────────────────
     One of six, and exactly one. The `allows` flag is what the page hangs a
     button off: there is no state in which sending is a judgement call. */
  function phase(s, now) {
    s = s || read();
    now = now == null ? Date.now() : Number(now);

    if (!s.sent) {
      return { id: 'none', title: 'Nothing recorded',
               line: 'Put in the day the message went out. Every date on this page comes from it.',
               allows: false };
    }
    if (s.replied) {
      return { id: 'replied', title: 'She wrote',
               line: 'Do not answer on impulse. Find out whether she actually wants to talk, ' +
                     'which is a different question from whether she replied.',
               allows: false };
    }

    var g = gates(s);

    if (now < g.bumpOpens.getTime()) {
      return { id: 'hold', title: 'Hold',
               line: 'Nothing goes out before ' + when(g.bumpOpens) + '. Not a follow-up, ' +
                     'not a lighter version of the same message.',
               allows: false };
    }
    if (!s.bumped && now <= g.bumpCloses.getTime()) {
      return { id: 'bump', title: 'One bump, if you still want to',
               line: 'The window closes ' + when(g.bumpCloses) + ' and it does not reopen. ' +
                     'Choosing not to use it is also using it.',
               allows: true };
    }
    if (now <= g.callIt.getTime()) {
      return { id: 'done', title: 'Done asking',
               line: s.bumped
                 ? 'The bump went ' + on(new Date(s.bumped)) + '. No more messages. The next move is hers.'
                 : 'The window closed unused. No more messages. The next move is hers.',
               allows: false };
    }
    return { id: 'called', title: 'Treat it as a no',
             line: 'Nothing by ' + on(g.callIt) + ', about a week after the last message. ' +
                   'There is no "I guess that’s a no" text to send — that is another ask ' +
                   'wearing a coat. Nothing new before ' + on(g.floor) + ' unless something real changes.',
             allows: false };
  }

  /* ── her clock ──────────────────────────────────────────────────────────
     Returns null rather than an assumed offset. See the header. */
  function hers(now) {
    now = now == null ? new Date() : new Date(Number(now));
    var p = partsIn(now);
    if (!p) return null;
    var awake = p.hour >= WAKE && p.hour < SLEEP;
    return {
      hh: pad(p.hour), mm: pad(p.minute),
      hour: p.hour,
      awake: awake,
      /* Hours she is AHEAD OF YOU, not ahead of UTC. Nine is the figure the
         whole page turns on, and it is read off two wall clocks rather than
         two stored offsets, so it survives either side's DST change. */
      offset: Math.round((zoned(now) - localZoned(now)) / 3600000)
    };
  }

  function partsIn(d) {
    try {
      var f = new Intl.DateTimeFormat('en-GB', {
        timeZone: ZONE, hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
      var o = {};
      f.formatToParts(d).forEach(function (x) { if (x.type !== 'literal') o[x.type] = x.value; });
      if (!o.hour || !o.year) return null;
      /* Intl reports midnight as 24 under hour12:false in some engines. */
      var h = Number(o.hour) % 24;
      return { year: +o.year, month: +o.month, day: +o.day, hour: h, minute: +o.minute };
    } catch (e) { return null; }
  }

  /* Her wall clock as a UTC-based instant, which is how the offset is read. */
  function zoned(d) {
    var p = partsIn(d);
    if (!p) return NaN;
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0, 0);
  }

  function localZoned(d) {
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(),
                    d.getHours(), d.getMinutes(), 0, 0);
  }

  /* ── the only count that answers "has she had a chance" ─────────────────
     Whole hours between WAKE and SLEEP, her time, since the ask. Stepped
     rather than solved, because DST inside the window is real and an
     arithmetic shortcut gets it wrong twice a year in the direction that
     flatters the impatient reading. */
  function wakingHours(fromTs, now) {
    if (!fromTs) return null;
    now = now == null ? Date.now() : Number(now);
    if (now <= fromTs) return 0;
    if (!partsIn(new Date(fromTs))) return null;

    var n = 0, t = fromTs;
    var guard = 0;
    /* Start at the top of the next whole hour so a partial hour is not
       rounded up into a grievance. */
    t = Math.ceil(t / 3600000) * 3600000;
    while (t <= now && guard++ < 24 * 400) {
      var p = partsIn(new Date(t));
      if (!p) return null;
      if (p.hour >= WAKE && p.hour < SLEEP) n++;
      t += 3600000;
    }
    return n;
  }

  /* ── formatting ─────────────────────────────────────────────────────── */
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function on(d) { return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; }
  function when(d) {
    var h = d.getHours();
    if (h === 23 && d.getMinutes() >= 59) return 'at the end of ' + on(d);
    return on(d) + ' ' + pad(h) + ':' + pad(d.getMinutes());
  }

  w.Wait = {
    KEY: KEY, ZONE: ZONE,
    read: read, write: write, set: set,
    gates: gates, phase: phase,
    hers: hers, wakingHours: wakingHours,
    on: on, when: when
  };
})(typeof window !== 'undefined' ? window : this);
