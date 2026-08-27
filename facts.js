/* ─────────────────────────────────────────────────────────────
   facts.js — one row per day, and the only place that joins them.

   THE PROBLEM. Every question worth asking of this hub is a question about
   two things at once: does clinic cost study hours, does the Anki queue build
   on the weeks you sleep badly, are the training days also the days the
   eating holds. None of them could be asked, because the systems did not
   share a coordinate system:

     ct_lifelog_v1.days['2026-08-27']   keyed by date  ✓
     ct_health_v1.days['2026-08-27']    keyed by date  ✓
     ct_anki_v1                         a single reading, overwritten
     ct_grind_v1.sessions['3|push']     keyed by week number and slot
     ct_study_v1.cards[].due            due dates, but no record of reviews

   So `trends()` in systems.js — which already had Pearson and a minimum-n
   guard, and was already correct — could only see the Life Log, and read
   training from there rather than from the Grind board, which keeps a
   training record the analysis has never been able to look at.

   THE SHAPE. A day is a flat row of numbers:

     ct_facts_v1 = { days: { '2026-08-27': { sleep: 7.2, study: 3.5,
                                             ankiReps: 118, rhr: 54, ... } } }

   DERIVED, NOT DEMANDED. The obvious design is for every system to append
   its own number here, which means editing six files and getting six chances
   to be wrong. Most of those stores are already dated, so this file reads
   them instead and builds the row itself — nothing to migrate, nothing to
   keep in step, and the history that already exists is there on first load.

   The exception is Anki, whose store holds one reading and is overwritten on
   every sync. That one has to be caught as it goes past: sync() stamps the
   current reading onto today's row, so the series starts accumulating the
   first time a page loads and cannot be reconstructed for any day before it.
   ───────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  var KEY = 'ct_facts_v1';

  function readJSON(k, fb) {
    try { var r = localStorage.getItem(k); if (r) { var v = JSON.parse(r); if (v != null) return v; } }
    catch (e) {}
    return fb;
  }
  function writeJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function isDay(k) { return /^\d{4}-\d{2}-\d{2}$/.test(k); }
  function today() {
    if (w.CTDay) return w.CTDay.key(Date.now());
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  function store() {
    var d = readJSON(KEY, null);
    if (!d || typeof d !== 'object') d = {};
    if (!d.days || typeof d.days !== 'object') d.days = {};
    return d;
  }

  /* Write a measurement onto a day. Used for the readings that cannot be
     recovered later — anything derivable is left to derive(). */
  function record(day, patch) {
    if (!isDay(day) || !patch) return false;
    var d = store();
    var row = d.days[day] || (d.days[day] = {});
    Object.keys(patch).forEach(function (k) {
      var v = num(patch[k]);
      if (v != null) row[k] = v;
    });
    d.at = Date.now();
    return writeJSON(KEY, d);
  }

  /* ── the derivations ────────────────────────────────────────────────
     Each reads a store that is already keyed by date and returns
     { day: { field: value } }. Anything that throws is skipped rather than
     taking the table down with it — a hub with one broken store should lose
     one column, not the analysis. */

  function fromLifeLog() {
    var out = {};
    var d = readJSON('ct_lifelog_v1', {}) || {};
    var days = d.days || {};
    Object.keys(days).forEach(function (k) {
      if (!isDay(k)) return;
      var dy = days[k] || {}, row = {};
      var sleep = dy.sleep || {};
      if (num(sleep.asleep) != null) row.sleep = num(sleep.asleep);
      var screen = dy.screen || {};
      if (num(screen.total) != null) row.screen = num(screen.total);
      if (num(screen.social) != null) row.social = num(screen.social);
      if (num(screen.pickups) != null) row.pickups = num(screen.pickups);
      var diet = dy.diet || {};
      var DIETQ = { clean: 3, ok: 2, loose: 1, bad: 0 };
      if (diet.q != null && DIETQ[diet.q] != null) row.diet = DIETQ[diet.q];
      /* Trained is a fact about the day, so it is 0 on a day that was logged
         at all and null on a day that was not — otherwise every unlogged day
         reads as a rest day and the correlation is against a fiction. */
      var logged = !!(dy.gym || dy.swim || dy.climb || dy.note || dy.screen || dy.sleep);
      if (logged) {
        row.trained = ((dy.gym && dy.gym.on) || (dy.swim && dy.swim.on) || (dy.climb && dy.climb.on)) ? 1 : 0;
      }
      if (Object.keys(row).length) out[k] = row;
    });
    /* Study hours live in sessions rather than on the day. */
    var sess = Array.isArray(d.sessions) ? d.sessions : [];
    sess.forEach(function (x) {
      var k = x && (x.day || x.date);
      var mins = num(x && (x.mins != null ? x.mins : x.minutes));
      if (!isDay(k) || mins == null) return;
      var row = out[k] || (out[k] = {});
      row.study = Math.round(((row.study || 0) + mins / 60) * 100) / 100;
    });
    return out;
  }

  function fromHealth() {
    var out = {};
    var d = readJSON('ct_health_v1', {}) || {};
    var days = d.days || {};
    /* Only the fields worth correlating. The import stores twenty-odd; a
       matrix with twenty rows is a wall, not an answer. */
    var TAKE = ['rhr', 'hrv', 'steps', 'activeKcal', 'exerciseMin', 'respRate',
                'spo2', 'hr', 'standMin', 'distanceKm', 'daylightMin', 'flights'];
    Object.keys(days).forEach(function (k) {
      if (!isDay(k)) return;
      var dy = days[k] || {}, row = {};
      TAKE.forEach(function (f) { if (num(dy[f]) != null) row[f] = num(dy[f]); });
      /* The Life Log's self-reported sleep wins when both exist — it is the
         one you answered for. The watch fills the nights you did not. */
      var sl = dy.sleep;
      if (sl && num(sl.asleep) != null) row.sleepWatch = num(sl.asleep);
      if (Object.keys(row).length) out[k] = row;
    });
    return out;
  }

  function fromAnatomy() {
    var out = {};
    var d = readJSON('ct_anatomy_v1', {}) || {};
    var days = d.days || {};
    Object.keys(days).forEach(function (k) {
      if (!isDay(k)) return;
      var dy = days[k];
      var n = Array.isArray(dy) ? dy.length
            : (dy && typeof dy === 'object')
              ? (Array.isArray(dy.closed) ? dy.closed.length : Object.keys(dy).length)
              : null;
      if (n != null) out[k] = { closures: n };
    });
    return out;
  }

  function fromWeekly() {
    /* Whether the week was reviewed, stamped on its Monday. Not a daily
       measure, but it is the only record of the cadence holding. */
    var out = {};
    var d = readJSON('ct_weekly_v1', {}) || {};
    var r = d.reviews || {};
    Object.keys(r).forEach(function (k) { if (isDay(k)) out[k] = { reviewed: 1 }; });
    return out;
  }

  /* Everything joined. Stored rows win over derived ones, because a stored
     row holds the readings that cannot be recovered — the Anki series above
     all. Derived columns refresh themselves on every read. */
  function all() {
    var merged = {};
    function fold(src) {
      try {
        var t = src();
        Object.keys(t).forEach(function (k) {
          merged[k] = Object.assign(merged[k] || {}, t[k]);
        });
      } catch (e) {}
    }
    fold(fromLifeLog); fold(fromHealth); fold(fromAnatomy); fold(fromWeekly);
    var saved = store().days;
    Object.keys(saved).forEach(function (k) {
      if (!isDay(k)) return;
      merged[k] = Object.assign(merged[k] || {}, saved[k]);
    });
    return merged;
  }

  /* Catch the readings that are overwritten rather than kept. Called on page
     load; cheap, and a no-op once today's row already holds them. */
  function sync() {
    var k = today(), patch = {};
    try {
      var a = readJSON('ct_anki_v1', null);
      if (a && typeof a === 'object') {
        /* A stale reading is yesterday's work. Stamping it on today would
           invent reps that did not happen, so only a fresh one is taken. */
        var at = String(a.at || '').slice(0, 10);
        if (!at || at === k) {
          var reps = num(a.repsToday != null ? a.repsToday : a.doneToday);
          if (reps != null) patch.ankiReps = reps;
          var q = num(a.dueTotal != null ? a.dueTotal
                    : (num(a.due) || 0) + (num(a.backlog) || 0));
          if (q != null) patch.ankiQueue = q;
          if (num(a.streak) != null) patch.ankiStreak = num(a.streak);
        }
      }
    } catch (e) {}
    try {
      /* The Grind board keys sessions by week and slot, so a session cannot
         be dated. What it can say is how much of the current week is done,
         which is at least a number that moves. */
      var g = readJSON('ct_grind_v1', null);
      if (g && typeof g === 'object' && g.sessions) {
        var wk = Math.max(1, parseInt(g.week, 10) || 1);
        var n = Object.keys(g.sessions).filter(function (key) {
          return g.sessions[key] && String(key).indexOf(wk + '|') === 0;
        }).length;
        patch.grindWeekDone = n;
      }
    } catch (e) {}
    if (!Object.keys(patch).length) return false;
    return record(k, patch);
  }

  /* ── statistics ─────────────────────────────────────────────────────
     CORR_MIN is 8, the same floor systems.js already applies: eight paired
     days before anything is reported, because a shape drawn from five points
     is a story, not a finding. */
  var CORR_MIN = 8;

  function pearson(xs, ys) {
    var n = xs.length;
    if (n < 2) return null;
    var sx = 0, sy = 0, i;
    for (i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; }
    var mx = sx / n, my = sy / n, num_ = 0, dx = 0, dy = 0;
    for (i = 0; i < n; i++) {
      var a = xs[i] - mx, b = ys[i] - my;
      num_ += a * b; dx += a * a; dy += b * b;
    }
    if (dx === 0 || dy === 0) return null;   // a flat column correlates with nothing
    return num_ / Math.sqrt(dx * dy);
  }

  function series(field, table) {
    var t = table || all(), out = [];
    Object.keys(t).sort().forEach(function (k) {
      var v = num(t[k][field]);
      if (v != null) out.push({ day: k, v: v });
    });
    return out;
  }

  function correlate(xField, yField, table) {
    var t = table || all();
    var xs = [], ys = [];
    Object.keys(t).sort().forEach(function (k) {
      var a = num(t[k][xField]), b = num(t[k][yField]);
      if (a == null || b == null) return;
      xs.push(a); ys.push(b);
    });
    var n = xs.length;
    return { n: n, r: n >= CORR_MIN ? pearson(xs, ys) : null, ready: n >= CORR_MIN };
  }

  /* Every pair, as a grid. rows are the things being explained, cols the
     things that might explain them — the asymmetry is the point, and it is
     what keeps this readable on a phone instead of an N x N wall. */
  function matrix(rows, cols) {
    var t = all();
    return rows.map(function (rf) {
      return {
        field: rf,
        cells: cols.map(function (cf) {
          var c = correlate(cf, rf, t);
          return { field: cf, n: c.n, r: c.r, ready: c.ready };
        })
      };
    });
  }

  /* The strongest thing worth saying, or nothing. Same discipline the Life
     Log's Trends panel already applies: below 0.2 there is no sentence. */
  function strongest(rows, cols, floor) {
    var best = null;
    matrix(rows, cols).forEach(function (row) {
      row.cells.forEach(function (c) {
        if (!c.ready || c.r == null) return;
        if (Math.abs(c.r) < (floor == null ? 0.2 : floor)) return;
        if (!best || Math.abs(c.r) > Math.abs(best.r)) {
          best = { x: c.field, y: row.field, r: c.r, n: c.n };
        }
      });
    });
    return best;
  }

  function fields() {
    var t = all(), seen = {};
    Object.keys(t).forEach(function (k) {
      Object.keys(t[k]).forEach(function (f) { seen[f] = (seen[f] || 0) + 1; });
    });
    return Object.keys(seen).sort(function (a, b) { return seen[b] - seen[a]; })
                            .map(function (f) { return { field: f, n: seen[f] }; });
  }

  w.CTFacts = {
    all: all, record: record, sync: sync, series: series,
    correlate: correlate, matrix: matrix, strongest: strongest,
    fields: fields, pearson: pearson, today: today, CORR_MIN: CORR_MIN, KEY: KEY
  };

  /* Catch the overwritten readings as soon as this file loads. */
  try { sync(); } catch (e) {}
})(typeof window !== 'undefined' ? window : this);
