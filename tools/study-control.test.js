/* ─────────────────────────────────────────────────────────────
   study-control.test.js — a term spent studying is not a rut.

   Run with `node tools/study-control.test.js` from the repo root. Also run
   by the deploy.

   WHAT WAS BROKEN. Study Control was a standalone page that kept its data
   under `studyControl.v1` and its rules in an inline script. For the first
   month of Year 2 it was the only thing in use. Systems.drift() read the
   Life Log and the season board, saw neither touched, and would have opened
   the Standing on a floor day — "N days down" — over weeks of logged quizzes
   and ticked prep. The season board's bug (tools/rut.test.js) again, with a
   new owner nobody told drift about.

   So: StudyControl owns the term and answers lastTold(); drift asks it. These
   assertions DRIVE THE CLOCK, per CLAUDE.md.
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
    isNaN, isFinite, parseInt, parseFloat,
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
  ['day.js', 'season.js', 'study-control.js', 'plan-v2-data.js', 'plan-v2.js', 'systems.js']
    .forEach((f) => vm.runInContext(read(f), ctx, { filename: f }));
  ctx.__store = store;
  return ctx;
}

/* Wednesday 14 October 2026, 21:00 local: the evening this was written for,
   set here rather than read. */
const NOW = new Date(2026, 9, 14, 21, 0, 0, 0).getTime();
const DAY = 86400000;
const keyAt = (() => { const c = hub({}); return (ms) => c.CTDay.key(ms); })();
const daysAgo = (n) => keyAt(NOW - n * DAY);
const lifelog = (...days) => JSON.stringify({
  days: days.reduce((o, k) => { o[k] = { screen: { total: '5.0' } }; return o; }, {})
});

/* ── 1. the bug ────────────────────────────────────────────────────────── */
group('Studying is the hub being told about the day');
{
  const stale = lifelog(daysAgo(30));
  const before = hub({ ct_lifelog_v1: stale });
  ok(before.Systems.drift(NOW) === 30 && before.Systems.floorDay(NOW) === true,
     'a month since the last Life Log day is a floor day, with nothing else to go on');

  const after = hub({ ct_lifelog_v1: stale });
  const s = after.StudyControl.read();
  s.events['phy-2026-10-16'].prep = { p0: 1 };
  after.StudyControl.write(s, NOW);
  ok(after.Systems.drift(NOW) === 0, 'ticking prep tonight in Study Control is tonight reported');
  ok(after.Systems.floorDay(NOW) === false, 'so the Standing does not call a study night a rut');
}

/* ── 2. what counts, and what does not ─────────────────────────────────── */
group('lastTold is the day something was written, never later than today');
{
  const c = hub({});
  ok(c.StudyControl.lastTold(null, NOW) === null, 'a store never written is silence, not day zero');
  ok(c.Systems.drift(NOW) === 0, 'and silence alone does not invent drift');

  const d = hub({ ct_studycontrol_v1: JSON.stringify({ results: {
    r: { date: daysAgo(6), subject: 'histology', kind: 'quiz', score: 5, max: 9, createdAt: new Date(NOW - 2 * DAY).toISOString() }
  } }) });
  ok(d.StudyControl.lastTold(null, NOW) === daysAgo(2),
     'a quiz sat six days ago and logged two days ago counts on the day it was logged');

  const e = hub({ ct_studycontrol_v1: JSON.stringify({ told: { [daysAgo(5)]: 1, [daysAgo(-3)]: 1 } }) });
  ok(e.StudyControl.lastTold(null, NOW) === daysAgo(5), 'a day key after today is stepped over, not trusted');
}

/* ── 3. moving in from the standalone page ─────────────────────────────── */
group('The old page\'s data is copied across, and opening is not reporting');
{
  const legacy = JSON.stringify({ events: {}, results: { x: { date: '2026-10-01', subject: 'anatomy', kind: 'quiz', score: 9, max: 10 } }, anki: {}, actions: {} });
  const c = hub({ studyControl: 1, 'studyControl.v1': legacy });
  ok(c.StudyControl.summary(NOW) === null, 'the Standing shows nothing before the page has been opened here');
  ok(c.StudyControl.adopt() === true, 'opening the page adopts the old key');
  const s = JSON.parse(c.__store.ct_studycontrol_v1);
  ok(s.results.x && s.results.x.score === 9, 'with its results intact');
  ok('studyControl.v1' in c.__store, 'and the original is left where it was');
  ok(Object.keys(s.told).length === 0, 'without stamping a day — opening a page is not telling the hub anything');
  ok(c.StudyControl.adopt() === false, 'and adopting twice does nothing');
}

/* ── 4. the rules, on the term as written ──────────────────────────────── */
group('The rules give the page\'s answer for 14 October');
{
  const c = hub({});
  const F = c.StudyControl.flags(c.StudyControl.SEED, NOW);
  const rules = (r) => F.filter((f) => f.rule === r);
  ok(rules('R1').length === 1 && /67%/.test(rules('R1')[0].title), 'R1: the 6/9 histology quiz is under 70%');
  ok(rules('R6').some((f) => f.lvl === 'change' && /W2/.test(f.title)), 'R6: no cards two days after the W2 lab is a change');
  ok(rules('R5').length === 3, 'R5: today’s seminar, tomorrow’s lab and Friday’s test are under-prepped');
  ok(rules('R8').length === 2, 'R8: anatomy and histology recall under 80% are warnings, physiology is not');
  ok(rules('R10').length === 0, 'R10: last week’s Anki row exists');
  ok(F[0].lvl === 'change', 'changes sort ahead of warnings');

  const n = c.StudyControl.nextGraded(c.StudyControl.SEED, NOW);
  ok(n && n.subject === 'physiology' && n.days === 2, 'next graded is Friday’s physiology entrance test');

  const tue = new Date(2026, 9, 20, 9, 0, 0, 0).getTime();
  ok(c.StudyControl.flags(c.StudyControl.SEED, tue).some((f) => f.rule === 'R10'),
     'R10: by Tuesday 20 October with no row for the week of 12 October, the export is owed');
}

/* ── 5. it is a place in the hub ───────────────────────────────────────── */
group('Study lands on it');
{
  const ctx = { console, JSON, Object, Array, String, RegExp, Date, Math };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('sitemap.js'), ctx);
  const d = ctx.SITEMAP.destinations().find((x) => x.id === 'study');
  ok(d && d.lands === 'Study Control.html', 'the Study destination opens on Study Control');
  ok(/study-control\.js/.test(read('Standing.html')), 'the Standing loads the owner it asks');
  ok(!/localStorage\.getItem\(['"]ct_studycontrol/.test(read('Standing.html') + read('systems.js')),
     'and nothing outside the owner reads its key');
}

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
