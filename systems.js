/* ─────────────────────────────────────────────────────────────────────────
   systems.js — every system, in one line each.

   The hub had thirteen live systems and a front page that could see seven of
   them. The two the day is actually built around — the closure log and the
   grind board — were not among the seven: `ct_anatomy_v1` and `ct_grind_v1`
   appeared in Mission Control exactly once each, in the list of keys to back
   up. The page backed them up and never looked at them.

   This is the fix, and it is deliberately one file rather than a block of
   code on each page: a system publishes its state here, and every surface
   that wants a glance reads the same summary. When the grind board changes
   what "a week is done" means, the number on Today changes with it, because
   there is only one place that decides.

   Every summary is defensive. A store that has never been written, a
   programme file that a page chose not to load, a shape from an older
   version — each returns a resting line rather than throwing. A glance that
   crashes takes the whole page down with it, and this one is read by the
   page you open first every morning.

   Each entry is:
     { id, name, href, big, unit, line, tone, sort }
   `big` is the number you read without reading; `line` is the sentence under
   it; `tone` is 'go' when something is owed today, 'ok' when it is handled,
   '' when there is nothing to say.
   ───────────────────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw) { var v = JSON.parse(raw); if (v !== null && v !== undefined) return v; }
    } catch (e) {}
    return fallback;
  }

  function isoDay(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  // The Monday of the current week, which is how the weekly review keys itself.
  function monday() {
    var x = new Date();
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    x.setHours(0, 0, 0, 0);
    return isoDay(x);
  }

  /* The Life Log keys its days by the UTC date and filters sessions the same
     way. Anything reading that store has to use its convention, not the
     local one, or a late evening lands on tomorrow. */
  function logDay() { return new Date().toISOString().slice(0, 10); }

  // ── the closure log ────────────────────────────────────────────────────
  function anatomy() {
    var base = { id: 'anatomy', name: 'Anatomy', href: 'Anatomy.dc.html', sort: 1 };
    var A = w.AnatomyCore;
    if (!A) return Object.assign(base, { big: '—', unit: 'closure log', line: 'not loaded on this page', tone: '' });
    var s, sum;
    try { s = A.read(); sum = A.summary(s); } catch (e) {
      return Object.assign(base, { big: '—', unit: 'closure log', line: 'nothing logged yet', tone: '' });
    }
    if (sum.reentry) {
      return Object.assign(base, { big: sum.gap + 'd', unit: 'away', tone: 'go',
        line: 'Re-entry — run Core, that is a full day today' });
    }
    if (!sum.declared) {
      return Object.assign(base, { big: String(sum.openLoops), unit: 'open loops', tone: 'go',
        line: 'no tier declared yet · ' + sum.dueToday + ' retest' + (sum.dueToday === 1 ? '' : 's') + ' due' });
    }
    if (sum.tier === 'rest') {
      return Object.assign(base, { big: '·', unit: 'rest', tone: 'ok',
        line: 'rest declared — nothing accrues today' });
    }
    return Object.assign(base, {
      big: String(sum.openLoops), unit: 'open loops', tone: sum.p0 ? 'ok' : 'go',
      line: (sum.p0 ? 'Phase 0 done' : 'Phase 0 still open') + ' · ' +
            sum.dueToday + ' retest' + (sum.dueToday === 1 ? '' : 's') + ' due',
    });
  }

  /* ── the grind board ────────────────────────────────────────────────────
     The board's own rule: a week is five lifts plus the runs, and it advances
     when the work is done rather than when a week passes. Read the lift count
     off the programme when the page has loaded it, and fall back to the five
     the programme actually holds when it has not — this file is loaded by
     Today, which has no reason to carry 34KB of exercise text. */
  function GRIND_LIFTS() {
    var G = w.GRIND_DATA;
    if (G && G.GYM) { var n = Object.keys(G.GYM).length; if (n) return n; }
    return 5;
  }

  function grind() {
    var base = { id: 'grind', name: 'Grind board', href: 'Grind.dc.html', sort: 2 };
    var d = readJSON('ct_grind_v1', null);
    if (!d || typeof d !== 'object') {
      return Object.assign(base, { big: 'W1', unit: 'not started', tone: 'go',
        line: 'nine weeks, and the first session is week 1 day 1' });
    }
    var week = Math.max(1, +d.week || 1);
    var sessions = (d.sessions && typeof d.sessions === 'object') ? d.sessions : {};
    var runs = (d.runs && typeof d.runs === 'object') ? d.runs : {};
    var liftTotal = GRIND_LIFTS();
    var lifts = Object.keys(sessions).filter(function (k) {
      return sessions[k] && k.indexOf(week + '|') === 0;
    }).length;
    var runDone = !!runs['w' + week];
    var done = lifts + (runDone ? 1 : 0), total = liftTotal + 1;
    return Object.assign(base, {
      big: 'W' + week, unit: done + '/' + total + ' done', tone: done >= total ? 'ok' : 'go',
      line: done >= total
        ? 'week ' + week + ' is complete — it moves when you say so'
        : lifts + ' of ' + liftTotal + ' lifts · ' + (runDone ? 'runs done' : 'no runs yet'),
    });
  }

  // ── the study engine ───────────────────────────────────────────────────
  function study() {
    var base = { id: 'study', name: 'Study Engine', href: 'Study Engine.dc.html', sort: 3 };
    var d = readJSON('ct_study_v1', null);
    var cards = (d && Array.isArray(d.cards)) ? d.cards : [];
    if (!cards.length) return Object.assign(base, { big: '0', unit: 'cards', tone: '',
      line: 'no error cards yet — they come from what you get wrong' });
    var today = isoDay();
    var due = cards.filter(function (c) { return c && c.due && c.due <= today; }).length;
    return Object.assign(base, {
      big: String(due), unit: due === 1 ? 'card due' : 'cards due', tone: due ? 'go' : 'ok',
      line: due ? 'out of ' + cards.length + ' in rotation' : 'nothing due — ' + cards.length + ' in rotation',
    });
  }

  // ── the reading list ───────────────────────────────────────────────────
  /* ── Anki ───────────────────────────────────────────────────────────────
     This was in the prototype's mock data and never had a builder, so the
     Standing could not show it. It does now.

     The store is shaped for the sync that is coming rather than for the
     hand-entry that fills it today: whatever writes it — a script on the
     Mac reading collection.anki2, or you typing — writes the same fields,
     and `source` says which. A stale reading is labelled rather than
     presented as this morning's.

     The two numbers are shown together, always. A streak displayed without
     its debt is the number that produced the debt: the cheapest way to keep
     it alive is to skim, and skimming defers the rest.  */
  function anki() {
    var base = { id: 'anki', name: 'Anki', href: 'Standing.html#anki', sort: 3.5 };
    var d = readJSON('ct_anki_v1', null);
    if (!d || typeof d !== 'object') {
      return Object.assign(base, { big: '—', unit: 'not linked', tone: '',
        line: 'no reading yet — run the Mac sync, or type one in' });
    }
    var due = Math.max(0, parseInt(d.due, 10) || 0);
    var back = Math.max(0, parseInt(d.backlog, 10) || 0);
    var streak = Math.max(0, parseInt(d.streak, 10) || 0);
    var reps = Math.max(0, parseInt(d.repsToday != null ? d.repsToday : d.doneToday, 10) || 0);
    var cards = parseInt(d.cardsToday, 10);
    /* Totals take the mean: total time is n x mean, and costing a pile at
       the median understates it by the whole long tail. */
    var sec = parseFloat(d.secMean) || parseFloat(d.secPerCard) || 0;

    /* What is LEFT is the queue itself, not the queue minus today's reps.
       Subtracting was wrong twice over: a rep is not a card, and a card
       answered Again is still due. The reading already carries the live
       queue, so it is simply read rather than derived. */
    var waiting = (d.dueTotal != null) ? Math.max(0, parseInt(d.dueTotal, 10) || 0) : (due + back);
    var mins = sec ? Math.round(waiting * sec / 60) : null;

    var age = d.at ? Math.max(0, Math.round(
      (new Date(isoDay() + 'T12:00:00') - new Date(String(d.at).slice(0, 10) + 'T12:00:00')) / 86400000)) : null;
    /* Staleness is stated, never hidden. A reading two days old is not shown
       as though it were this morning's — that is the failure mode a sync has,
       and the one moment the page must not sound confident. */
    if (age !== null && age > 1) {
      return Object.assign(base, { big: streak ? streak + 'd' : '—', unit: 'stale',
        tone: '', line: 'last reading ' + age + ' days ago — the sync is not running' });
    }
    /* One day old is still useful, but the reps in it happened yesterday, and
       calling them today's would be a small lie told every morning. */
    var when = age === 1 ? ' yesterday' : ' today';

    var didLine = reps
      ? reps + ' rep' + (reps === 1 ? '' : 's') +
        (cards ? ' on ' + cards + ' card' + (cards === 1 ? '' : 's') : '') + when
      : 'nothing done' + when;
    var line = waiting === 0
      ? didLine + ' · queue empty'
      : didLine + ' · ' + waiting + ' waiting' + (mins ? ' (' + mins + ' min)' : '');

    return Object.assign(base, {
      big: streak ? streak + 'd' : String(waiting),
      unit: waiting ? waiting + ' waiting' : 'clear',
      tone: waiting === 0 ? 'ok' : 'go',
      line: line
    });
  }

  function reading() {
    var base = { id: 'reading', name: 'Reading list', href: 'Reading List.dc.html', sort: 4 };
    var st = readJSON('ct_reading_v1', {}) || {};
    var status = st.status || {};
    var shelves = ((w.READING_DATA || {}).shelves) || [];
    var mine = readJSON('ct_reading_books_v1', []);
    var total = 0;
    shelves.forEach(function (s) { total += ((s.items || []).length); });
    if (Array.isArray(mine)) total += mine.length;
    var vals = Object.keys(status).map(function (k) { return status[k]; });
    var read = vals.filter(function (v) { return v === 'read'; }).length;
    var now = vals.filter(function (v) { return v === 'reading'; }).length;
    return Object.assign(base, {
      big: String(now), unit: now === 1 ? 'on the go' : 'on the go', tone: now ? 'ok' : 'go',
      line: now ? read + ' of ' + total + ' read' : 'nothing in progress — pick one off the shelf',
    });
  }

  /* ── the master plan ────────────────────────────────────────────────────
     371 steps is an inventory, not a plan. The branches already carry a
     timeframe, so they already say which of them is live now, which stands
     all year and which is years out; `horizon` on each branch just makes that
     machine-readable. Nothing is hidden and nothing is deleted — the count
     you are shown is the one you can act on this term, and the whole number
     is right beside it. */
  function planCounts() {
    var data = w.HUB_DATA || {};
    var items = data.items || [];
    var branches = data.branches || [];
    var horizonOf = {};
    branches.forEach(function (b) { horizonOf[b.id] = b.horizon || 'later'; });
    var plan = readJSON('ct-master-plan-v2', {}) || {};
    var checked = plan.checked || {};
    var out = { now: 0, nowDone: 0, standing: 0, standingDone: 0, later: 0, laterDone: 0,
                total: items.length, totalDone: 0 };
    items.forEach(function (it) {
      var h = horizonOf[it.branchId] || 'later';
      var done = !!checked[it.id];
      out[h] += 1;
      out[h + 'Done'] += done ? 1 : 0;
      out.totalDone += done ? 1 : 0;
    });
    out.live = out.now + out.standing;
    out.liveDone = out.nowDone + out.standingDone;
    out.pct = out.live ? Math.round(out.liveDone / out.live * 100) : 0;
    out.pctAll = out.total ? Math.round(out.totalDone / out.total * 100) : 0;
    return out;
  }

  function plan() {
    var c = planCounts();
    return { id: 'plan', name: 'The plan', href: 'CT Master Plan.html', sort: 0,
      big: c.pct + '%', unit: 'this term', tone: '',
      line: c.liveDone + ' of ' + c.live + ' live steps · ' + c.later + ' more further out',
      counts: c };
  }

  // ── the research portfolio ─────────────────────────────────────────────
  function research() {
    var base = { id: 'research', name: 'Research plan', href: 'Research Plan.dc.html', sort: 5 };
    var d = readJSON('ct_research_v1', null);
    var done = (d && d.done && typeof d.done === 'object') ? Object.keys(d.done).length : 0;
    var gates = (d && d.gates && typeof d.gates === 'object') ? Object.keys(d.gates).length : 0;
    var NINETY = 9, GATES = 5;
    return Object.assign(base, {
      big: done + '/' + NINETY, unit: 'ninety days', tone: done >= NINETY ? 'ok' : 'go',
      line: gates ? gates + ' of ' + GATES + ' gates decided' : 'no gate decided yet — ' + GATES + ' waiting',
    });
  }

  // ── the weekly review ──────────────────────────────────────────────────
  function weekly() {
    var base = { id: 'weekly', name: 'Weekly review', href: 'Weekly Review.dc.html', sort: 8 };
    var d = readJSON('ct_weekly_v1', {}) || {};
    var reviews = d.reviews || {};
    var doneThis = !!reviews[monday()];
    var n = Object.keys(reviews).length;
    return Object.assign(base, {
      big: doneThis ? '✓' : 'DUE', unit: doneThis ? 'this week' : 'this week', tone: doneThis ? 'ok' : 'go',
      line: doneThis ? 'reviewed — the plan lives on this cadence'
                     : (n ? n + ' reviews behind you' : 'the plan lives on this cadence'),
    });
  }

  // ── the record ─────────────────────────────────────────────────────────
  function record() {
    var base = { id: 'record', name: 'Life Log', href: 'Life Log.dc.html', sort: 6 };
    var d = readJSON('ct_lifelog_v1', {}) || {};
    var days = d.days || {};
    var k = logDay();
    var today = days[k] || {};
    var closed = !!(today.screen && (today.screen.total !== undefined && today.screen.total !== ''));
    var n = Object.keys(days).length;
    return Object.assign(base, {
      big: String(n), unit: n === 1 ? 'day logged' : 'days logged', tone: closed ? 'ok' : 'go',
      line: closed ? 'today is closed' : 'today is not closed yet',
    });
  }

  // ── the journal ────────────────────────────────────────────────────────
  function journal() {
    var base = { id: 'journal', name: 'Journal', href: 'Journal.dc.html', sort: 7 };
    var list = readJSON('ct_journal_v1', []);
    if (!Array.isArray(list)) list = [];
    var today = isoDay();
    var n = list.filter(function (e) { return e && e.date === today; }).length;
    return Object.assign(base, {
      big: String(list.length), unit: list.length === 1 ? 'entry' : 'entries', tone: n ? 'ok' : '',
      line: n ? n + ' written today' : 'nothing written today yet',
    });
  }

  // ── the vault ──────────────────────────────────────────────────────────
  function vault() {
    var base = { id: 'vault', name: 'The Vault', href: 'Vault.dc.html', sort: 9 };
    var d = readJSON('ct_vault_v1', {}) || {};
    var snaps = Array.isArray(d.snaps) ? d.snaps : (Array.isArray(d.snapshots) ? d.snapshots : []);
    if (!snaps.length) return Object.assign(base, { big: '—', unit: 'net worth', tone: '',
      line: 'no snapshot yet — one a month is plenty' });
    var last = snaps[snaps.length - 1] || {};

    /* This used to hardcode a dollar sign while the Vault page had its own
       currency setting, so a PLN balance was read back here as dollars.
       money.js owns the conversion now, and when a rate is missing the line
       says which currency is uncounted rather than reporting a total that
       is quietly short a holding. */
    var M = w.Money;
    if (!M) {
      var net0 = (parseFloat(last.cash) || 0) + (parseFloat(last.inv) || 0) - (parseFloat(last.debt) || 0);
      return Object.assign(base, { big: String(Math.round(net0)), unit: 'net worth', tone: '',
        line: snaps.length + (snaps.length === 1 ? ' snapshot' : ' snapshots') + ' on the ledger' });
    }
    var display = (d.display && M.CODES.indexOf(d.display) >= 0) ? d.display : M.read().base;
    var r = M.netOf(last, display, d.assume || display);
    var parts = r.parts.map(function (p) { return M.fmt(p.net, p.ccy); });
    var line;
    if (!r.complete) {
      line = 'missing a rate for ' + r.missing.join(', ') + ' — that holding is not counted';
    } else if (r.parts.length > 1) {
      line = parts.join('  +  ') + ' — converted for reading only';
    } else {
      line = snaps.length + (snaps.length === 1 ? ' snapshot' : ' snapshots') + ' on the ledger';
    }
    var st = M.stale();
    if (r.parts.length > 1 && st.isStale) line += ' · rate ' + st.days + 'd old';
    return Object.assign(base, {
      big: M.fmt(r.total, display), unit: 'net worth',
      tone: r.complete ? '' : 'go', line: line
    });
  }

  var CORR_MIN = 8;

  function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }

  function pearson(xs, ys) {
    var n = xs.length;
    if (n < 2) return null;
    var mx = 0, my = 0, i;
    for (i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
    mx /= n; my /= n;
    var acc = 0, dx = 0, dy = 0;
    for (i = 0; i < n; i++) {
      var a = xs[i] - mx, b = ys[i] - my;
      acc += a * b; dx += a * a; dy += b * b;
    }
    var den = Math.sqrt(dx * dy);
    return den ? acc / den : null;
  }

  // The Life Log's rule, unchanged: a typed hours override for a subject
  // wins, otherwise that subject's sessions for the day are summed.
  var SUBJECTS = ['anatomy', 'math', 'python', 'research', 'other'];
  function studyHoursDay(d, day) {
    var st = ((d.days[day] || {}).study) || {}, h = 0;
    SUBJECTS.forEach(function (sub) {
      var ov = st[sub] && st[sub].h;
      if (ov !== undefined && ov !== null && ov !== '') { h += num(ov) || 0; return; }
      (d.sessions || []).forEach(function (x) {
        if (x && x.type === 'study' && x.subject === sub &&
            new Date(x.start).toISOString().slice(0, 10) === day) h += (x.end - x.start) / 3600000;
      });
    });
    return h;
  }

  function trends() {
    var d = readJSON('ct_lifelog_v1', {}) || {};
    if (!d.days || typeof d.days !== 'object') d.days = {};
    if (!Array.isArray(d.sessions)) d.sessions = [];

    var social = function (k) { return num((((d.days[k] || {}).screen) || {}).social); };
    var dietScore = function (k) { return ({ clean: 3, ok: 2, loose: 1, bad: 0 })[(((d.days[k] || {}).diet) || {}).q]; };
    var trainedOn = function (k) {
      var dd = d.days[k] || {};
      return ((dd.gym && dd.gym.on) || (dd.swim && dd.swim.on) || (dd.climb && dd.climb.on)) ? 1 : 0;
    };

    var METRICS = [
      ['sleep',    'Sleep',    'hours asleep',        function (k) { return num((((d.days[k] || {}).sleep) || {}).asleep); }],
      ['study',    'Study',    'hours studied',       function (k) { var h = studyHoursDay(d, k); return h > 0 ? h : null; }],
      ['training', 'Training', 'trained or not',      function (k) {
        var dd = d.days[k] || {};
        return (dd.gym || dd.swim || dd.climb || dd.note || dd.screen) ? trainedOn(k) : null; }],
      ['diet',     'Diet',     'how the eating went', function (k) { var v = dietScore(k); return v === undefined ? null : v; }],
    ];

    var days = Object.keys(d.days).sort();
    var paired = days.filter(function (k) { return social(k) != null; });

    var rows = METRICS.map(function (m) {
      var xs = [], ys = [];
      paired.forEach(function (k) {
        var y = m[3](k);
        if (y == null) return;
        xs.push(social(k)); ys.push(y);
      });
      var r = xs.length >= CORR_MIN ? pearson(xs, ys) : null;
      return { key: m[0], label: m[1], unit: m[2], n: xs.length, r: r,
               ready: xs.length >= CORR_MIN, mag: r == null ? 0 : Math.abs(r) };
    });

    // The strongest thing worth saying, or nothing at all.
    var best = rows.filter(function (x) { return x.ready && x.r != null && x.mag >= 0.2; })
                   .sort(function (a, b) { return b.mag - a.mag; })[0] || null;

    var sentence = '';
    if (best) {
      sentence = 'Your heavier social-screen days run with ' + (best.r < 0 ? 'less ' : 'more ') +
                 best.unit + ' (r ' + (best.r > 0 ? '+' : '') + best.r.toFixed(2) + ', over ' +
                 best.n + ' days). Does anything change?';
    }

    return { min: CORR_MIN, days: paired.length, rows: rows, best: best, sentence: sentence,
             ready: paired.length >= CORR_MIN };
  }

  var BUILDERS = [plan, anatomy, grind, study, anki, reading, research, record, journal, weekly, vault];

  /* Every system, in the order you meet them in a day. A builder that throws
     is dropped rather than allowed to take the page with it — one broken
     store must not cost you the glance. */
  function all() {
    var out = [];
    BUILDERS.forEach(function (fn) {
      try { var v = fn(); if (v) out.push(v); } catch (e) {}
    });
    out.sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
    return applyConditions(out);
  }

  /* ── conditions ────────────────────────────────────────────────────────
     A declared condition names what is constrained and which systems that
     covers; those go HELD. This is applied HERE rather than on one page, so
     every surface that reads this file — Today, Mission Control, the
     Standing — agrees about what is owed. A held system rendered as red on
     one page and quiet on another would be worse than not having the idea.

     Held is deliberately neither 'go' nor 'ok'. It is not owed, so it can
     never read as failure; and it is not handled either, because pretending
     it was done would be the other kind of lie. conditions.js may not be
     loaded on a given page, in which case nothing is held and this is a
     no-op. */
  function applyConditions(list) {
    var C = w.Conditions;
    if (!C || typeof C.heldIds !== 'function') return list;
    var held;
    try { held = C.heldIds(); } catch (e) { return list; }
    return list.map(function (s) {
      if (!held[s.id]) return s;
      var o = {}; for (var k in s) o[k] = s[k];
      o.tone = 'held';
      o.unit = 'held';
      o.line = 'held while the condition stands — nothing accrues';
      return o;
    });
  }

  // The ones with something owed today, which is what a glance is actually for.
  function owed() { return all().filter(function (s) { return s.tone === 'go'; }); }

  // The ones a condition is currently covering.
  function held() { return all().filter(function (s) { return s.tone === 'held'; }); }

  /* Drift: days since anything was logged. A rut is data the hub already
     holds, and naming it is most of the intervention — so it is computed
     rather than felt. Reads the Life Log, which is the one store that gets
     written on any kind of day. */
  function drift() {
    var d = readJSON('ct_lifelog_v1', null);
    var days = (d && d.days && typeof d.days === 'object') ? d.days : null;
    if (!days) return 0;
    var keys = Object.keys(days).filter(function (k) { return days[k]; }).sort();
    if (!keys.length) return 0;
    /* The Life Log keys its days by the UTC date, so the comparison has to
       use its convention rather than the local one, or a late evening lands
       on tomorrow and reports a day of drift that has not happened. */
    var last = keys[keys.length - 1];
    var gap = Math.round((new Date(logDay() + 'T12:00:00') - new Date(last + 'T12:00:00')) / 86400000);
    return Math.max(0, gap);
  }

  /* A floor day is any day the hub has reason to lower the bar: a condition
     stands, or the log says you have drifted. On one the page asks for a
     single thing and does not render the red column at all. */
  function floorDay() {
    var C = w.Conditions;
    var any = false;
    try { any = !!(C && C.active().length); } catch (e) {}
    return any || drift() >= 3;
  }

  w.Systems = { all: all, owed: owed, held: held, drift: drift, floorDay: floorDay,
                planCounts: planCounts, isoDay: isoDay, monday: monday,
                trends: trends, pearson: pearson, CORR_MIN: CORR_MIN };
})(window);
