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

  /* And the row it is under has to say Strength A. The heading did; the
     timetable row underneath it kept the weekday's own hardcoded name, so
     the page read "Strength B — deadlift, overhead press, row" directly
     above Strength A's squats. */
  const train = v.slots.filter(s => s.kind === 'train' && !/Daily block|Posture reset/.test(s.label));
  ok(train.length === 1 && train[0].label === 'Strength A',
     'the timetable row is named for the session, not the weekday (' +
     train.map(t => t.label).join(', ') + ')');
  ok(/Squat, hinge, pull/.test(train[0].sub),
     'and its instruction is that session’s (' + train[0].sub.slice(0, 40) + '…)');
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
  /* The training row is excepted because it is NAMED by the session it is
     carrying, and this Wednesday is carrying Strength A. Its hour is the
     weekday's own either way, which is the next assertion. */
  ok(Object.keys(now).filter(k => !/Smoothie bar|Open — yours|Strength [AB]/.test(k))
       .every(k => was[k] === now[k]),
     'nothing was shortened to make room');
  ok(now['Strength A'] === was['Strength B'],
     'the training hour is the weekday’s own 90 minutes, whichever session fills it');
  ok(v.slots.map(s => s.label).indexOf('Strength A') < v.slots.map(s => s.label).indexOf('Shower, food'),
     'and the order the day was written in survives');

  /* An appointment with other people is a time you have given away. */
  const gathering = v.slots.filter(s => /gathering/i.test(s.label))[0];
  ok(gathering && gathering.time === '19:00–23:00', 'the evening gathering holds its hour (' +
     (gathering ? gathering.time : 'missing') + ')');
  ok(!gathering.cls, 'and is not described as moved');
}

group('The day shows where the space is');
{
  /* A timetable that runs 06:15 to 23:15 with every hour named looks like a
     day with no room in it for a friend ringing up, and that is how it gets
     abandoned. The gaps were always there; they were never drawn. */
  const b = board({ ct_week_v1: JSON.stringify(plannedWeek()), ct_grind_v1: JSON.stringify(GRIND) });
  b.state.day = 'wed';
  const v = b.renderVals();
  const open = v.slots.filter(s => /Open — yours/.test(s.label));
  ok(open.length > 0, 'the unclaimed hours are on the timetable (' + open.map(o => o.time).join(', ') + ')');
  ok(/unclaimed/.test(v.shapeNote), 'and counted (' + v.shapeNote.slice(-40) + ')');
  const m = (t) => { const p = t.split(':'); return (+p[0]) * 60 + (+p[1]); };
  const span = (s) => { const p = s.time.split('–'); return [m(p[0]), m(p[1])]; };
  ok(open.every(o => span(o)[1] - span(o)[0] >= 30), 'nothing under half an hour is called open time');
  const busy = v.slots.filter(s => !/Open — yours/.test(s.label));
  const clash = open.filter(o => busy.some(x => { const [a, z] = span(x), [c, d] = span(o); return a < d && z > c; }));
  ok(clash.length === 0, 'and open time is genuinely unclaimed (' + clash.map(c => c.time).join(', ') + ')');
}

group('An evening you hold yourself moves the training, not the other way round');
{
  const week = plannedWeek();
  week.own = { [WED]: [{ id: 'own-1', title: 'Date night', from: '17:00', to: '22:00',
                         hours: 5, allDay: false, kind: 'own', own: true }] };
  const b = board({ ct_week_v1: JSON.stringify(week), ct_grind_v1: JSON.stringify(GRIND) });
  b.state.day = 'wed';
  const v = b.renderVals();
  const date = v.slots.filter(s => /Date night/.test(s.label))[0];
  ok(date && date.time === '17:00–22:00', 'it is on the day, at its hour (' + (date ? date.time : 'missing') + ')');
  ok(date.kind === 'open', 'drawn as yours rather than as another thing prescribed to you');
  const m = (t) => { const p = t.split(':'); return (+p[0]) * 60 + (+p[1]); };
  const span = (s) => { const p = s.time.split('–'); return [m(p[0]), m(p[1])]; };
  const on = v.slots.filter(s => !/Date night/.test(s.label))
                    .filter(s => { const [a, z] = span(s); return a < 22 * 60 && z > 17 * 60; })
                    .filter(s => span(s)[1] - span(s)[0] > 10);
  ok(on.length === 0, 'and nothing is scheduled on top of it (' + on.map(o => o.label).join(', ') + ')');
  ok(/Strength A/.test(JSON.stringify(v.slots)) || v.spillNote.indexOf('Strength A') >= 0,
     'the session is either moved or reported as not fitting — never silently dropped');
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

group('Every binding the page reads is one the logic returns');
{
  /* renderVals() and the markup are one contract with nothing checking it:
     a value the template reads and the logic never returns renders as
     nothing at all, silently. `hasSession` — the flag that hides the "mark
     done" button on a day the week left clear — is exactly the kind of key
     that would fail open, and a button that writes another day's slot is
     what this whole file is about. */
  const html = fs.readFileSync(path.join(ROOT, 'Grind.dc.html'), 'utf8');
  const tpl = html.slice(html.indexOf('<x-dc>'), html.indexOf('</x-dc>'));
  const alias = new Set();
  (tpl.match(/\bas="([^"]+)"/g) || []).forEach(m => alias.add(m.slice(4, -1)));
  const keys = new Set();
  (tpl.match(/\{\{\s*([^}]+?)\s*\}\}/g) || []).forEach(m => {
    const expr = m.replace(/^\{\{\s*|\s*\}\}$/g, '');
    if (!/^[A-Za-z_$][\w$]*(\.[\w$]+)*$/.test(expr)) return;
    if (/^(true|false|null|undefined)$/.test(expr)) return;      // sc-if placeholder hints
    const head = expr.split('.')[0];
    if (!alias.has(head)) keys.add(head);
  });
  const vals = board({}).renderVals();
  const missing = [...keys].filter(k => !(k in vals));
  ok(keys.size > 30, keys.size + ' bindings read from the markup');
  ok(missing.length === 0, 'every one of them is returned (' + (missing.join(', ') || 'none missing') + ')');
  ok(keys.has('hasSession'), 'including the flag that hides the tick on a day with no session');
}

group('No session is dealt twice in one week');
{
  /* WHAT SHIPPED BROKEN. The planner deals six sessions across seven days,
     so one day always comes back empty — the busiest one. The board asked
     that day what it was CALLED, got "fri", and drew Strength C on it. The
     session itself was on the Sunday the planner had found room on. Two
     Strength C workouts in one week, both offering "Mark done", both writing
     the same week|fri key — so ticking one and clearing it cleared the
     other's record too, on a date it had never been done.

     Nothing about it looked wrong: seven rows, every one full, and the week
     it described was one session over. */
  const week = { at: NOW, days: {
    [MON]: { session: 'Strength A', slot: 'mon', done: false, committed: 0, free: 15, blocks: [] },
    [TUE]: { session: 'Engine', slot: 'tue', done: false, committed: 5, free: 10, blocks: [] },
    [WED]: { session: 'Strength B', slot: 'wed', done: false, committed: 5.5, free: 9.5, blocks: [] },
    [THU]: { session: 'Intervals', slot: 'thu', done: false, committed: 5.5, free: 9.5, blocks: [] },
    /* Friday is the day the calendar ate, so the planner placed nothing. */
    '2026-09-11': { session: null, slot: null, done: false, committed: 13, free: 2,
                    blocks: [{ title: 'Conference', kind: 'other', from: '8:00', to: '21:00',
                               hours: 13, allDay: false }] },
    '2026-09-12': { session: 'Long easy', slot: 'sat', done: false, committed: 4.5, free: 10.5, blocks: [] },
    '2026-09-13': { session: 'Strength C + shadow', slot: 'fri', done: false, committed: 6, free: 9, blocks: [] },
  } };
  const b = board({ ct_week_v1: JSON.stringify(week), ct_grind_v1: JSON.stringify(GRIND) });
  const rows = b.renderVals().weekRows;
  const focus = rows.map(r => r.focus);
  ok(focus.filter(f => /Strength C/.test(f)).length === 1,
     'Strength C appears once (' + focus.filter(f => /Strength C/.test(f)).join(' / ') + ')');
  ok(new Set(focus).size === focus.length, 'and no session at all is drawn twice');
  ok(focus[4] === 'Recovery',
     'the day the calendar took is the rest day (' + focus[4] + ')');
  ok(rows[4].mark === 'Open',
     'and is not offered as a lift to mark done, because it is not one');
  ok(focus[6] === 'Strength C + shadowboxing', 'the session is on the day the week found room on');

  /* The day view is the other place it was drawn. */
  b.state.day = 'fri';
  const v = b.renderVals();
  ok(v.dayTitle === 'Recovery', 'the day page agrees (' + v.dayTitle + ')');
  ok(v.hasSession === true && /recovery day/.test(v.sessionLabel),
     'and offers the recovery day to mark done (' + v.sessionLabel + ')');
  ok(v.slots.filter(s => /Strength/.test(s.label)).length === 0,
     'the timetable has no training row invented for it');
  /* The recovery walk is what the day carries now — but this Friday is
     thirteen hours of conference, so it does not FIT, and a block that does
     not fit is reported in the spill rather than drawn on top of a booked
     hour. Either place counts; being in neither would mean the session had
     gone missing again. */
  ok(v.slots.filter(s => /Recovery walk/.test(s.label)).length === 1 ||
     /Recovery walk/.test(v.spillNote),
     'the recovery walk is the day\u2019s session — drawn, or named in the spill');
  ok(v.slots.filter(s => /Daily block|Posture reset/.test(s.label)).length > 0,
     'and the daily block and the posture resets still stand — they are not the session');

  /* And the tick that used to cross the two: Friday's button wrote 1|fri,
     which is Sunday's session. */
  b.toggleSession('fri', b.plan(b.read()));
  ok(!b.read().sessions['1|fri'], 'ticking the rest day does not write Strength C\u2019s key');
  ok(!!b.read().sessions['1|sun'], 'it writes the rest slot\u2019s own key');
  ok(b.renderVals().weekRows[6].mark === 'Mark done', 'so Sunday\u2019s session is still undone');
}

group('The day the week leaves clear is the rest day');
{
  /* WHAT SHIPPED BROKEN. The planner deals the block's SIX TRAINING
     sessions. The seventh thing in the programme — Sunday's recovery walk —
     was never in that deal, so the day the planner left clear came back with
     nothing on it: no title, no tick, no recovery block, and the recovery
     session absent from the week altogether. Reported as "thursday isnt
     scheduled a block and therefore cannot be ticked as done... it could be
     the rest day and nothing is shown", which is exactly what it was.

     The board had gone as far as computing "Mark the recovery day done" for
     that day and then hiding the button, because there was no slot to write.

     Thursday here is the least-free day, so Thursday is the rest day, and
     Sunday carries the training the planner found room for there. */
  const week = { at: NOW, days: {
    [MON]: { session: 'Strength A', slot: 'mon', done: false, committed: 0, free: 15, blocks: [] },
    [TUE]: { session: 'Intervals', slot: 'thu', done: false, committed: 5, free: 10, blocks: [] },
    [WED]: { session: 'Strength C + shadow', slot: 'fri', done: false, committed: 5.5, free: 9.5, blocks: [] },
    [THU]: { session: null, slot: null, done: false, committed: 10.5, free: 4.5,
             blocks: [{ title: 'Smoothie bar', kind: 'work', from: '8:00', to: '13:30', hours: 5.5, allDay: false },
                      { title: 'Something else', kind: 'other', from: '15:00', to: '20:00', hours: 5, allDay: false }] },
    '2026-09-11': { session: 'Engine', slot: 'tue', done: false, committed: 0, free: 15, blocks: [] },
    '2026-09-12': { session: 'Strength B', slot: 'wed', done: false, committed: 4.5, free: 10.5, blocks: [] },
    '2026-09-13': { session: 'Long easy', slot: 'sat', done: false, committed: 6, free: 9, blocks: [] },
  } };
  const b = board({ ct_week_v1: JSON.stringify(week), ct_grind_v1: JSON.stringify(GRIND) });
  b.state.day = 'thu';
  const v = b.renderVals();
  ok(v.dayTitle === 'Recovery', 'Thursday is the rest day (' + v.dayTitle + ')');
  ok(v.hasSession === true, 'and can be ticked');
  ok(/recovery day/.test(v.sessionLabel), 'as a recovery day, not a session (' + v.sessionLabel + ')');
  ok(v.slots.filter(s => /Recovery walk/.test(s.label)).length === 1,
     'the recovery walk is on its timetable');

  /* Exactly one. Four clear days must not become four rest days. */
  const wp = b.plan(b.read());
  ok(wp.days.filter(x => x.slot === 'sun').length === 1,
     'exactly one day in the week carries the rest slot');

  /* It is not one of the six, so it neither inflates the count nor is
     something the week is waiting for. */
  ok(wp.placed === 6, 'the six are still six (' + wp.placed + ')');
  ok(v.weekLine.indexOf('0/6 sessions') > -1,
     'and the week still counts six sessions (' + v.weekLine.split('.')[0] + ')');
}

group('A week the calendar ate can still be closed');
{
  /* WHAT SHIPPED BROKEN. The week's total was the block's six, always. The
     planner drops a session it cannot fit above its 1.5h floor, so a week
     with three sessions eaten offered a total of 7 that only 4 of could ever
     be reached — every placed session ticked, the cardio row ticked, and the
     advance button still not there. Week 1 could not be closed, and the
     count that made it impossible and the line saying "3 of 6 sessions
     placed" lived in different panels.

     Here Monday, Saturday and Sunday carry sessions; the four weekdays
     between them are booked solid. */
  const solid = (iso) => ({ session: null, slot: null, done: false, committed: 14, free: 1,
    blocks: [{ title: 'Shift', kind: 'work', from: '7:00', to: '21:00', hours: 14, allDay: false }] });
  const week = { at: NOW, days: {
    [MON]: { session: 'Strength A', slot: 'mon', done: true, committed: 0, free: 15, blocks: [] },
    [TUE]: solid(TUE), [WED]: solid(WED), [THU]: solid(THU), '2026-09-11': solid('2026-09-11'),
    '2026-09-12': { session: 'Engine', slot: 'tue', done: true, committed: 4.5, free: 10.5, blocks: [] },
    '2026-09-13': { session: 'Strength B', slot: 'wed', done: true, committed: 6, free: 9, blocks: [] },
  } };
  const grind = Object.assign({}, GRIND, {
    sessions: { '1|mon': true, '1|tue': true, '1|wed': true }, runs: { w1: true },
  });
  const b = board({ ct_week_v1: JSON.stringify(week), ct_grind_v1: JSON.stringify(grind) });
  const v = b.renderVals();
  ok(v.weekDone === true, 'the week is done once everything it had room for is ticked');
  ok(/4 of 4 done/.test(v.weekLine), 'the total is what the week could hold (' + v.weekLine.split('.')[0] + ')');
  ok(/had no room in this week/.test(v.weekLine),
     'and the line says how many the calendar ate');
  ok(!!v.advanceLabel && /week 2/.test(v.advanceLabel),
     'so the advance button offers week 2 (' + v.advanceLabel + ')');

  /* The pips are per week of the block, and only this one was pulled. */
  ok(b.renderVals().pips.length === 4, 'four pips, one per week of the block');
}

group('A day the planner never saw does not repeat a session it already placed');
{
  /* Only `own` blocks on a Friday the planner never wrote a row for. That
     day still falls back to the grid — it is not evidence of anything — but
     never onto a session this week has already spent. */
  const week = { at: NOW, days: {
    [MON]: { session: 'Strength C + shadow', slot: 'fri', done: false, committed: 0, free: 15, blocks: [] },
  }, own: { '2026-09-11': [{ id: 'own-1', title: 'Held evening', from: '18:00', to: '21:00',
                             hours: 3, allDay: false, kind: 'own', own: true }] } };
  const b = board({ ct_week_v1: JSON.stringify(week), ct_grind_v1: JSON.stringify(GRIND) });
  const rows = b.renderVals().weekRows;
  ok(rows[0].focus === 'Strength C + shadowboxing', 'Monday is carrying it');
  ok(rows[4].focus === 'No session — the week had no room', 'so Friday is not (' + rows[4].focus + ')');
  ok(rows[1].focus === 'Engine + standing endurance',
     'while a day whose own session is still unspent keeps it (' + rows[1].focus + ')');
}

group('With nothing pulled the grid is still the grid');
{
  /* The fallback is whole-week, and it has to survive: a device that has
     never read a calendar must still get all seven cards. */
  const rows = board({}).renderVals().weekRows;
  ok(rows.map(r => r.focus).filter(f => /No session/.test(f)).length === 0,
     'every weekday carries its own session when there is no week to say otherwise');
  ok(rows[4].focus === 'Strength C + shadowboxing', 'Friday is Strength C, because it is a Friday');
}

console.log(failed ? '\n' + failed + ' FAILED' : '\nall green');
process.exit(failed ? 1 : 0);
