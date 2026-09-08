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
    [WED]: { session: 'Strength A', slot: 'mon', done: false, committed: 6, free: 9,
             blocks: [{ title: 'Smoothie bar', kind: 'other', from: '9:00', to: '15:00', hours: 6, allDay: false }] },
    [THU]: { session: 'Strength B', slot: 'wed', done: true, committed: 2, free: 13,
             blocks: [{ title: 'Lecture', kind: 'class', from: '10:00', to: '12:00', hours: 2, allDay: false }] },
    '2026-09-11': { session: 'Strength C + shadow', slot: 'fri', done: false, committed: 0, free: 15, blocks: [] },
    '2026-09-12': { session: 'Long easy', slot: 'sat', done: false, committed: 4, free: 11,
                    blocks: [{ title: 'Shift', kind: 'work', from: '8:00', to: '12:00', hours: 4, allDay: false }] },
    /* A Sunday the calendar has nothing on — the template still assumes the
       9:00 shift, and the board must not print an hour nobody booked. */
    '2026-09-13': { session: null, slot: null, done: false, committed: 0, free: 15, blocks: [] },
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

  b.state.day = 'sun';                       // the template assumes a 9:00 shift; the calendar has none
  const w = b.renderVals();
  ok(w.slots.filter(s => s.kind === 'work').length === 0, 'a day your calendar left clear prints no shift');
  ok(/dropped/.test(w.shapeNote), 'and says the template’s shift was dropped, not that the day is empty');
}

group('A job the classifier cannot name is still an hour you are busy');
{
  /* The classifier reads titles — clinic, ward, shift, lecture — and colours
     by them. Filtering the timetable through it meant the clinical rota
     appeared and the job did not, because "Smoothie bar" is none of those
     words. It is six hours either way. */
  const b = board({ ct_week_v1: JSON.stringify(plannedWeek()), ct_grind_v1: JSON.stringify(GRIND) });
  b.state.day = 'wed';
  const v = b.renderVals();
  const booked = v.slots.filter(s => /Smoothie bar/.test(s.label));
  ok(booked.length === 1 && booked[0].time === '9:00–15:00',
     'the shift is on the timetable, whatever the classifier made of its name');
  ok(/6h booked/.test(v.shapeNote), 'and the hours are counted (' + v.shapeNote.slice(0, 60) + '…)');
}

group('Nothing is booked twice');
{
  /* The template kept its hardcoded times, so breakfast, the shower, the
     cardio and the posture resets sat on top of the hours you were at work.
     A timetable that double-books you cannot be followed, and it hides the
     real problem, which is that the day is short. */
  const b = board({ ct_week_v1: JSON.stringify(plannedWeek()), ct_grind_v1: JSON.stringify(GRIND) });
  b.state.day = 'wed';
  const v = b.renderVals();
  const m = (t) => { const p = t.split(':'); return (+p[0]) * 60 + (+p[1]); };
  const span = (s) => { const p = s.time.split('–'); return [m(p[0]), m(p[1])]; };
  const shift = span(v.slots.filter(s => /Smoothie bar/.test(s.label))[0]);
  const over = v.slots.filter(s => !/Smoothie bar/.test(s.label))
                      .filter(s => { const [a, z] = span(s); return a < shift[1] && z > shift[0]; });
  const real = over.filter(s => { const [a, z] = span(s); return z - a > 10; });
  ok(real.length === 0, 'no block of the day sits on the shift (' +
     real.map(c => c.label + ' ' + c.time).join(', ') + ')');
  /* The one deliberate exception: the programme puts a two-minute posture
     reset mid-shift, at the bar. Moving that one out of the shift would be
     obeying the rule and losing the point of it. */
  ok(over.length === 1 && /Posture reset/.test(over[0].label),
     'except the mid-shift posture reset, which is meant to be done there');

  const moved = v.slots.filter(s => s.cls === 'shifted');
  ok(moved.length > 0, moved.length + ' blocks moved to clear it');
  ok(/moved from/.test(moved[0].sub), 'and each says where it was (' + moved[0].sub.slice(0, 30) + '…)');
  const times = v.slots.map(s => span(s)[0]);
  ok(times.every((t, i) => i === 0 || t >= times[i - 1]), 'the day still runs forwards');

  /* Same blocks, same lengths — the day is pushed, not rewritten. */
  const plain = board({}).renderVals();
  const len = (rows) => { const o = {}; rows.forEach(s => { o[s.label] = span(s)[1] - span(s)[0]; }); return o; };
  const was = len(plain.slots), now = len(v.slots);
  ok(Object.keys(now).filter(k => !/Smoothie bar/.test(k)).every(k => was[k] === now[k]),
     'nothing was shortened to make room');
  ok(v.slots.map(s => s.label).indexOf('Strength B') < v.slots.map(s => s.label).indexOf('Shower, food'),
     'and the order the day was written in survives');

  /* An appointment with other people is a time you have given away. */
  const gathering = v.slots.filter(s => /gathering/i.test(s.label))[0];
  ok(gathering && gathering.time === '19:00–23:00', 'the evening gathering holds its hour (' +
     (gathering ? gathering.time : 'missing') + ')');
  ok(!gathering.cls, 'and is not described as moved');
}

group('What will not fit is named rather than dropped');
{
  const week = plannedWeek();
  week.days[WED].blocks = [{ title: 'Double shift', kind: 'other', from: '6:00', to: '22:00', hours: 16, allDay: false }];
  const b = board({ ct_week_v1: JSON.stringify(week), ct_grind_v1: JSON.stringify(GRIND) });
  b.state.day = 'wed';
  const v = b.renderVals();
  ok(v.hasSpill === true, 'a sixteen-hour day cannot hold the template');
  ok(/did not fit/.test(v.spillNote), 'and the page says which blocks (' + v.spillNote.slice(0, 60) + '…)');
  ok(v.slots.filter(s => s.time === '6:00–22:00').length === 1, 'the shift itself is drawn once');
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
  ok(/9:00–15:00 · Smoothie bar/.test(rows[2].shift),
     'and a job the classifier cannot name is on the week too (' + rows[2].shift + ')');
  ok(/Moved here/.test(rows[2].sub), 'a moved session says where it came from');
  ok(/6h free/.test(rows[0].sub), 'and the row says how much of the day is left (' + rows[0].sub.slice(0, 40) + '…)');
  ok(rows[6].shift === 'Clear', 'a day with nothing booked says so plainly (' + rows[6].shift + ')');
}

console.log(failed ? '\n' + failed + ' FAILED' : '\nall green');
process.exit(failed ? 1 : 0);
