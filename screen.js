/* ─────────────────────────────────────────────────────────────────────────
   screen.js — what the phone's hours were spent on, defined once.

   The day-close used to ask for two numbers: total hours, and "social / fun"
   hours. That second box could not tell an hour of messages from an hour of
   a game or an evening of television, and those are the three the day is
   actually lost to in different ways — so it is three boxes now.

   Which immediately created the problem this file exists to prevent. Five
   places read that one figure — the Today card, the Life Log's day form and
   its correlation panel, systems.js for the board's sentence, and facts.js
   for the fact table — and if each of them added up the three buckets in its
   own way, they would drift, exactly as five hand-written copies of the site
   map drifted. So the arithmetic lives here and nowhere else.

   OFF-DUTY is the sum of the three: the part of the day's screen time that
   was not work, study or navigation. It is the direct successor of the old
   "social / fun" figure, which matters for the history: a day logged before
   the split carries its whole off-duty hour in `social`, so it lands in the
   same sum and no reading of your own past changes underneath you.

   A missing bucket is not a zero. Someone who logs social and leaves games
   empty has told you about social; treating the blank as 0.0 would be the
   hub inventing data. So null means "not told", and off-duty is null only
   when all three are.
   ───────────────────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  /* store key, what to call it in a form, what to call it in a sentence */
  var BUCKETS = [
    ['social', 'Social',        'social'],
    ['games',  'Games',         'games'],
    ['ent',    'Entertainment', 'entertainment']
  ];

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  /* The three buckets of one day's `screen` record, each a number or null. */
  function parts(scr) {
    var s = scr || {}, out = {};
    BUCKETS.forEach(function (b) { out[b[0]] = num(s[b[0]]); });
    return out;
  }

  function offDuty(scr) {
    var p = parts(scr), total = null;
    BUCKETS.forEach(function (b) {
      var v = p[b[0]];
      if (v == null) return;
      total = (total == null ? 0 : total) + v;
    });
    return total == null ? null : Math.round(total * 100) / 100;
  }

  /* "2h social · 1h games". Only the buckets that were filled in, and empty
     when there is nothing to break down — a single figure repeated back to
     you as its own breakdown is noise. */
  function split(scr) {
    var p = parts(scr), bits = [];
    BUCKETS.forEach(function (b) {
      var v = p[b[0]];
      if (v == null || v === 0) return;
      bits.push(v + 'h ' + b[2]);
    });
    return bits.length > 1 ? bits.join(' · ') : '';
  }

  /* The share of the phone that was off duty, 0–100, or null when either
     half is missing. Capped at 100: the buckets are typed by hand and can
     add up to more than the total the phone reported. */
  function share(scr) {
    var s = scr || {}, t = num(s.total), off = offDuty(s);
    if (t == null || off == null || t <= 0) return null;
    return Math.round(100 * Math.min(off, t) / t);
  }

  w.CTScreen = { BUCKETS: BUCKETS, num: num, parts: parts,
                 offDuty: offDuty, split: split, share: share };
})(window);
