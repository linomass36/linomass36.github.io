/* ─────────────────────────────────────────────────────────────
   grind-board.test.js — the board draws the week you actually have.

   Run with `node tools/grind-board.test.js` from the repo root.

   The board used to draw a grid: Monday was Strength A because it was a
   Monday. Week.html had already read the calendar and moved Strength A to
   Wednesday, and the board could not be told — so it showed the session on
   a day the clinic had eaten, its timetable printed a shift that was not
   happening, and ticking Wednesday recorded Strength B.

   Nothing about that failure was visible from the outside. The page
   rendered, every panel was full, and the week it described was fiction.

   So this lifts the page's own logic class out of Grind.dc.html and calls
   renderVals() for real against a seeded week — the only assertion that can
   catch a board quietly describing someone else's week. It also pins the
   thing that makes the join work: the slot is the SESSION, so a record
   follows its session to whichever day the week put it on.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

/* Wednesday 9 September 2026, noon — the middle of week 1 of the block. */
const NOW = new Date(2026, 8, 9, 12, 0).getTime();
const MON = '2026-09-07', TUE = '2026-09-08', WED = '2026-09-09', THU = '2026-09-10';

/* The week the planner produced: nine hours of clinic on Monday, so Strength
   A moved to Wednesday and the Thursday session took Monday's leftovers. */
function plannedWeek() {
  return { at: NOW, days: {
    [MON]: { session: 'Intervals', slot: 'thu', done: false, committed: 9, free: 6,
             blocks: [{ title: 'Clinic', kind: 'work', from: '8:00', to: '17:00', hours: 9, allDay: false }] },
    [TUE]: { session: 'Engine', slot: 'tue', done: false, committed: 5, free: 10,
             blocks: [{ title: 'Smoothie bar', kind: 'work', from: '9:00', to: '14:00', hours: 5, allDay: false }] },
    [WED]: { session: 'Strength A', slot: 'mon', done: false, committed: 0, free: 15, blocks: [] },
    [THU]: { session: 'Strength B', slot: 'wed', done: true, committed: 2, free: 13,
             blocks: [{ title: 'Lecture', kind: 'class', from: '10:00', to: '12:00', hours: 2, allDay: false }] },
    '2026-09-11': { session: 'Strength C + shadow', slot: 'fri', done: false, committed: 0, free: 15, blocks: [] },
    '2026-09-12': { session: 'Long easy', slot: 'sat', done: false, committed: 4, free: 11,
                    blocks: [{ title: 'Shift', kind: 'work', from: '8:00', to: '12:00', hours: 4, allDay: false }] },
    '2026-09-13': { session: null, slot: null, done: false, committed: 6, free: 9,
                    blocks: [{ title: 'Shift', kind: 'work', from: '9:00', to: '15:00', hours: 6, allDay: false }] },
  } };
}

function ctxFor(store) {
  const mem = Object.assign({}, store || {});
  const RealDate = Date;
  const D = class extends RealDate {
    constructor(...a) { return a.length ? new RealDate(...a) : new RealDate(NOW); }
    static now() { return NOW; }
  };
  const ctx = { window: {}, console, Date: D, JSON, Object, Array, Math, String, Number,
    parseFloat, parseInt, isNaN, isFinite, RegExp, Error, encodeURIComponent, Promise,
    setTimeout: () => 0, clearTimeout: () => {},
    APP_CONFIG: { calendar: { ids: ['x@import.calendar.google.com'] } },
    fetch: () => Promise.reject(new Error('no network in tests')),
    localStorage: { getItem: (k) => (k in mem ? mem[k] : null),
                    setItem: (k, v) => { mem[k] = String(v); },
                    removeItem: (k) => { delete mem[k]; } } };
  ctx.sessionStorage = ctx.localStorage;
  ctx.globalThis = ctx; ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  ['day.js', 'grind-data.js', 'calendar.js', 'training.js'].forEach(f =>
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
  ctx.__mem = mem;
  return ctx;
}

/* The DC runtime gives the class state + setState and nothing else this page
   touches — it reads no DOM and takes no props — so the stub is the harness
   and what runs is the shipped file. */
function board(store) {
  const ctx = ctxFor(store);
  const html = fs.readFileSync(path.join(ROOT, 'Grind.dc.html'), 'utf8');
  const m = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no logic class found in Grind.dc.html');
  vm.runInContext('class DCLogic { constructor() { this.state = {}; } ' +
                  'setState(u) { Object.assign(this.state, typeof u === "function" ? u(this.state) : u); } }',
                  ctx, { filename: 'DCLogic stub' });
  vm.runInContext(m[1] + '\nglobalThis.__Component = Component;', ctx, { filename: 'Grind.dc.html' });
  const c = vm.runInContext('new __Component()', ctx);
  c.state = { tick: 0, view: 'day', day: '', toast: '' };
  c.__ctx = ctx;
  c.__read = (k) => { try { return JSON.parse(ctx.__mem[k]); } catch (e) { return null; } };
  return c;
}

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const GRIND = { v: 1, week: 1, sessions: {}, runs: {}, checks: {}, open: {} };

group('With nothing pulled, the board is the board it always was');
{
  let vals = null, threw = null;
  const b = board({});
  try { vals = b.renderVals(); } catch (e) { threw = e; }
  ok(!threw, 'it renders on a device that has never read a calendar' + (threw ? ' — ' + threw.message : ''));
  ok(vals.dayTitle === 'Strength B — pull, press, durability',
     'Wednesday shows Wednesday’s own session (' + vals.dayTitle + ')');
  ok(vals.hasMoved === false, 'nothing claims to have moved');
  ok(/No week pulled/.test(vals.planLine), 'and the page says why, rather than implying the grid is your week');
  ok(vals.slots.length > 5 && vals.weekRows.length === 7, 'the timetable and the week are still drawn');
}

group('With a week pulled, the session follows the calendar');
{
  const b = board({ ct_week_v1: JSON.stringify(plannedWeek()), ct_grind_v1: JSON.stringify(GRIND) });
  const v = b.renderVals();
  ok(v.dayTitle === 'Strength A — squat, hinge, pull',
     'Wednesday is carrying Strength A, because that is where the week could fit it');
  ok(v.hasMoved === true && /put Strength A here/.test(v.movedNote),
     'and the page says so rather than leaving you to wonder (' + v.movedNote.slice(0, 60) + '…)');
  ok(/3 of them moved/.test(v.planLine), 'the count of what moved is on the page (' + v.planLine.slice(0, 80) + '…)');
  ok(/9 Sep/.test(v.dayShift), 'the day is dated (' + v.dayShift + ')');

  /* The checklist has to follow the session too, or you tick Strength A's
     squats against Strength B's record. */
  const titles = v.groups.map(g => g.title).join(' | ');
  ok(/Back squat/.test(JSON.stringify(v.groups)), 'the checklist is Strength A’s work (' + titles.slice(0, 50) + '…)');
}

group('The timetable stops printing a shift that is not happening');
{
  const b = board({ ct_week_v1: JSON.stringify(plannedWeek()), ct_grind_v1: JSON.stringify(GRIND) });
  b.state.day = 'mon';                       // Monday, nine hours of clinic
  const v = b.renderVals();
  const work = v.slots.filter(s => s.kind === 'work');
  ok(work.length === 1 && work[0].time === '8:00–17:00',
     'Monday’s work row is the clinic your calendar actually has (' + work.map(w => w.time).join(', ') + ')');
  ok(/calendar/.test(v.shapeNote), 'and the page says where those hours came from');
  ok(v.dayTitle === 'Non-impact work capacity', 'Monday is carrying the Thursday session');

  b.state.day = 'wed';                       // Wednesday, nothing on the calendar
  const w = b.renderVals();
  ok(w.slots.filter(s => s.kind === 'work').length === 0, 'a clear day prints no shift');
  ok(/dropped/.test(w.shapeNote), 'and says the template’s shift was dropped, not that the day is empty');
}

group('A tick on the board is a tick on the week, on the right date');
{
  const b = board({ ct_week_v1: JSON.stringify(plannedWeek()), ct_grind_v1: JSON.stringify(GRIND) });
  const v0 = b.renderVals();                 // converges the two records first
  const before = Object.keys(b.read().sessions).sort();
  v0.toggleSession();                        // Wednesday: Strength A
  const g = b.__read('ct_grind_v1'), wk = b.__read('ct_week_v1'), log = b.__read('ct_lifelog_v1');
  const added = Object.keys(g.sessions).filter(k => before.indexOf(k) < 0);
  ok(g.sessions['1|mon'] === true, 'the record is Strength A’s, not Wednesday’s');
  ok(added.join(',') === '1|mon',
     'and standing on a Wednesday marks nothing else done (' + added.join(',') + ')');
  ok(wk.days[WED].done === true, 'the dated week carries it — the column Trends reads as `trained`');
  ok(log.days[WED] && log.days[WED].gym.on === true, 'and the Life Log’s gym tick is on the 9th');
  ok(!log.days[b.logDay()] || b.logDay() === WED, 'not on whatever today happens to be');

  const v = b.renderVals();
  ok(/done/.test(v.sessionLabel) && v.sessionCls === 'done', 'the button reads done');
  ok(v.weekRows[2].cls === 'done', 'and the week view agrees');
  ok(b.weekProgress(b.read()).lifts === 2, 'week progress counts it, plus the one ticked on the Week page');
}

group('A tick made on the Week page is already on the board');
{
  /* The half of the join that used to be missing entirely: Strength B was
     ticked on Week.html (done: true on the 10th) and the board knew nothing. */
  const b = board({ ct_week_v1: JSON.stringify(plannedWeek()), ct_grind_v1: JSON.stringify(GRIND) });
  b.state.day = 'thu';
  const v = b.renderVals();
  ok(v.sessionCls === 'done', 'the board shows Thursday’s session done');
  ok(v.dayBtns[3].mark === '✓', 'and the day strip marks it');
  ok(b.weekProgress(b.read()).lifts === 1, 'and it counts toward the week');
}

group('The board parked on another week says so instead of lying');
{
  const b = board({ ct_week_v1: JSON.stringify(plannedWeek()),
                    ct_grind_v1: JSON.stringify(Object.assign({}, GRIND, { week: 3 })) });
  const v = b.renderVals();
  ok(v.dayTitle === 'Strength B — pull, press, durability', 'the grid is drawn, not week 1’s plan');
  ok(/week 1 of the block and the board is on week 3/.test(v.planLine),
     'and the mismatch is named (' + v.planLine.slice(0, 70) + '…)');
  ok(v.hasMoved === false, 'nothing is described as moved');
}

group('The week view is dated, and reads off the calendar');
{
  const b = board({ ct_week_v1: JSON.stringify(plannedWeek()), ct_grind_v1: JSON.stringify(GRIND) });
  const rows = b.renderVals().weekRows;
  ok(rows[0].day === 'Mon 7 Sep', 'rows carry their date (' + rows[0].day + ')');
  ok(/8:00–17:00 · Clinic/.test(rows[0].shift), 'and the shift is the calendar’s (' + rows[0].shift + ')');
  ok(rows[0].focus === 'Non-impact work capacity', 'Monday is showing the session it actually holds');
  ok(/Moved here/.test(rows[2].sub), 'a moved session says where it came from');
  ok(/6h free/.test(rows[0].sub), 'and the row says how much of the day is left (' + rows[0].sub.slice(0, 40) + '…)');
  ok(rows[6].shift === 'Clear' || /·/.test(rows[6].shift), 'Sunday still renders with no session placed');
}

console.log(failed ? '\n' + failed + ' FAILED' : '\nall green');
process.exit(failed ? 1 : 0);
