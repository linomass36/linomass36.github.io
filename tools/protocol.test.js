/* ─────────────────────────────────────────────────────────────
   protocol.test.js — the Year 2 Study Protocol, as the hub runs it.

   Run with `node tools/protocol.test.js` from the repo root. Also run by the
   deploy.

   WHAT THIS PINS. The protocol (v1.1, 18 October 2026) was a 17-page PDF.
   Its own rule A1.7 is "no new trackers, pages or decks", so it went into
   the one tracker it names — study-control.js — and onto the two pages
   that already read it. The ways that can go wrong are the house's usual
   ones: a countdown typed as a date that stops being true when a partial
   moves, a page computing its own version of the day, a re-test list that
   has to be kept by hand, and AnKing's minutes landing in course anatomy so
   each cap reads the other's cards. Each of those is checked below.

   Every date is SET, never read (CLAUDE.md).
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function hub(stores) {
  const store = Object.assign({}, stores || {});
  const ctx = {
    console, JSON, Object, Array, String, Number, Boolean, RegExp, Date, Math, Intl,
    isNaN, isFinite, parseInt, parseFloat, encodeURIComponent,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      get length() { return Object.keys(store).length; },
      key: (i) => Object.keys(store)[i]
    }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  ['day.js', 'study-control.js'].forEach((f) => vm.runInContext(read(f), ctx, { filename: f }));
  ctx.__store = store;
  return ctx;
}
/* Noon on a day of October 2026 (or any month), local time. */
const at = (m, d, h, y) => new Date(y || 2026, m - 1, d, h == null ? 12 : h).getTime();
function fresh() { const c = hub({}); c.StudyControl.adopt(); return c; }

/* ── 1. the week at a glance ─────────────────────────────────────────── */
group('Each weekday is the protocol\'s own row');
{
  const SC = fresh().StudyControl;
  const mon = SC.dayPlan(SC.read(), at(10, 19));
  ok(mon.day === 'Monday' && /dissection 16:00/.test(mon.fixed), 'Monday is the histology lab and the 16:00 dissection');
  ok(mon.rows.filter((r) => r.must).map((r) => r.id).join() === 'histology', 'and its must-do is histology');
  ok(mon.rows[0].id === 'daily' && /22:00/.test(mon.rows[0].text) && /100/.test(mon.rows[0].text),
     'every day starts with the daily rules: reviews before new, done by 22:00, the caps');
  const thu = SC.dayPlan(SC.read(), at(10, 22));
  ok(thu.rows.find((r) => r.must).id === 'anatomy' && !thu.rows.some((r) => r.id === 'embryology'),
     'Thursday is anatomy\'s, and embryology has nothing that day');
  ok(SC.dayPlan(SC.read(), at(10, 20)).rows.find((r) => r.id === 'step').text === 'AnKing',
     'before 2 November a Tuesday\'s Step work is AnKing only');
  ok(/block 1/.test(SC.dayPlan(SC.read(), at(11, 24)).rows.find((r) => r.id === 'step').text),
     'after it, Tuesday adds block 1 — the Qbanks start 2 November');
  const sat = SC.dayPlan(SC.read(), at(11, 7));
  ok(/Step Saturday/.test(sat.fixed), 'the first Saturday of a month is the 2.5-hour Step Saturday');
  ok(/75 min/.test(SC.dayPlan(SC.read(), at(10, 24)).fixed), 'any other Saturday is the 75-minute session');
}

/* ── 2. Sunday ─────────────────────────────────────────────────────────── */
group('Sunday carries the review and works out its own re-test list');
{
  const c = fresh(), SC = c.StudyControl, s = SC.read();
  s.results.p1 = { date: '2026-10-18', subject: 'histology', kind: 'practice', title: 'W3 set 1', score: 16, max: 20, createdAt: '2026-10-18T10:00:00Z' };
  SC.write(s, at(10, 18));
  const sun = SC.dayPlan(SC.read(), at(10, 25));
  ok(sun.sunday && sun.sunday.length === 6, 'the six-step Sunday review is there on a Sunday');
  ok(!SC.dayPlan(SC.read(), at(10, 24)).sunday, 'and not on a Saturday');
  const rt = sun.rows.find((r) => r.id === 'retest');
  ok(rt && rt.must && /W3 set 1/.test(rt.text), 'the re-test hour names the set sat a week ago, from the results');
  ok(/Guyton Review/.test(SC.dayPlan(SC.read(), at(11, 8)).rows.find((r) => r.id === 'retest').text),
     'and a month on, the practice set of 9 October comes back');
  ok(/nothing to re-take/.test(SC.dayPlan(SC.read(), at(11, 1)).rows.find((r) => r.id === 'retest').text),
     'a Sunday with nothing a week or a month old says so instead of listing nothing');
}

/* ── 3. the countdown is computed, not typed ───────────────────────────── */
group('The stacked-week countdown follows the dates');
{
  const SC = fresh().StudyControl;
  const st = (m, d) => SC.countdown(SC.read(), at(m, d)).filter((x) => x.id === 'nov').map((x) => x.stage)[0] || null;
  ok(st(10, 18) === null, '22 days before the Module A week, nothing yet');
  ok(st(10, 19) === 't21', 'T−21 on 19 October: list the week, count the reading left');
  ok(st(10, 26) === 't14', 'T−14 on 26 October: boost begins');
  ok(st(11, 2) === 't7', 'T−7 on 2 November: no first reading, mocks');
  ok(st(11, 10) === 'week', 'the week itself');
  ok(st(11, 15) === 'after' && st(11, 16) === null, 'and two days after it, then gone');
  ok(SC.dayPlan(SC.read(), at(11, 3)).floorWeek && /Floor/.test(SC.dayPlan(SC.read(), at(11, 3)).rows.find((r) => r.id === 'step').text),
     'from T−7 Step drops to Floor');
  ok(!SC.dayPlan(SC.read(), at(10, 27)).floorWeek, 'but not at T−14');

  const seedPartials = SC.view(SC.SEED).events.filter((e) => e.kind === 'partial');
  ok(seedPartials.every((e) => SC.PROTOCOL.STACKED.some((w) => e.date >= w.from && e.date <= w.to)),
     'every partial in the term falls inside one of the protocol\'s stacked weeks');
  ok(SC.countdowns(SC.read()).length === SC.PROTOCOL.STACKED.length, 'so none of them gets a second countdown');

  const s = SC.read();
  s.events.embp = { date: '2026-12-02', time: '', subject: 'embryology', kind: 'partial', title: 'Embryology partial', note: '', graded: true, prep: {} };
  SC.write(s, at(10, 18));
  const own = SC.countdown(SC.read(), at(11, 11)).find((x) => x.id === 'ev-embp');
  ok(own && own.stage === 't21', 'a TBC partial typed in later gets its own countdown, three weeks out');
  ok(SC.flags(SC.read(), at(11, 11)).some((f) => f.rule === 'R12' && /Embryology partial/.test(f.title)),
     'and Study Control raises it as R12');
}

/* ── 4. a bad day ──────────────────────────────────────────────────────── */
group('A bad day is the minimum viable day, and back');
{
  const SC = fresh().StudyControl;
  SC.badDay(true, at(10, 21));
  const p = SC.dayPlan(SC.read(), at(10, 21));
  ok(p.bad && p.rows.length === 4 && p.rows.every((r) => /^bad-/.test(r.id)), 'the rows become the four of the minimum');
  ok(/physiology, graded in 2 days/.test(p.rows[1].text), 'its ten questions name the subject graded next (Friday\'s physiology)');
  ok(!SC.dayPlan(SC.read(), at(10, 22)).bad, 'it is for that day only');
  SC.badDay(false, at(10, 21));
  ok(!SC.dayPlan(SC.read(), at(10, 21)).bad, 'and can be undone');
}

/* ── 5. ticks are the store's ──────────────────────────────────────────── */
group('A tick is kept in Study Control, and counts as a day told');
{
  const c = fresh(), SC = c.StudyControl;
  SC.tickFloor('histology', true, at(10, 19));
  const raw = JSON.parse(c.__store[SC.KEY]);
  ok(raw.floor['2026-10-19'].histology === 1, 'under floor, by day, in ct_studycontrol_v1 (synced and backed up)');
  ok(SC.dayPlan(SC.read(), at(10, 19)).rows.find((r) => r.id === 'histology').done, 'and the day reads it back');
  ok(SC.lastTold(SC.read(), at(10, 20)) === '2026-10-19', 'ticking the floor is the day reported, which drift must see');
}

/* ── 6. open items and Step dates ──────────────────────────────────────── */
group('The open items and Step dates answer in the plan\'s shape');
{
  const SC = fresh().StudyControl;
  const D = SC.dated(SC.read(), '2026-10-26');
  ok(D.every((x) => ['id', 'kind', 'date', 'label', 'href', 'late'].every((k) => k in x)), 'each row has the fields PlanV2.dated() returns');
  ok(D.find((x) => x.id === 'd3-order').late && !D.find((x) => x.id === 'd3-amboss').late,
     'the physiology order, due 24 October, is overdue on the 26th; the AMBOSS quote, 1 November, is not');
  ok(!D.some((x) => x.id === 'd3-cyto'), 'an item the document gave no date is not invented one');
  ok(SC.openItems(SC.read()).some((x) => x.id === 'd3-cyto' && !x.by), 'it is still listed on Study Control');
  ok(D.some((x) => x.id === 'ms-step1' && x.date === '2028-07-27'), 'Step 1 on 27 July 2028 is a milestone');
  ok(!SC.dated(SC.read(), '2026-11-03').some((x) => x.id === 'ms-qbank'), 'a milestone already past is not listed');
  SC.setItem('d3-order', true, at(10, 26));
  ok(!SC.dated(SC.read(), '2026-10-26').some((x) => x.id === 'd3-order'), 'ticking an item removes it');
  ok(SC.openItems(SC.read()).find((x) => x.id === 'd3-order').done === '2026-10-26', 'and Study Control shows the day it was done');
}

/* ── 7. the calendar entries ───────────────────────────────────────────── */
group('The protocol\'s classes are written once, editable, deletable');
{
  const c = fresh(), SC = c.StudyControl;
  const told = JSON.stringify(SC.read().told);
  const n = SC.ensureProtocol();
  const ev = SC.read().events;
  ok(n > 30 && ev['step-2026-10-24'] && ev['step-2026-10-24'].kind === 'session' && ev['step-2026-10-24'].subject === 'step',
     'every Saturday from 24 October is a Step group session (' + n + ' written)');
  ok(/Step Saturday/.test(ev['step-2026-11-07'].title), 'the first of each month is the Step Saturday');
  ok(['ana-sem7', 'ana-sem8', 'ana-sem9', 'ana-sem10'].every((k) => ev[k] && ev[k].kind === 'seminar'),
     'anatomy seminars 7–10 are on the Tuesdays from 17 November');
  ok(SC.ensureProtocol() === 0, 'a second open writes nothing');
  ok(JSON.stringify(SC.read().told) === told, 'and a schedule appearing is not a day reported');
  const s = SC.read(); delete s.events['step-2026-10-31']; s.dismissed['step-2026-10-31'] = 1; SC.write(s, at(10, 20));
  SC.ensureProtocol();
  ok(!SC.read().events['step-2026-10-31'], 'a deleted session stays deleted');
  ok(SC.prepFor(ev['step-2026-10-24']).length === 2 && /starred/.test(SC.prepFor(ev['step-2026-10-24'])[1]),
     'its prep is the session\'s: numbers and two starred misses');
  ok(!SC.flags(SC.read(), at(10, 24)).some((f) => /step-/.test(f.id)), 'and it trips no class rule');
}

/* ── 8. the new rules ──────────────────────────────────────────────────── */
group('R13 and R14, and R9 counting AnKing');
{
  const c = fresh(), SC = c.StudyControl, s = SC.read();
  s.results = {};
  s.results.a = { date: '2026-10-20', subject: 'physiology', kind: 'practice', title: 'Ch 6 set 1', score: 15, max: 20, createdAt: '2026-10-20T10:00:00Z' };
  s.results.b = { date: '2026-10-21', subject: 'histology', kind: 'practice', title: 'W3 set 1', score: 12, max: 20, createdAt: '2026-10-21T10:00:00Z' };
  s.results.d = { date: '2026-10-22', subject: 'histology', kind: 'practice', title: 'W3 set 2', score: 13, max: 20, createdAt: '2026-10-22T10:00:00Z' };
  SC.write(s, at(10, 22));
  const F = SC.flags(SC.read(), at(10, 22));
  const r13 = F.filter((f) => f.rule === 'R13');
  ok(r13.some((f) => f.id === 'set:a' && f.lvl === 'warn' && /set 2/.test(f.todo)), '75% is a warning: set 2 and a re-read');
  ok(r13.some((f) => f.id === 'set:b' && f.lvl === 'change' && /fresh set/.test(f.todo)), '60% is a change: re-read, then a fresh set');
  ok(r13.some((f) => /^settrend:histology/.test(f.id)), 'two histology sets in a row under 70% is a method review');
  ok(!SC.flags(SC.read(), at(10, 30)).some((f) => /^set:/.test(f.id)), 'a set more than a week old is no longer flagged');
  ok(!SC.flags(SC.read(), at(11, 6)).some((f) => f.rule === 'R13'), 'and the method review stands for two weeks, then goes');
  ok(SC.headsUp(SC.read(), at(10, 22), 10).some((f) => f.rule === 'R13'), 'and R13 reaches the front door');

  const s2 = SC.read();
  s2.anki['w2026-10-19'] = { week: '2026-10-19', anatomy: { min: 100, newMax: 120 }, step: { min: 61 } };
  SC.write(s2, at(10, 22));
  const G = SC.flags(SC.read(), at(10, 22));
  ok(G.some((f) => f.rule === 'R14' && f.subj === 'anatomy' && /120 new/.test(f.title)), 'over 100 new anatomy cards on one day is the cap failing');
  ok(G.some((f) => f.rule === 'R14' && f.subj === 'step' && /never reviews/.test(f.todo)), 'AnKing over 60 min a day: cut new, never reviews');
  ok(G.some((f) => f.rule === 'R9' && /161 real min/.test(f.title)), 'and R9\'s 2½-hour ceiling counts AnKing with the rest');

  SC.ingestWeeks({ '2026-10-26': { days: 3, subjects: { step: { min: 20, total: 60 }, anatomy: { min: 40, newMax: 90 } } } }, '2026-10-28T20:00:00Z', at(10, 28));
  const w = SC.read().anki['w2026-10-26'];
  ok(w.step && w.step.min === 20 && w.anatomy.newMax === 90, 'a sync files the AnKing row and the busiest day\'s new cards');
}

/* ── 9. phases ─────────────────────────────────────────────────────────── */
group('The Step phase and its Floor come from the date');
{
  const SC = fresh().StudyControl;
  ok(SC.phaseOf('2026-10-18').n === '0' && !/blocks/.test(SC.phaseOf('2026-10-18').floor), 'Phase 0 before the Qbanks: AnKing and the week\'s FA pages');
  ok(/2 blocks/.test(SC.phaseOf('2026-11-05').floor), 'from 2 November, two blocks join the Floor');
  ok(SC.phaseOf('2026-11-16').n === '1', 'Phase 1 begins 16 November');
  ok(SC.phaseOf('2027-07-01').floor === 'Floor only', 'year-2 finals are Floor only');
}

/* ── 10. the pages ask, they do not keep ───────────────────────────────── */
group('Both pages ask Study Control for the protocol');
{
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const al = strip(read('Almanac.html')), sc = strip(read('Study Control.html'));
  ok(/SC\.dayPlan\(/.test(al) && /SC\.tickFloor\(/.test(al) && /SC\.badDay\(/.test(al), 'the Almanac draws the day from SC.dayPlan and ticks through SC');
  ok(/SC\.dated\(/.test(al) && /PV\.dated\(/.test(al), 'its dates list asks both owners');
  ok(/SC\.ensureProtocol\(\)/.test(al) && /SC\.ensureProtocol\(\)/.test(sc), 'both write the protocol\'s classes on first open');
  ok(/id="protocol"/.test(read('Study Control.html')) && /SC\.PROTOCOL\.WEEK/.test(sc), 'Study Control has the protocol panel, printing the protocol\'s own table');
  ok(['R11', 'R12', 'R13', 'R14'].every((r) => new RegExp('<b>' + r + '</b>').test(read('Study Control.html'))), 'and its rules list states R11 to R14');
  /* Shipped broken: the sabbath hid this section, the heads-ups and class
     prep. The protocol's review day is Sunday and the sabbath was a Sunday,
     so the Sunday review and the re-test hour were asked for on no day. The
     sabbath sets the tone; it does not remove the work. */
  ok(/if \(SC\) H \+= protocolHTML\(s\)/.test(al) && !/sabbath\(\)\s*\?\s*\[\]\s*:\s*SC\.headsUp/.test(al) && !/held\s*\?\s*\[\]/.test(al),
     'the sabbath hides neither the protocol, nor the heads-ups, nor class prep');
  ok(/go light/.test(al) && /Keep it light/.test(al), 'it says to keep the day light instead');
  ok(!/\bProtocol\.html\b/.test(read('sitemap.js')), 'no new page: A1.7, no new trackers, pages or decks');
}

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
