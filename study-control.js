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
    embryology: { name: 'Embryology', c: '--emb', prep: ['Read BWAB chapter', 'Embryo cards', 'Timeline from memory', 'Practice questions'] },
    /* Step 1 is a subject for the calendar and the Anki row, not one of the
       four: it has no results, no subject card, and is the first thing cut
       when a week overloads (protocol A1). So it is not in SK. */
    step:       { name: 'Step 1',     c: '--accent', prep: ['Numbers ready (blocks, % correct, AnKing streak)', 'Two starred misses ready'] }
  };
  var SK = ['anatomy', 'histology', 'physiology', 'embryology'];

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
    if (isSession(ev) && ev.subject === 'step') return SUBJ.step.prep.slice();
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
             actions: d.actions || {}, told: d.told || {}, dismissed: d.dismissed || {},
             items: d.items || {}, floor: d.floor || {} };
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
      /* All Anki, AnKing included: the protocol's ceiling is 2½ h a day
         across every deck (A4), and AnKing is where the minutes grow. */
      var tot = SK.concat('step').reduce(function (n, k) { return n + ((lw[k] && lw[k].min) || 0); }, 0);
      if (tot > 150) {
        var far = SK.map(function (k) { return { k: k, n: upcoming(V, T, k, isAssess) }; })
          .sort(function (a, b) { return (b.n ? diff(b.n.date, T) : 999) - (a.n ? diff(a.n.date, T) : 999); })[0];
        F.push({ id: 'load:' + lw.week, lvl: 'change', subj: 'all', rule: 'R9', date: lw.week,
          title: 'Anki ' + tot + ' real min/day in the week of ' + short(lw.week),
          todo: 'Cut new cards in ' + SUBJ[far.k].name + ', whose next test is furthest away.' });
      }
    }
    protocolFlags(s, V, T, weeks).forEach(function (f) { F.push(f); });
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
  var FRONT = { R1: 1, R2: 1, R3: 1, R5: 1, R8: 1, R11: 1, R13: 1, R14: 1 };
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
        /* min is a per-day average; total and logged are the week's minutes,
           real and by Anki's own clock, so the row can be checked against
           Anki instead of read as a weekly total it is not. */
        ['min', 'recall', 'newc', 'newMax', 'backlog', 'total', 'logged'].forEach(function (f) { if (x[f] != null) o[f] = x[f]; });
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

  /* ── the protocol ────────────────────────────────────────────────────────
     Year 2 Study Protocol v1.1, 18 October 2026. Its own first principle
     after equal priority is "execution over design: no new trackers, pages
     or decks" (A1.7), so it lives here, in the one tracker it names, and
     on the two pages that already read this file — not on a page of its own.

     What is STORED is only what the document states: the week at a glance,
     the stacked weeks, the phases, the open items and their dates. What is
     shown on a given day is derived from those and from the store: which
     row is today's, whether this is a countdown week, which practice sets
     the Sunday re-test hour is owed. A countdown typed in as "T−14 starts
     26 October" would stay true when a partial moved; one computed from the
     partial's date cannot.

     Ticks go in the store under `floor` (day → row → 1) and `items`
     (open item → day done), so they sync and back up with the rest, and a
     tick is a day reported, which is what drift must see. */
  var DOW_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var QBANK_FROM = '2026-11-02';   // UWorld and the build-week blocks start (C2, C4)
  var EVERY_DAY = 'Reviews in every deck before any new card · Anki done by 22:00, 2½ h at most · anatomy new ≤ 100 · AnKing new 15–20';
  /* The week at a glance, one row per subject per weekday; the subject in
     `must` is the day's bold cell. Step rows carry a second text for once
     the Qbank blocks start. */
  var WEEK = {
    1: { label: 'histology', fixed: 'Histology lab + quiz · dissection 16:00', must: 'histology', rows: {
      anatomy: 'Prime reviews · learn this week’s lab cards (theory slice)',
      physiology: 'Costanzo map (30–45 min) · Friday’s set pages, part 1',
      histology: 'Lab + quiz. Within 24 h: miss cards, recall page, one disease card per structure · log the score',
      embryology: 'Read the seminar chapter · draw the timeline',
      step: 'AnKing reviews · first half of the week’s FA pages' } },
    2: { label: 'embryology prep', fixed: '', must: 'embryology', rows: {
      anatomy: 'Prime reviews · lab cards slice',
      physiology: 'Set pages, part 2 (finish the reading)',
      histology: 'Confirm next lab’s topic with the group',
      embryology: 'AI set (20 questions) · miss cards',
      step: ['AnKing', 'AnKing · block 1 (filtered to the course system) + review'] } },
    3: { label: 'embryology', fixed: 'Embryology seminar 13:00', must: 'embryology', rows: {
      anatomy: 'Prime reviews · last lab cards learned, all live before Thursday',
      physiology: 'AI set 1, cold (20 questions) · card every miss and guess',
      embryology: 'Seminar. Malformation cards · recall page, the timeline from memory',
      step: 'AnKing · second half of the FA pages' } },
    4: { label: 'anatomy', fixed: 'Anatomy lab', must: 'anatomy', rows: {
      anatomy: 'Lab. Within 24 h: every dissection miss carded · clinical correlation cards',
      physiology: 'AI set 2 on set 1’s weak spots · re-read the missed sections',
      histology: 'Read Wheater for the next lab: every image, every caption',
      step: ['AnKing', 'AnKing · block 2 + review'] } },
    5: { label: 'physiology', fixed: 'Physiology test 12:45', must: 'physiology', rows: {
      anatomy: 'Prime reviews',
      physiology: 'Test. Recall page the same day · log the score',
      histology: 'Read Junqueira for the next lab',
      step: 'AnKing reviews only: no pages, no blocks' } },
    6: { label: 'build day', fixed: 'Step group session, 75 min', must: 'anatomy', rows: {
      anatomy: 'Build next Thursday’s lab: authored Entity+ / Relation+ cards · reviews',
      physiology: 'Depth add-on: a whole chapter or a scheduled gap chapter (1–2 h)',
      histology: 'Draw each tissue from memory · SecondLook images for the lab',
      embryology: 'Read the next chapter (light)',
      step: 'Session, two starred misses ready · AnKing' } },
    0: { label: 'review day', fixed: 'Sunday review, 30 min, before 21:00', must: 'retest', rows: {
      anatomy: 'Prime reviews · learn the lab cards slice',
      retest: 'Re-test hour: the sets from 1 week and 1 month ago, cold, scores logged',
      histology: 'Histology AI set for Monday’s lab + miss cards',
      step: 'AnKing · error log: 5 misses, 1 starred' } }
  };
  var SUNDAY = [
    ['anki', 'Anki export: the week’s row (minutes, recall, new cards per deck)'],
    ['retest', 'Re-test hour done, scores logged'],
    ['hours', 'Hours per subject against the plan. More than 2 h behind gets the time back next week, taken from Step first'],
    ['ahead', 'Next 21 days: every graded event, all four subjects'],
    ['numbers', 'Step numbers posted to the group sheet by 21:00'],
    ['change', 'At most one change to the method, written down with its reason']
  ];
  var BAD_DAY = [
    ['reviews', 'All due reviews: anatomy and the miss decks'],
    ['ten', '10 questions in {next}'],
    ['anking', 'AnKing, 30 minutes at most'],
    ['sleep', 'Sleep 7 hours; lights out by midnight before a morning class']
  ];
  /* Stacked weeks (A3): several subjects graded in one week, each planned
     three weeks out. A partial added later that falls outside all of these
     gets a countdown of its own (see countdowns()). */
  var STACKED = [
    { id: 'nov',  from: '2026-11-09', to: '2026-11-13', label: 'The Module A week (9–13 Nov)', scope: 'anatomy Module A, histology lab, physiology test' },
    { id: 'dec',  from: '2026-12-14', to: '2026-12-18', label: 'The Module B week (14–18 Dec)', scope: 'histology slide partial, anatomy Module B, physiology' },
    { id: 'jan',  from: '2027-01-11', to: '2027-01-15', label: 'The Modules C and D week (11–15 Jan)', scope: 'anatomy Modules C and D, physiology ECG' },
    { id: 'lateJan', from: '2027-01-25', to: '2027-01-29', label: 'The last winter tests (late Jan)', scope: 'the last winter tests; dates to confirm' },
    { id: 'session', from: '2027-02-04', to: '2027-02-10', label: 'The winter session (4–10 Feb)', scope: 'the exam session' }
  ];
  var STAGES = [
    { id: 't21', lo: 15, hi: 21, name: 'T−21', todo: 'List every graded event in the week, all four subjects, with its scope. Count the reading left per subject. Step weeks in the window go to Floor.' },
    { id: 't14', lo: 8, hi: 14, name: 'T−14', todo: 'Boost begins for each subject with a partial in the week. Pull the reading forward so it ends by T−7. Weekly tests elsewhere keep their cycle.' },
    { id: 't7', lo: 1, hi: 7, name: 'T−7', todo: 'No first reading anywhere. Mocks: anatomy pins + theory mock, histology 20-slide mocks, physiology and embryology cumulative AI sets. Mock misses carded the same day.' },
    { id: 'week', name: 'Week of', todo: 'Only the next test’s subject the evening before; reviews continue for all; Step at Floor (AnKing + 10 questions).' },
    { id: 'after', name: 'After', todo: 'Within 48 h: results logged, recall pages, error cards. One lighter day before the next cycle.' }
  ];
  /* Step 1 phases (C3) and the Floor for the period (C4, C8). */
  var PHASES = [
    { n: '0', from: '2026-10-17', to: '2026-11-15', name: 'Foundations', floor: 'AnKing daily + the week’s FA pages' },
    { n: '1', from: '2026-11-16', to: '2027-02-21', name: 'Neuro, blood and immune, cardio', floor: 'AnKing + 2 blocks' },
    { n: '2', from: '2027-02-22', to: '2027-06-20', name: 'Renal, GI, respiratory, endocrine, reproduction', floor: 'AnKing + 2 blocks' },
    { n: '—', from: '2027-06-21', to: '2027-07-11', name: 'Year-2 finals', floor: 'Floor only' },
    { n: '3', from: '2027-07-12', to: '2027-09-26', name: 'Summer bridge', floor: 'AnKing 5 days + 2 blocks' },
    { n: '4', from: '2027-09-27', to: '2028-05-28', name: 'Year 3, every system', floor: 'AnKing + 3 blocks' },
    { n: '5–6', from: '2028-05-29', to: '2028-07-30', name: 'Integration and dedicated', floor: 'AnKing + 1 block a day' }
  ];
  /* D3, the open items, kept as the document words them. The two with no
     date stay undated rather than being given one it never set. */
  var OPEN = [
    { id: 'd3-w3', by: '2026-10-18', label: 'Confirm W3 (19 Oct) is muscle; Junqueira and Wheater page counts' },
    { id: 'd3-order', by: '2026-10-24', label: 'Physiology Nov–Dec test order and partials (physiology lead); histology lab dates after W3; embryology test dates' },
    { id: 'd3-level', by: '2026-10-24', label: 'Phase 0 Step level, Floor or Target, agreed at the Saturday session' },
    { id: 'd3-hours', by: '2026-10-25', label: 'Weekly hours available after classes and tutoring' },
    { id: 'd3-amboss', by: '2026-11-01', label: 'Saturday session time fixed; AMBOSS group quote (Keeper)' },
    { id: 'd3-deans', by: '2026-11-30', label: 'Dean’s Office (nbme@umlub.edu.pl): 2028 CBSE dates, sponsorship, summer practices abroad' },
    { id: 'd3-latest', by: '2026-12-18', label: 'Latest Step 1 pass date accepted for Sep 2028 US rotations' },
    { id: 'd3-spring', by: '2027-02-22', label: 'Spring anatomy order; Biochem I/II syllabus order' },
    { id: 'd3-syllabi', by: null, label: 'Export the four CEM syllabi (physiology and histology, Polish and English) and the Polish zagadnienia list' },
    { id: 'd3-cyto', by: null, label: 'Whether cytophysiology is taught and examined (what W1 covered)' }
  ];
  var MILESTONES = [
    { id: 'ms-qbank', date: QBANK_FROM, label: 'UWorld starts: two blocks a week from now (Floor)' },
    { id: 'ms-p1', date: '2026-11-16', label: 'Step Phase 1 begins: neuro with Labs 6–10' },
    { id: 'ms-teach', date: '2027-02-03', label: 'Winter teaching ends' },
    { id: 'ms-session', date: '2027-02-04', label: 'Winter session, 4–10 Feb' },
    { id: 'ms-retakes', date: '2027-02-11', label: 'Retakes, 11–17 Feb' },
    { id: 'ms-brs', date: '2027-06-14', label: 'BRS Physiology comprehensive, cold (week of)' },
    { id: 'ms-finals', date: '2027-06-21', label: 'Year-2 finals begin (to 11 Jul)' },
    { id: 'ms-nbme1', date: '2027-10-02', label: 'NBME 1, cold baseline' },
    { id: 'ms-nbme2', date: '2028-02-19', label: 'NBME 2' },
    { id: 'ms-nbme3', date: '2028-04-08', label: 'NBME 3' },
    { id: 'ms-cbsereg', date: '2028-04-10', label: 'Register for the UMLub CBSE (about this date)' },
    { id: 'ms-nbme4', date: '2028-05-13', label: 'NBME 4' },
    { id: 'ms-cbse', date: '2028-05-26', label: 'UMLub NBME CBSE, 67% needed (about this date)' },
    { id: 'ms-resched', date: '2028-06-11', label: 'Last fee-free Step 1 reschedule' },
    { id: 'ms-step1', date: '2028-07-27', label: 'USMLE Step 1' }
  ];
  /* Calendar entries the protocol adds to the term (A3, C7). Written once
     each, like the study group's, so each can be edited or deleted. */
  var STEP_GROUP = { from: '2026-10-24', to: '2027-06-19', time: '' };
  var ANATOMY_SEMINARS = ['2026-11-17', '2026-11-24', '2026-12-01', '2026-12-08'];

  function phaseOf(T) {
    var p = PHASES.filter(function (x) { return T >= x.from && T <= x.to; })[0] || null;
    if (!p) return null;
    p = Object.assign({}, p);
    if (p.n === '0' && T < QBANK_FROM) p.floor = PHASES[0].floor;
    else if (p.n === '0') p.floor = 'AnKing + the week’s FA pages + 2 blocks';
    return p;
  }

  /* Every countdown target: the stacked weeks, plus any partial in the store
     that none of them covers, so a TBC partial typed in later gets its own. */
  function countdowns(s) {
    var out = STACKED.map(function (x) { return Object.assign({}, x); });
    view(s).events.filter(function (e) { return e.kind === 'partial'; }).forEach(function (e) {
      if (out.some(function (x) { return e.date >= x.from && e.date <= x.to; })) return;
      out.push({ id: 'ev-' + e.id, from: e.date, to: e.date, label: (SUBJ[e.subject] ? SUBJ[e.subject].name + ' ' : '') + e.title + ' (' + short(e.date) + ')', scope: e.title });
    });
    return out.sort(function (a, b) { return a.from.localeCompare(b.from); })
      .map(function (x) { x.starts = addDays(x.from, -21); return x; });
  }
  function stageOf(x, T) {
    var d = diff(x.from, T);
    if (T >= x.from && T <= x.to) return STAGES[3];
    if (T > x.to) return diff(T, x.to) <= 2 ? STAGES[4] : null;
    return STAGES.filter(function (g) { return g.lo != null && d >= g.lo && d <= g.hi; })[0] || null;
  }
  function countdown(s, now) {
    var T = today(now);
    return countdowns(s).map(function (x) {
      var g = stageOf(x, T);
      return g ? Object.assign({}, x, { stage: g.id, stageName: g.name, todo: g.todo, days: diff(x.from, T) }) : null;
    }).filter(Boolean);
  }

  /* Practice sets owed to the Sunday re-test hour: the ones sat about a week
     and about a month ago (B5). Derived from the results, so a set logged
     as practice is asked for again without anything else being written. */
  function retestDue(s, now) {
    var T = today(now);
    return view(s).results.filter(function (r) {
      if (r.kind !== 'practice') return false;
      var d = diff(T, r.date);
      return (d >= 6 && d <= 8) || (d >= 27 && d <= 34);
    }).sort(function (a, b) { return a.date.localeCompare(b.date); });
  }

  /* A week runs on the countdown when a partial in any subject falls in it,
     or a stacked week is a week or less away: Step drops to Floor (C8). */
  function floorWeek(s, T) {
    var mon = monday(T), sun = addDays(mon, 6);
    if (view(s).events.some(function (e) { return e.kind === 'partial' && e.date >= mon && e.date <= sun; })) return true;
    return countdown(s, parse(T).getTime() + 12 * 36e5).some(function (c) { return c.stage === 't7' || c.stage === 'week'; });
  }

  /* Today's page of the protocol: the fixed event, one row per subject, the
     Sunday review on a Sunday, the countdown when one is running, and the
     Step phase. On a bad day the rows are replaced by the minimum viable
     day (A4) — which keeps the chain; it is not a plan. */
  function dayPlan(s, now) {
    s = shape(s);
    var T = today(now), dow = parse(T).getDay(), W = WEEK[dow], ticks = s.floor[T] || {};
    var bad = !!ticks.bad, qb = T >= QBANK_FROM, fw = floorWeek(s, T), ph = phaseOf(T);
    var fixed = W.fixed;
    if (dow === 6 && parse(T).getDate() <= 7) fixed = 'Step Saturday, 2.5 h: four timed mixed blocks, top-miss review, retro';
    var rows;
    if (bad) {
      var ng = nextGraded(s, now);
      rows = BAD_DAY.map(function (b) {
        return { id: 'bad-' + b[0], subj: 'all', text: b[1].replace('{next}', ng ? ng.subjectName.toLowerCase() + ', graded ' + (ng.days === 0 ? 'today' : ng.days === 1 ? 'tomorrow' : 'in ' + ng.days + ' days') : 'the subject graded next'), must: true };
      });
    } else {
      rows = [{ id: 'daily', subj: 'all', text: EVERY_DAY, must: false }];
      Object.keys(W.rows).forEach(function (k) {
        var t = W.rows[k];
        if (Array.isArray(t)) t = qb ? t[1] : t[0];
        if (k === 'step' && fw) t = 'Step at Floor this week: AnKing + 10 questions';
        if (k === 'retest') {
          var due = retestDue(s, now);
          t += due.length ? ': ' + due.map(function (r) { return SUBJ[r.subject].name + (r.title ? ' ' + r.title : '') + ' (' + short(r.date) + ')'; }).join(', ')
                          : '. No practice set was logged a week or a month ago, so there is nothing to re-take yet.';
        }
        rows.push({ id: k, subj: k === 'retest' ? 'all' : k, text: t, must: W.must === k });
      });
    }
    rows.forEach(function (r) { r.name = SUBJ[r.subj] ? SUBJ[r.subj].name : (r.id === 'daily' ? 'every day' : r.id === 'retest' ? 're-test' : 'minimum'); r.done = !!ticks[r.id]; });
    return {
      date: T, dow: dow, day: DOW_NAME[dow], label: W.label, fixed: fixed, bad: bad, rows: rows,
      sunday: dow === 0 && !bad ? SUNDAY.map(function (x) { return { id: 'sun-' + x[0], text: x[1], done: !!ticks['sun-' + x[0]] }; }) : null,
      countdown: countdown(s, now), floorWeek: fw, phase: ph
    };
  }
  function tickFloor(id, on, now) {
    var s = read(), T = today(now);
    s.floor[T] = Object.assign({}, s.floor[T] || {});
    if (on) s.floor[T][id] = 1; else delete s.floor[T][id];
    return write(s, now);
  }
  function badDay(on, now) { return tickFloor('bad', on, now); }

  /* The open items and the Step dates, in the shape PlanV2.dated() returns,
     so the Almanac's dates list asks both owners and sorts one list. */
  function openItems(s) {
    s = shape(s);
    return OPEN.map(function (o) { return { id: o.id, by: o.by, label: o.label, done: s.items[o.id] || null }; });
  }
  function dated(s, on) {
    s = shape(s);
    var T = on || today(), out = [];
    OPEN.forEach(function (o) {
      if (!o.by || s.items[o.id]) return;
      out.push({ id: o.id, kind: 'open', date: o.by, label: o.label, href: 'Study Control.html#protocol', late: o.by < T });
    });
    MILESTONES.forEach(function (m) {
      if (m.date < T) return;
      out.push({ id: m.id, kind: 'milestone', date: m.date, label: m.label, href: 'Study Control.html#protocol', late: false });
    });
    return out.sort(function (a, b) { return a.date.localeCompare(b.date); });
  }
  /* A class moved from outside this page: the add-on, through
     anki-bridge.js, when a date was changed in Anki. The same record the
     page's Edit writes, so nothing downstream can tell the difference. */
  function moveEvent(id, date, now) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false;
    var s = read();
    if (!s.events[id] || s.events[id].date === date) return false;
    s.events[id] = Object.assign({}, s.events[id], { date: date });
    return write(s, now);
  }

  function setItem(id, on, now) {
    var s = read();
    if (on) s.items[id] = today(now); else delete s.items[id];
    return write(s, now);
  }

  /* Writes the protocol's calendar entries once each: the Saturday Step
     group session (the first Saturday of a month is the 2.5-hour Step
     Saturday) and the anatomy seminars from 17 November. Same rules as
     ensureGroup(): never over an existing or deleted one, no `told` stamp. */
  function ensureProtocol() {
    var L = ls(); if (!L || !has()) return 0;
    var s = read(), added = 0;
    function put(id, ev) { if (s.events[id] || s.dismissed[id]) return; s.events[id] = ev; added++; }
    for (var d = STEP_GROUP.from; d <= STEP_GROUP.to; d = addDays(d, 7)) {
      var big = parse(d).getDate() <= 7;
      put('step-' + d, { date: d, time: STEP_GROUP.time, subject: 'step', kind: 'session', graded: false, prep: {},
        title: big ? 'Step Saturday (2.5 h)' : 'Step group session (75 min)',
        note: big ? 'Four timed mixed blocks on the last four weeks’ systems, top-miss review, 15-minute retro.'
                  : 'Numbers, hard misses (two starred each), pass and defend, next week, fix list. Time to fix: proposal 10:00.' });
    }
    ANATOMY_SEMINARS.forEach(function (d, i) {
      put('ana-sem' + (7 + i), { date: d, time: '', subject: 'anatomy', kind: 'seminar', graded: false, prep: {},
        title: 'Seminar ' + (7 + i), note: 'From the protocol’s calendar (A3). Add the topic.' });
    });
    if (added) { try { L.setItem(KEY, JSON.stringify(s)); } catch (e) { return 0; } }
    return added;
  }

  /* R12–R14, the protocol's rules that the original ten did not have.
       R12  a countdown stage is running (A5)
       R13  a practice set under 80% (B5 thresholds); two in a row under 70%
            in one subject is a method review
       R14  the new-card caps: anatomy over 100 new on any day, AnKing over
            60 minutes a day for the week (A4, C6) */
  function protocolFlags(s, V, T, weeks) {
    var F = [];
    countdown(s, parse(T).getTime() + 12 * 36e5).forEach(function (c) {
      F.push({ id: 'count:' + c.id + ':' + c.stage, lvl: 'warn', subj: 'all', rule: 'R12', date: c.from,
        title: c.label + ': ' + c.stageName + (c.days > 0 ? ' (' + c.days + ' days out)' : ''), todo: c.todo });
    });
    var prac = V.results.filter(function (r) { return r.kind === 'practice' && r.max; })
      .sort(function (a, b) { return a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || ''); });
    prac.forEach(function (r) {
      var p = pctOf(r), d = diff(T, r.date);
      if (d < 0 || d > 7 || p >= 0.8) return;
      F.push({ id: 'set:' + r.id, lvl: p < 0.7 ? 'change' : 'warn', subj: r.subject, rule: 'R13', date: r.date,
        title: 'Practice set ' + r.score + '/' + r.max + ' (' + Math.round(p * 100) + '%)' + (r.title ? ' · ' + r.title : ''),
        todo: p < 0.7 ? 'Under 70%: re-read the section, then a fresh set before the test.'
                      : '70–79%: set 2 from the misses, and re-read the missed sections.' });
    });
    SK.forEach(function (k) {
      var two = prac.filter(function (r) { return r.subject === k; }).slice(-2);
      if (two.length === 2 && two.every(function (r) { return pctOf(r) < 0.7; }) && diff(T, two[1].date) <= 14)
        F.push({ id: 'settrend:' + k + ':' + two[1].id, lvl: 'change', subj: k, rule: 'R13', date: two[1].date,
          title: 'Two practice topics in a row under 70%', todo: 'Method review at the Sunday review: one written change, with its reason.' });
    });
    var lw = weeks[weeks.length - 1];
    if (lw && lw.anatomy && lw.anatomy.newMax > 100)
      F.push({ id: 'cap:anatomy:' + lw.week, lvl: 'change', subj: 'anatomy', rule: 'R14', date: lw.week,
        title: lw.anatomy.newMax + ' new anatomy cards on one day in the week of ' + short(lw.week),
        todo: 'The 100-a-day cap failed. Theory cards before images; images are the first thing dropped on a late night.' });
    if (lw && lw.step && lw.step.min > 60)
      F.push({ id: 'cap:step:' + lw.week, lvl: 'change', subj: 'step', rule: 'R14', date: lw.week,
        title: 'AnKing ' + lw.step.min + ' min a day in the week of ' + short(lw.week),
        todo: 'Over 60 minutes a day: cut AnKing new cards, never reviews.' });
    return F;
  }


  /* ── what the ticks add up to ──────────────────────────────────────────
     The ticks were kept by day from the first one, but nothing showed a past
     day: the Almanac shows today, so whether last Tuesday's floor was kept
     could not be seen anywhere. weekBack() reads them back; adherence() sets
     them beside the grades.

     Both are derived on each call from the stored ticks and results, never
     stored: a result corrected later, or a tick added late, moves its point. */
  var PROTOCOL_FROM = '2026-10-18';   // v1.1's date: no day before it had rows to tick
  function noonOf(d) { return parse(d).getTime() + 12 * 36e5; }
  /* A day's rows as they were offered: the add-on's tasks when it planned
     that day (anki-bridge.js — the Almanac ticked those, not the protocol
     rows), the protocol's otherwise. A bad day is this site's own and keeps
     the minimum. */
  function rowsOn(s, d) {
    var p = dayPlan(s, noonOf(d));
    if (p.bad) return p;
    var b = null;
    try { b = w.AnkiBridge && w.AnkiBridge.dayTasks ? w.AnkiBridge.dayTasks(d) : null; } catch (e) {}
    return b && b.length ? Object.assign({}, p, { rows: b, sunday: null, anki: true }) : p;
  }
  function weekBack(s, now, n) {
    s = shape(s);
    var T = today(now), out = [];
    for (var i = (n || 7) - 1; i >= 0; i--) {
      var d = addDays(T, -i), p = rowsOn(s, d), items = p.rows.concat(p.sunday || []);
      var must = p.rows.filter(function (r) { return r.must; });
      out.push({ date: d, day: p.day, today: d === T, before: d < PROTOCOL_FROM, bad: p.bad,
        total: items.length, done: items.filter(function (x) { return x.done; }).length,
        must: must.length ? must.every(function (r) { return r.done; }) : null });
    }
    return out;
  }

  /* For each result: how much of that subject's own protocol rows were
     ticked in the seven days before it (the result's day itself excluded —
     the test is not prep for itself). Only results whose whole week before
     falls inside the protocol are plotted; a week half before it would read
     as half-kept when it was simply not yet tracked. A bad day offers no
     subject rows, so it neither helps nor hurts.

     r is Pearson's, given only from five points up: with fewer, any line
     through them means nothing, and the page says so rather than drawing one. */
  function pearson(xs, ys) {
    var n = xs.length; if (n < 5) return null;
    var mx = xs.reduce(function (a, b) { return a + b; }, 0) / n, my = ys.reduce(function (a, b) { return a + b; }, 0) / n;
    var sxy = 0, sxx = 0, syy = 0;
    for (var i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); syy += (ys[i] - my) * (ys[i] - my); }
    return sxx && syy ? Math.round(100 * sxy / Math.sqrt(sxx * syy)) / 100 : null;
  }
  function adherence(s, now) {
    s = shape(s);
    var T = today(now), points = [], early = 0, plans = {};
    function plan(d) { return plans[d] || (plans[d] = rowsOn(s, d)); }
    view(s).results.forEach(function (r) {
      if (!r.max || SK.indexOf(r.subject) < 0 || r.date > T) return;
      if (addDays(r.date, -7) < PROTOCOL_FROM) { early++; return; }
      var off = 0, got = 0;
      for (var i = 1; i <= 7; i++) plan(addDays(r.date, -i)).rows.forEach(function (x) {
        if (x.subj === r.subject) { off++; if (x.done) got++; }
      });
      if (!off) return;
      points.push({ id: r.id, date: r.date, subject: r.subject, kind: r.kind, practice: r.kind === 'practice',
        title: r.title || '', score: pctOf(r), adh: got / off, got: got, off: off });
    });
    points.sort(function (a, b) { return a.date.localeCompare(b.date); });
    var by = {};
    SK.forEach(function (k) {
      var ps = points.filter(function (p) { return p.subject === k; });
      by[k] = { n: ps.length, r: pearson(ps.map(function (p) { return p.adh; }), ps.map(function (p) { return p.score; })) };
    });
    return { points: points, early: early, from: addDays(PROTOCOL_FROM, 7), n: points.length,
      r: pearson(points.map(function (p) { return p.adh; }), points.map(function (p) { return p.score; })), bySubject: by };
  }

  w.StudyControl = {
    KEY: KEY, LEGACY: LEGACY, SUBJ: SUBJ, SK: SK, CAUSES: CAUSES, KIND: KIND, SEED: SEED,
    read: read, write: write, has: has, adopt: adopt, view: view,
    flags: flags, open: open, headsUp: headsUp, handle: handle, ensureGroup: ensureGroup, prepFor: prepFor, isSession: isSession, GROUP: GROUP, ingestWeeks: ingestWeeks,
    dayPlan: dayPlan, tickFloor: tickFloor, badDay: badDay, countdown: countdown, countdowns: countdowns, retestDue: retestDue,
    phaseOf: phaseOf, weekBack: weekBack, rowsOn: rowsOn, moveEvent: moveEvent, adherence: adherence, PROTOCOL_FROM: PROTOCOL_FROM, openItems: openItems, dated: dated, setItem: setItem, ensureProtocol: ensureProtocol,
    PROTOCOL: { version: '1.1', of: '2026-10-18', WEEK: WEEK, SUNDAY: SUNDAY, STACKED: STACKED, PHASES: PHASES, OPEN: OPEN, MILESTONES: MILESTONES },
    nextGraded: nextGraded, lastTold: lastTold, summary: summary,
    today: today, iso: iso, parse: parse, addDays: addDays, diff: diff, monday: monday, short: short,
    pctOf: pctOf, prepCount: prepCount, isAssess: isAssess
  };
})(typeof window !== 'undefined' ? window : this);
