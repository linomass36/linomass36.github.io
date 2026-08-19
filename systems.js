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
    var net = (parseFloat(last.cash) || 0) + (parseFloat(last.inv) || 0) - (parseFloat(last.debt) || 0);
    return Object.assign(base, {
      big: '$' + Math.round(net).toLocaleString('en-US'), unit: 'net worth', tone: '',
      line: snaps.length + (snaps.length === 1 ? ' snapshot' : ' snapshots') + ' on the ledger',
    });
  }

  var BUILDERS = [plan, anatomy, grind, study, reading, research, record, journal, weekly, vault];

  /* Every system, in the order you meet them in a day. A builder that throws
     is dropped rather than allowed to take the page with it — one broken
     store must not cost you the glance. */
  function all() {
    var out = [];
    BUILDERS.forEach(function (fn) {
      try { var v = fn(); if (v) out.push(v); } catch (e) {}
    });
    return out.sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
  }

  // The ones with something owed today, which is what a glance is actually for.
  function owed() { return all().filter(function (s) { return s.tone === 'go'; }); }

  w.Systems = { all: all, owed: owed, planCounts: planCounts, isoDay: isoDay, monday: monday };
})(window);
