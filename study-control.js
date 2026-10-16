/* ─────────────────────────────────────────────────────────────────────────
   study-control.js — owns the term: the classes, the results, the Anki weeks,
   and the ten rules that decide when something has to change.

   WHY THIS IS A FILE AND NOT A PAGE'S INLINE SCRIPT. Study Control was built
   as a standalone page for the start of Year 2, and it was the one thing in
   use while the hub went unopened for a month. It kept its data under
   `studyControl.v1`, which sync.js does not push and the backup does not
   enumerate as a hub store, and it computed its flags in the page — so the
   Standing could not ask it anything. The hub's drift counter read the Life
   Log and the season board, saw a month of neither, and would have greeted
   the busiest weeks of the year as a rut. Same failure as the season board
   (see systems.js and tools/rut.test.js): a store the front door cannot see
   reads as silence.

   So the rules and the store live here, the page renders them, and anything
   else that wants to know about the term asks this file:

     StudyControl.flags(store, now)     every rule that trips, R1–R10
     StudyControl.open(store, now)      the ones not marked handled
     StudyControl.nextGraded(store,now) the next quiz, test or partial
     StudyControl.lastTold(store, now)  the last day it was told anything —
                                        what Systems.drift() reads
     StudyControl.summary(now)          the Standing's card, or null when
                                        the store has never been written

   STORE. ct_studycontrol_v1 = { events, results, anki, actions, told }, each
   of the first four a map of id → doc. `told` is a set of day keys, stamped on
   every write, because a prep tick carries no date of its own and "ticked the
   prep for Friday's test tonight" is exactly the evidence drift must see.

   `now` is accepted everywhere so a test drives the clock rather than reads it.
   ───────────────────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  var KEY = 'ct_studycontrol_v1';
  var LEGACY = 'studyControl.v1';

  var SUBJ = {
    anatomy:    { name: 'Anatomy',    c: '--ana', prep: ['Read Moore + blue boxes', 'Region’s cards live', 'Identify drill', 'Blank page'] },
    histology:  { name: 'Histology',  c: '--his', prep: ['Wheater first look', 'Junqueira section', 'Drew it', 'SecondLook sets'] },
    physiology: { name: 'Physiology', c: '--phy', prep: ['Read set Guyton pages', 'Cards for the pages', 'Practice questions', 'Blank page'] },
    embryology: { name: 'Embryology', c: '--emb', prep: ['Read BWAB chapter', 'Embryo cards', 'Timeline from memory', 'Practice questions'] }
  };
  var SK = Object.keys(SUBJ);

  var CAUSES = {
    wrong:   ['Studied the wrong material', 'Confirm the set topic three days ahead: syllabus, then ask the lecturer or class rep. Don’t trust the group chat alone.'],
    nocards: ['Made no cards', 'Cards within 24 hours of every class, before anything new. Reading and AI questions don’t count as cards.'],
    notread: ['Didn’t finish reading', 'Reading done two days before the class, not the night before.'],
    recall:  ['Recognised it but couldn’t recall', 'Blank-page before the test instead of rereading.'],
    image:   ['Couldn’t identify it on the image', 'Daily image drills: SecondLook sets or cadaver images, 10 minutes.'],
    detail:  ['Missed small details', 'Card the misses, and read the book’s tables and figure captions.'],
    time:    ['Ran out of time', 'Timed practice in the test’s own format.'],
    misread: ['Misread the question', 'Read the stem twice and underline what it asks.']
  };
  var KIND = { quiz: 'Class quiz', entrance: 'Entrance test', partial: 'Partial', practice: 'Practice' };

  /* ── the study group ─────────────────────────────────────────────────────
     From the Year 2 Study Group Manual (version of 10 October 2026): three
     sessions a week, each the day before the class or test it prepares, and
     you lead anatomy. They are written into the store as ordinary events —
     not computed on the fly — so each one can be edited (the manual says to
     fix one time per slot; the times were not chosen when this was written)
     or deleted like any class. A deleted one is remembered in `dismissed` so
     it is not put back. Crunch weeks carry the manual's own note. */
  var GROUP = {
    from: '2026-10-11', to: '2027-01-31',
    sessions: [
      { dow: 0, subject: 'histology',  mins: 45, prepares: 'Monday\u2019s histology lab' },
      { dow: 3, subject: 'anatomy',    mins: 90, prepares: 'Thursday\u2019s anatomy lab', lead: true },
      { dow: 4, subject: 'physiology', mins: 60, prepares: 'Friday\u2019s entrance test' }
    ],
    crunch: [
      { from: '2026-10-25', to: '2026-10-30', note: 'Anatomy Lab 5 Thursday, then the 57-page physiology test Friday; read special senses the weekend before.' },
      { from: '2026-11-08', to: '2026-11-13', note: 'Histology lab Monday, anatomy Module A partials Tuesday and Thursday, physiology Friday; prepare physiology the weekend before.' },
      { from: '2026-12-13', to: '2026-12-18', note: 'Histology slide test (date to confirm), anatomy Module B Thursday, physiology Friday.' },
      { from: '2027-01-06', to: '2027-01-15', note: 'Anatomy Lab 12 and Modules C and D, physiology heart and ECG tests.' }
    ]
  };
  var SESSION_PREP = ['Prompt card and key written', 'Own study done', 'Last Fix list read'];
  function isSession(ev) { return ev && ev.kind === 'session'; }
  /* What "prep" means for an event: the subject's four steps for a class,
     and for a group session your own study and the last Fix list — plus the
     prompt card first when you lead it. */
  function prepFor(ev) {
    if (isSession(ev)) return ev.lead ? SESSION_PREP.slice() : SESSION_PREP.slice(1);
    return (SUBJ[ev.subject] || { prep: [] }).prep;
  }

  /* ── dates ── all day keys are local YYYY-MM-DD, as the page always used.
     The hub's 05:00 boundary (day.js) decides what "today" is when present,
     so a quiz logged at 01:00 belongs to the evening it was studied for. */
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function diff(a, b) { return Math.round((parse(a) - parse(b)) / 864e5); }
  function monday(s) { var d = parse(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return iso(d); }
  function today(now) {
    var t = now == null ? Date.now() : now;
    try { if (w.CTDay && typeof w.CTDay.key === 'function') return w.CTDay.key(t); } catch (e) {}
    return iso(new Date(t));
  }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function short(s) { var d = parse(s); return d.getDate() + ' ' + MON[d.getMonth()]; }

  /* ── the term as first written, used once when nothing is stored ── */
  var SEED = { events: {}, results: {}, anki: {}, actions: {}, told: {} };
  (function seed() {
    var E = SEED.events;
    function ev(id, date, time, subject, kind, title, note, graded) {
      E[id] = { date: date, time: time, subject: subject, kind: kind, title: title, note: note || '', graded: !!graded, prep: {} };
    }
    ev('ana-lab3', '2026-10-15', '10:15', 'anatomy', 'lab', 'Lab 3 · skull and neck');
    ev('ana-lab4', '2026-10-22', '10:15', 'anatomy', 'lab', 'Lab 4 · abdominal wall, pelvis, perineum');
    ev('ana-lab5', '2026-10-29', '10:15', 'anatomy', 'lab', 'Lab 5 · lower limb', 'Day before the 57-page physiology test');
    ev('ana-pA-theory', '2026-11-10', '', 'anatomy', 'partial', 'Module A theory partial', 'Back, thoracic wall, upper limb, skull and neck, abdominal wall, pelvis, perineum, lower limb');
    ev('ana-pA-prac', '2026-11-12', '', 'anatomy', 'partial', 'Module A practical partial', 'Format and accepted names (Latin or English) still to confirm');
    ev('ana-pB', '2026-12-17', '', 'anatomy', 'partial', 'Module B partial · neuroanatomy', 'Practical and theory');
    ev('ana-lab12', '2027-01-07', '10:15', 'anatomy', 'lab', 'Lab 12 · heart, pericardium, mediastinum');
    ev('ana-pCD-theory', '2027-01-12', '', 'anatomy', 'partial', 'Modules C and D theory partial');
    ev('ana-pCD-prac', '2027-01-14', '', 'anatomy', 'partial', 'Modules C and D practical partial');
    var HIS = [['W2', '2026-10-12', 'connective tissue, cartilage, bone'], ['W3', '2026-10-19', 'muscle'],
               ['W4', '2026-11-05', 'epithelium, glands, skin, ear'], ['W5', '2026-11-09', 'nervous tissue, eye'],
               ['W6', '2026-11-30', 'blood, immune system'], ['W7', '2026-12-07', 'circulatory system']];
    HIS.forEach(function (h, i) {
      ev('his-' + h[0], h[1], '', 'histology', 'lab', h[0] + ' · ' + h[2],
         i === 0 ? 'Quiz at the lab' : 'Quiz at the lab. Confirm the set chapter by Friday.', true);
    });
    ev('his-c8', '2026-12-14', '', 'histology', 'partial', 'Class 8 · slide recognition, W1–W7', 'Date to confirm');
    var PHY = { '2026-10-30': 'Special senses, 57 pages, day after anatomy Lab 5: start the weekend before',
                '2026-11-13': 'Day after the anatomy practical: prepare the weekend before',
                '2027-01-08': 'Heart' };
    ['2026-10-16', '2026-10-23', '2026-10-30', '2026-11-06', '2026-11-13', '2026-11-20', '2026-11-27',
     '2026-12-04', '2026-12-11', '2026-12-18', '2027-01-08', '2027-01-15', '2027-01-22', '2027-01-29']
      .forEach(function (d) { ev('phy-' + d, d, '12:45', 'physiology', 'test', 'Entrance test', PHY[d] || 'Add the set Guyton pages', true); });
    ['2026-10-14', '2026-10-21', '2026-10-28', '2026-11-04', '2026-11-18', '2026-11-25', '2026-12-02', '2026-12-09', '2026-12-16']
      .forEach(function (d) { ev('emb-' + d, d, '13:00', 'embryology', 'seminar', 'Seminar', 'Add the topic and BWAB chapter'); });

    SEED.results = {
      'r-his-1012': { date: '2026-10-12', subject: 'histology', kind: 'quiz', title: 'W2 lab quiz', score: 6, max: 9, estimate: true, causes: ['wrong', 'nocards'], misses: '', errorCards: false, createdAt: '2026-10-12T14:00:00Z' },
      'r-phy-1009': { date: '2026-10-09', subject: 'physiology', kind: 'entrance', title: 'Guyton Ch 4–5', score: 7, max: 10, estimate: true, causes: [], misses: '', errorCards: false, createdAt: '2026-10-09T14:00:00Z' },
      'r-phy-prac': { date: '2026-10-09', subject: 'physiology', kind: 'practice', title: 'Guyton Review, Ch 4–5', score: 12, max: 16, estimate: false, causes: [], misses: '', errorCards: false, createdAt: '2026-10-09T08:00:00Z' }
    };
    SEED.anki = {
      'w2026-10-05': { week: '2026-10-05', note: 'Partial: 1–8 Oct from the 9 Oct export, real time rebuilt. Anatomy recall is Prime cards 18 Sep – 8 Oct.',
        anatomy: { min: 38, recall: 69, backlog: 284 }, physiology: { min: 14, recall: 84, newc: 26, backlog: 514 }, histology: { min: 4, recall: 67 } }
    };
  })();

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function shape(d) {
    d = d || {};
    return { events: d.events || {}, results: d.results || {}, anki: d.anki || {},
             actions: d.actions || {}, told: d.told || {}, dismissed: d.dismissed || {} };
  }

  /* ── the store ── */
  function ls() { try { return w.localStorage || null; } catch (e) { return null; } }
  function has() { var L = ls(); try { return !!(L && L.getItem(KEY)); } catch (e) { return false; } }

  /* The standalone page's key is read once and copied across, never deleted:
     a copy that turned out wrong can be thrown away, a deleted original can't. */
  function read() {
    var L = ls();
    try {
      var r = L && L.getItem(KEY);
      if (r) return shape(JSON.parse(r));
      var old = L && L.getItem(LEGACY);
      if (old) return shape(JSON.parse(old));
    } catch (e) {}
    return clone(SEED);
  }
  function write(s, now) {
    s = shape(s);
    s.told[today(now)] = 1;
    var L = ls();
    if (!L) return false;
    try { L.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
  }

  /* Opening the page is adopting it: whatever it would show — the old key's
     data, or the seed — is written under the hub key so the Standing can see
     it. Without stamping `told`: opening a page is not reporting a day. */
  function adopt() {
    if (has()) return false;
    var L = ls();
    try { L.setItem(KEY, JSON.stringify(read())); return true; } catch (e) { return false; }
  }

  /* Writes the group's sessions into the store once each. Not a write that
     stamps `told`: a schedule appearing is not you reporting a day. */
  function ensureGroup() {
    var L = ls(); if (!L || !has()) return 0;
    var s = read(), added = 0;
    for (var d = GROUP.from; d <= GROUP.to; d = addDays(d, 1)) {
      var dow = parse(d).getDay();
      GROUP.sessions.forEach(function (g) {
        if (g.dow !== dow) return;
        var id = 'grp-' + g.subject + '-' + d;
        if (s.events[id] || s.dismissed[id]) return;
        var crunch = GROUP.crunch.filter(function (c) { return d >= c.from && d <= c.to; })[0];
        s.events[id] = { date: d, time: '', subject: g.subject, kind: 'session', graded: false, prep: {},
          lead: !!g.lead, title: 'Study group \u00b7 ' + SUBJ[g.subject].name + ' (' + g.mins + ' min)',
          note: 'Prepares ' + g.prepares + (g.lead ? '. You lead: prompt card and key the evening before' : '') +
                (crunch ? '. Crunch week: the subject being tested gets the full session, the others 30 min or skip. ' + crunch.note : '') };
        added++;
      });
    }
    if (added) { try { L.setItem(KEY, JSON.stringify(s)); } catch (e) { return 0; } }
    return added;
  }

  /* The arrays the rules work on, each doc carrying its id. */
  function view(s) {
    s = shape(s);
    function list(m) { return Object.keys(m).map(function (id) { var d = Object.assign({}, m[id]); d.id = id; return d; }); }
    var actions = {};
    list(s.actions).forEach(function (a) { if (a.flag) actions[a.flag] = a; });
    return { events: list(s.events), results: list(s.results), anki: list(s.anki), actions: actions };
  }

  function pctOf(r) { return r.max ? r.score / r.max : null; }
  function prepCount(ev) { return [0, 1, 2, 3].filter(function (i) { return ev.prep && ev.prep['p' + i]; }).length; }
  function isAssess(ev) { return ev.graded || ev.kind === 'test' || ev.kind === 'partial'; }
  function upcoming(V, T, k, pred) {
    return V.events.filter(function (e) { return (!k || e.subject === k) && pred(e) && e.date >= T; })
      .sort(function (a, b) { return a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''); })[0];
  }

  /* ── the rules ── the same ten the page states under "The rules". */
  function flags(s, now) {
    var V = view(s), T = today(now), F = [];
    var graded = V.results.filter(function (r) { return r.kind !== 'practice'; })
      .sort(function (a, b) { return a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || ''); });

    graded.forEach(function (r) {   // R1
      var p = pctOf(r);
      if (p != null && p < 0.7 && diff(T, r.date) <= 21)
        F.push({ id: 'low:' + r.id, lvl: 'change', subj: r.subject, rule: 'R1', date: r.date,
          title: KIND[r.kind] + ' ' + r.score + '/' + r.max + ' (' + Math.round(p * 100) + '%)' + (r.title ? ' · ' + r.title : ''),
          todo: 'Under 70%. Make an error card for every miss and name the cause before the next class.' +
                ((r.causes && r.causes.length) ? '' : ' No cause tagged yet: add one in the results table.') });
    });
    SK.forEach(function (k) {       // R2
      var rs = graded.filter(function (r) { return r.subject === k; }).slice(-2);
      if (rs.length === 2 && rs.every(function (r) { return pctOf(r) < 0.8; }))
        F.push({ id: 'trend:' + k + ':' + rs[1].id, lvl: 'change', subj: k, rule: 'R2', date: rs[1].date,
          title: 'Two results in a row under 80% (' + rs.map(function (r) { return Math.round(pctOf(r) * 100) + '%'; }).join(', ') + ')',
          todo: 'The current method isn’t working for this subject. Change one thing before the next test and note what you changed here.' });
    });
    var last5 = V.results.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 5), cc = {};
    last5.forEach(function (r) { (r.causes || []).forEach(function (c) { (cc[c] = cc[c] || []).push(r); }); });
    Object.keys(cc).forEach(function (c) {   // R3
      var rs = cc[c];
      if (rs.length >= 2 && CAUSES[c])
        F.push({ id: 'cause:' + c + ':' + rs[0].id, lvl: 'change', subj: 'all', rule: 'R3', date: rs[0].date,
          title: '“' + CAUSES[c][0] + '” in ' + rs.length + ' of your last ' + last5.length + ' results', todo: CAUSES[c][1] });
    });
    last5.forEach(function (r) {
      if ((r.causes || []).indexOf('wrong') >= 0 && !(cc.wrong && cc.wrong.length >= 2))
        F.push({ id: 'wrong:' + r.id, lvl: 'warn', subj: r.subject, rule: 'R3', date: r.date,
          title: 'Studied the wrong material', todo: CAUSES.wrong[1] });
    });
    V.results.forEach(function (r) {   // R4
      var p = pctOf(r), d = diff(T, r.date);
      if (!r.errorCards && (r.misses || (p != null && p < 1)) && d >= 2 && d <= 30)
        F.push({ id: 'err:' + r.id, lvl: 'warn', subj: r.subject, rule: 'R4', date: r.date,
          title: 'Error cards not made for ' + KIND[r.kind].toLowerCase() + ' of ' + short(r.date),
          todo: 'Card every miss, then tick Error cards in the results table.' });
    });
    V.events.forEach(function (ev) {   // R5, R6, R11
      var d = diff(ev.date, T);
      /* A group session is not a class: no class prep, no cards-after. The one
         thing it owes is the lead's prompt card, due the evening before. */
      if (isSession(ev)) {
        if (ev.lead && d >= 0 && d <= 1 && !(ev.prep && ev.prep.p0))
          F.push({ id: 'card:' + ev.id, lvl: 'warn', subj: ev.subject, rule: 'R11', date: ev.date,
            title: 'Prompt card and key for ' + (d === 0 ? 'today\u2019s' : 'tomorrow\u2019s') + ' ' + SUBJ[ev.subject].name.toLowerCase() + ' session',
            todo: 'Three prompts by the mix rule (core, apply, detail) plus free recall; run the four checks; write the 4\u20138 point key with pages.' });
        return;
      }
      if (d >= 0 && d <= 2 && prepCount(ev) < 2)
        F.push({ id: 'prep:' + ev.id, lvl: 'warn', subj: ev.subject, rule: 'R5', date: ev.date, assess: isAssess(ev),
          title: ev.title + ': ' + prepCount(ev) + ' of 4 prep items',
          todo: d === 0 ? 'Today. Do the blank page or the questions in the gaps before class.'
                        : 'In ' + d + ' day' + (d > 1 ? 's' : '') + '. Read and card it now.' });
      if ((ev.kind === 'lab' || ev.kind === 'seminar') && d <= -1 && d >= -7 && !(ev.prep && ev.prep.after))
        F.push({ id: 'after:' + ev.id, lvl: d <= -2 ? 'change' : 'warn', subj: ev.subject, rule: 'R6', date: ev.date,
          title: 'No cards after ' + ev.title, todo: 'Make the cards for what was taught, then tick Cards made in Last 7 days.' });
    });
    SK.forEach(function (k) {   // R7
      var miss = V.events.filter(function (e) { var d = diff(T, e.date); return !isSession(e) && e.subject === k && d >= 1 && d <= 14 && prepCount(e) < 2; })
        .sort(function (a, b) { return b.date.localeCompare(a.date); });
      if (miss.length >= 2)
        F.push({ id: 'missed:' + k + ':' + miss[0].id, lvl: 'change', subj: k, rule: 'R7', date: miss[0].date,
          title: miss.length + ' classes in two weeks without real prep',
          todo: 'Give this subject a fixed slot in the week before its class, or cut new cards elsewhere.' });
    });
    var weeks = V.anki.slice().sort(function (a, b) { return a.week.localeCompare(b.week); });
    SK.forEach(function (k) {   // R8
      var ws = weeks.filter(function (x) { return x[k] && x[k].recall != null; }).slice(-2);
      if (ws.length === 2 && ws.every(function (x) { return x[k].recall < 80; }))
        F.push({ id: 'recall:' + k + ':' + ws[1].week, lvl: 'change', subj: k, rule: 'R8', date: ws[1].week,
          title: 'Recall under 80% two weeks running (' + ws.map(function (x) { return x[k].recall + '%'; }).join(', ') + ')',
          todo: 'Nothing new goes live until it’s read and blank-paged. Split long answers.' });
      else if (ws.length && ws[ws.length - 1][k].recall < 80)
        F.push({ id: 'recallw:' + k + ':' + ws[ws.length - 1].week, lvl: 'warn', subj: k, rule: 'R8', date: ws[ws.length - 1].week,
          title: 'Recall ' + ws[ws.length - 1][k].recall + '% last logged week',
          todo: 'Read before new cards go live. Two weeks under 80% trips the full rule.' });
    });
    var lw = weeks[weeks.length - 1];   // R9
    if (lw) {
      var tot = SK.reduce(function (n, k) { return n + ((lw[k] && lw[k].min) || 0); }, 0);
      if (tot > 150) {
        var far = SK.map(function (k) { return { k: k, n: upcoming(V, T, k, isAssess) }; })
          .sort(function (a, b) { return (b.n ? diff(b.n.date, T) : 999) - (a.n ? diff(a.n.date, T) : 999); })[0];
        F.push({ id: 'load:' + lw.week, lvl: 'change', subj: 'all', rule: 'R9', date: lw.week,
          title: 'Anki ' + tot + ' real min/day in the week of ' + short(lw.week),
          todo: 'Cut new cards in ' + SUBJ[far.k].name + ', whose next test is furthest away.' });
      }
    }
    var prevW = monday(addDays(T, -7));   // R10
    if ((parse(T).getDay() + 6) % 7 >= 1 && !V.anki.some(function (a) { return a.week === prevW; }))
      F.push({ id: 'export:' + prevW, lvl: 'warn', subj: 'all', rule: 'R10', date: prevW,
        title: 'No Anki numbers for the week of ' + short(prevW),
        todo: 'Press Sync from Anki on the Mac, or type the numbers in the Anki week tab.' });

    var ord = { change: 0, warn: 1 };
    return F.sort(function (a, b) { return ord[a.lvl] - ord[b.lvl] || b.date.localeCompare(a.date); });
  }

  function open(s, now) {
    var A = view(s).actions;
    return flags(s, now).filter(function (f) { return !A[f.id]; });
  }

  /* The front door's share of the rules: at most three, and only the ones
     that change what you do next. R4, R6, R7, R9 and R10 are bookkeeping
     about cards and exports — true, and on Study Control, but a front page
     that repeats them every morning is a page you stop opening. R5 counts
     here only for a GRADED class: being under-prepped for a seminar is not
     a heads-up, being under-prepped for Friday's test is. */
  var FRONT = { R1: 1, R2: 1, R3: 1, R5: 1, R8: 1, R11: 1 };
  function headsUp(s, now, max) {
    return open(s, now).filter(function (f) {
      return FRONT[f.rule] && (f.rule !== 'R5' || f.assess);
    }).slice(0, max || 3);
  }

  /* Marking a flag handled, the same record the page's Handled button writes. */
  function handle(s, flagId, note, now) {
    s = shape(s);
    s.actions[encodeURIComponent(flagId).replace(/%/g, '~')] = { flag: flagId, note: note || '', date: today(now) };
    return write(s, now);
  }

  /* The Anki week, filed from the Mac. anki_sync.py sends this week and last
     per subject (see study_weeks() there); this writes them as Anki-week
     rows. Newer wins, so a stale reading arriving late through Firestore
     cannot undo a fresher one opened from the button. Values the sync does
     not carry (it leaves new-waiting blank for a past week) keep whatever
     was there. */
  function ingestWeeks(weeks, at, now) {
    if (!weeks || typeof weeks !== 'object') return [];
    var s = read(), done = [], t = at ? Date.parse(at) : NaN;
    Object.keys(weeks).forEach(function (wk) {
      var v = weeks[wk];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(wk) || !v || !v.subjects) return;
      var id = 'w' + wk, doc = Object.assign({}, s.anki[id] || {}, { week: wk });
      if (doc.syncedAt && !isNaN(t) && Date.parse(doc.syncedAt) >= t) return;
      Object.keys(v.subjects).forEach(function (k) {
        if (!SUBJ[k]) return;
        var o = Object.assign({}, doc[k] || {}), x = v.subjects[k] || {};
        ['min', 'recall', 'newc', 'backlog'].forEach(function (f) { if (x[f] != null) o[f] = x[f]; });
        doc[k] = o;
      });
      doc.note = 'Synced from Anki ' + short(today(isNaN(t) ? now : t)) + ' \u00b7 ' +
                 (v.days || 7) + ' of 7 days \u00b7 real time rebuilt';
      doc.syncedAt = at || null;
      s.anki[id] = doc;
      done.push(wk);
    });
    if (done.length) write(s, now);
    return done;
  }

  function nextGraded(s, now) {
    var T = today(now), ev = upcoming(view(s), T, null, isAssess);
    return ev ? Object.assign({ days: diff(ev.date, T), subjectName: SUBJ[ev.subject] ? SUBJ[ev.subject].name : ev.subject }, ev) : null;
  }

  /* The last day this store was told anything, never after today. A result
     counts on the day it was LOGGED (createdAt), not the day it was sat —
     typing in last Friday's quiz tonight is tonight being reported. Returns
     null when it has never been written, which is silence and not day zero. */
  function lastTold(s, now) {
    s = s || (has() ? read() : null);
    if (!s) return null;
    s = shape(s);
    var T = today(now), days = Object.keys(s.told);
    Object.keys(s.results).forEach(function (id) {
      var c = s.results[id] && s.results[id].createdAt;
      if (c) { try { days.push(today(Date.parse(c))); } catch (e) {} }
    });
    days = days.filter(function (k) { return /^\d{4}-\d\d-\d\d$/.test(k) && k <= T; }).sort();
    return days.length ? days[days.length - 1] : null;
  }

  /* What the Standing shows. Null until the page has been used on this
     device, so a hub that never opened Study Control is not handed the
     seed's flags as if they were its own. */
  function summary(now) {
    if (!has()) return null;
    var s = read(), o = open(s, now);
    return {
      change: o.filter(function (f) { return f.lvl === 'change'; }).length,
      warn: o.filter(function (f) { return f.lvl === 'warn'; }).length,
      top: o[0] || null,
      next: nextGraded(s, now),
      lastTold: lastTold(s, now)
    };
  }

  w.StudyControl = {
    KEY: KEY, LEGACY: LEGACY, SUBJ: SUBJ, SK: SK, CAUSES: CAUSES, KIND: KIND, SEED: SEED,
    read: read, write: write, has: has, adopt: adopt, view: view,
    flags: flags, open: open, headsUp: headsUp, handle: handle, ensureGroup: ensureGroup, prepFor: prepFor, isSession: isSession, GROUP: GROUP, ingestWeeks: ingestWeeks, nextGraded: nextGraded, lastTold: lastTold, summary: summary,
    today: today, iso: iso, parse: parse, addDays: addDays, diff: diff, monday: monday, short: short,
    pctOf: pctOf, prepCount: prepCount, isAssess: isAssess
  };
})(typeof window !== 'undefined' ? window : this);
