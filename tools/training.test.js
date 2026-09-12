/* ─────────────────────────────────────────────────────────────
   training.test.js — the plan and the board are one record.

   Run with `node tools/training.test.js` from the repo root.

   Two failures are pinned here, and both were silent in the way that
   costs you the most: the page rendered a perfectly plausible week
   either way.

     * A session ticked on the Week page did not exist as far as the
       Grind board was concerned, and one ticked on the board did not
       exist as far as the dated week — the store the Trends table
       reads as `trained` — was concerned. Two stores, two truths, and
       no way to tell from either page which one was right.

     * The board drew the fixed weekday grid. Monday was Strength A
       because it was a Monday. The Week page had already read the
       calendar and moved Strength A to Wednesday, and the board had no
       idea: it showed the session on a day the clinic had eaten, and
       ticking Wednesday recorded Strength B.

   The slot is the SESSION, not the weekday. That is the whole join, and
   most of what is checked below is that it holds wherever the week puts
   a session.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

function store() {
  const map = {};
  return {
    map,
    getItem: (k) => (k in map ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
    removeItem: (k) => { delete map[k]; },
    read: (k) => { try { return JSON.parse(map[k]); } catch (e) { return null; } },
    seed: (k, v) => { map[k] = JSON.stringify(v); },
  };
}

function load(opts) {
  opts = opts || {};
  const ls = store();
  const R = Date;
  const D = opts.now ? class extends R {
    constructor(...a) { return a.length ? new R(...a) : new R(opts.now); }
    static now() { return opts.now; }
  } : Date;
  const ctx = { console, JSON, Object, Array, Math, String, Number, Date: D, RegExp, Error,
    parseFloat, parseInt, isNaN, isFinite, encodeURIComponent, Promise, setTimeout: () => 0,
    localStorage: ls, sessionStorage: ls,
    APP_CONFIG: { calendar: { ids: ['x@import.calendar.google.com'] } },
    fetch: () => Promise.reject(new Error('no network in tests')) };
  ctx.globalThis = ctx; ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  const run = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  if (opts.grind !== false) run('grind-data.js');
  run('calendar.js');
  run('training.js');
  return { ctx, ls, T: ctx.window.CTTraining, C: ctx.window.CTCalendar, G: ctx.window.GRIND_DATA };
}

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);

/* Week 1 of the block is Mon 7 Sep – Sun 13 Sep 2026. */
const MON = '2026-09-07', TUE = '2026-09-08', WED = '2026-09-09';

group('A session is named two ways, and both name the same slot');
{
  const { T } = load();
  ok(T.slotOf('Strength A') === 'mon', 'the planner’s short label resolves');
  ok(T.slotOf('Strength A — squat, hinge, pull') === 'mon', 'and the programme’s own title');
  ok(T.slotOf('Intervals') === 'thu' && T.slotOf('Non-impact work capacity') === 'thu',
     'two words for the Thursday session, one slot');
  ok(T.slotOf('Engine') === 'tue' && T.slotOf('Engine + standing endurance') === 'tue', 'Tuesday');
  /* The one that bites: "Long easy engine" contains "engine". */
  ok(T.slotOf('Long easy') === 'sat' && T.slotOf('Long easy engine') === 'sat',
     'the long easy day is Saturday’s, not Tuesday’s, however it is written');
  ok(T.slotOf('Strength C + shadow') === 'fri' && T.slotOf('Recovery') === 'sun', 'Friday and Sunday');
  ok(T.slotOf('mon') === 'mon', 'a slot id passes through');
  ok(T.slotOf('gardening') === null && T.slotOf('') === null, 'and nothing else is guessed at');
}

group('A date knows which week of the block it is');
{
  const { T } = load();
  ok(T.blockWeek('2026-09-07') === 1, 'the block’s first Monday is week 1');
  ok(T.blockWeek('2026-09-13') === 1, 'and its Sunday still is');
  ok(T.blockWeek('2026-09-14') === 2, 'the next Monday is week 2');
  ok(T.blockWeek('2026-10-04') === 4, 'the last day of the block is week 4');
  ok(T.blockWeek('2026-10-05') === null, 'the day after it belongs to no week of this block');
  ok(T.blockWeek('2026-09-06') === null, 'nor does the day before it');
  const bare = load({ grind: false });
  ok(bare.T.blockWeek('2026-09-07') === null, 'and with no programme loaded it says so rather than guessing');
}

group('One tick, three stores');
{
  const { T, ls } = load();
  ls.seed('ct_week_v1', { days: { [MON]: { session: 'Strength A', slot: 'mon', done: false, committed: 3, free: 12 } } });
  const r = T.setDone(MON, true);
  ok(r.slot === 'mon' && r.week === 1, 'the tick files itself as week 1, slot mon');
  ok(ls.read('ct_week_v1').days[MON].done === true, 'the dated week says done — the column Trends reads');
  ok(ls.read('ct_grind_v1').sessions['1|mon'] === true, 'the board’s own key is set, in the shape it already had');
  ok(/Strength A/.test(ls.read('ct_grind_v1').days[MON]), 'and the board records what was done on that date');
  const log = ls.read('ct_lifelog_v1').days[MON];
  ok(log && log.gym && log.gym.on === true && log.gym.src === 'grind', 'the Life Log’s gym tick is set for that day');
  ok(T.isDone(MON) === true, 'and asking is done says so');

  T.setDone(MON, false);
  ok(ls.read('ct_week_v1').days[MON].done === false, 'clearing clears the week');
  ok(!ls.read('ct_grind_v1').sessions['1|mon'], 'and the board');
  ok(!ls.read('ct_lifelog_v1').days[MON].gym.on, 'and the log');
  ok(T.isDone(MON) === false, 'nothing is left saying you trained');
}

group('The session keeps its record wherever the week puts it');
{
  const { T, ls } = load();
  /* The clinic ate Monday, so Strength A is on Wednesday. */
  ls.seed('ct_week_v1', { days: {
    [MON]: { session: 'Intervals', slot: 'thu', done: false, committed: 9, free: 6 },
    [WED]: { session: 'Strength A', slot: 'mon', done: false, committed: 2, free: 13 },
  } });
  T.setDone(WED, true);
  const g = ls.read('ct_grind_v1');
  ok(g.sessions['1|mon'] === true, 'ticking Wednesday records STRENGTH A, not Wednesday’s usual session');
  ok(!g.sessions['1|wed'], 'and nothing is recorded against the session that did not happen');
  ok(/Strength A/.test(g.days[WED]), 'the date carries the session that was actually done');
  ok(T.isDone(WED) === true && T.isDone(MON) === false, 'done on Wednesday, not on Monday');
}

group('The Life Log is stamped on the day it was done');
{
  const { T, ls } = load();
  /* The board used to write today’s date whichever day you were looking
     at, so a Tuesday session ticked on Wednesday logged the gym on
     Wednesday — and the day’s totals counted it there. */
  ls.seed('ct_week_v1', { days: { [TUE]: { session: 'Engine', slot: 'tue', done: false } } });
  T.setDone(TUE, true);
  const days = ls.read('ct_lifelog_v1').days;
  ok(days[TUE] && days[TUE].gym.on === true, 'the day the session happened carries the gym tick');
  ok(Object.keys(days).length === 1, 'and no other day does');
}

group('A tick that only one store knew about survives');
{
  const { T, ls } = load();
  /* Weeks of board ticks predate the join. Neither store is wrong — each
     records something the other never saw — so the union is taken. */
  ls.seed('ct_grind_v1', { v: 1, week: 1, sessions: { '1|mon': true }, runs: {}, checks: {}, open: {} });
  ls.seed('ct_week_v1', { days: {
    [MON]: { session: 'Strength A', slot: 'mon', done: false, committed: 3, free: 12 },
    [TUE]: { session: 'Engine', slot: 'tue', done: false, committed: 5, free: 10 },
  } });
  ok(T.isDone(MON) === true, 'the board’s tick is visible from the dated side before anything is written');
  const n = T.reconcile({ start: new Date(2026, 8, 7), end: new Date(2026, 8, 14) });
  ok(n === 1, 'one day needed converging');
  ok(ls.read('ct_week_v1').days[MON].done === true, 'and the dated week now carries it too');
  ok(ls.read('ct_week_v1').days[TUE].done === false, 'a session nobody ticked is still not done');

  /* And it must not raise the dead: clearing goes through the same writer,
     which clears both, so the next reconcile has nothing to put back. */
  T.setDone(MON, false);
  T.reconcile({ start: new Date(2026, 8, 7), end: new Date(2026, 8, 14) });
  ok(T.isDone(MON) === false, 'a session you cleared stays cleared');
}

group('The board can ask what the calendar did with its week');
{
  const { T, ls } = load();
  ls.seed('ct_week_v1', { days: {
    [MON]: { session: 'Intervals', slot: 'thu', done: false, committed: 9, free: 6, blocks: [] },
    [TUE]: { session: 'Engine', slot: 'tue', done: true, committed: 5, free: 10, blocks: [] },
    [WED]: { session: 'Strength A', slot: 'mon', done: false, committed: 2, free: 13, blocks: [] },
  } });
  const wk = T.week({ start: new Date(2026, 8, 7), end: new Date(2026, 8, 14) });
  ok(wk && wk.days.length === 7, 'seven dated days come back');
  ok(wk.blockWeek === 1, 'and they are week 1 of the block');
  ok(wk.days[0].slot === 'thu' && wk.days[0].moved === true, 'Monday is carrying the Thursday session, and says so');
  ok(wk.days[2].slot === 'mon' && wk.days[2].moved === true, 'Wednesday is carrying Strength A');
  ok(wk.days[1].moved === false, 'Tuesday kept its own and is not flagged as moved');
  ok(wk.moved === 2 && wk.placed === 3, 'two moved of three placed');
  ok(wk.days[6].slot === null && wk.days[6].planned === false, 'a day the planner never reached is empty, not invented');
  const none = load().T.week({ start: new Date(2026, 8, 7), end: new Date(2026, 8, 14) });
  ok(none === null, 'and with nothing pulled it returns nothing rather than a fake week');
}

group('The planner deals slots, and they are saved');
{
  const { T, C, ls } = load();
  const range = { start: new Date(2026, 8, 7), end: new Date(2026, 8, 14) };
  /* A Monday buried under nine hours of clinic cannot hold a session. */
  const ev = (day, hours) => ({ title: 'Clinic', day, kind: 'work', allDay: false,
    start: new Date(day + 'T08:00:00'), end: new Date(day + 'T' + String(8 + hours).padStart(2, '0') + ':00:00'),
    hours, uid: day });
  const plan = C.planWeek([ev(MON, 14)], { range });
  ok(plan.placed.every(p => p.slot), 'every placed session carries its slot');
  ok(plan.placed.map(p => p.slot).sort().join(',') === 'fri,mon,sat,thu,tue,wed',
     'and the six slots are the block’s six, whatever days they landed on');
  const buried = plan.days.filter(d => d.key === MON)[0];
  ok(!buried.session, 'the day the clinic ate got nothing');
  C.saveWeek(plan);
  const saved = ls.read('ct_week_v1').days;
  const wed = saved[WED];
  ok(wed.slot && T.slotOf(wed.session) === wed.slot, 'the saved day agrees with itself about which session it holds');
  const wk = T.week(range);
  ok(wk.placed === 6, 'and the board reads all six back off the store');
}

group('On a Sunday the board is not shown next week');
{
  /* Week.html plans NEXT week on a Sunday — that is the ritual. The board's
     job is today, so it must be given the week it is standing in whenever
     that one has been pulled, or Sunday shows a week that has not started
     and marks the wrong day as today. */
  const SUN = '2026-09-13';                      // the Sunday closing week 1
  const { T, ls } = load({ now: new Date(2026, 8, 13, 10, 0).getTime() });
  ls.seed('ct_week_v1', { days: {
    [MON]: { session: 'Strength A', slot: 'mon', done: false, committed: 3, free: 12 },
    [SUN]: { session: null, slot: null, done: false, committed: 6, free: 9 },
    '2026-09-14': { session: 'Strength A', slot: 'mon', done: false, committed: 0, free: 15 },
  } });
  const wk = T.week();
  ok(wk && wk.days[0].iso === MON, 'the week containing today is the one returned (' + (wk && wk.days[0].iso) + ')');
  ok(wk.blockWeek === 1, 'which is week 1, the week being finished — not week 2');

  /* With only next week pulled there is nothing else to show, and the
     ritual's own week is the right answer. */
  const b = load({ now: new Date(2026, 8, 13, 10, 0).getTime() });
  b.ls.seed('ct_week_v1', { days: { '2026-09-14': { session: 'Strength A', slot: 'mon', done: false } } });
  const nx = b.T.week();
  ok(nx && nx.days[0].iso === '2026-09-14', 'and the week being planned when that is all there is');
}

group('An evening you hold yourself is a commitment like any other');
{
  const { T, C, ls } = load();
  const range = { start: new Date(2026, 8, 7), end: new Date(2026, 8, 14) };
  const FRI = '2026-09-11';
  ok(T.addOwn(FRI, { title: 'Date night', from: '19:00', to: '23:00' }), 'an evening can be held');
  ok(!T.addOwn(FRI, { title: 'Backwards', from: '22:00', to: '19:00' }), 'but not one that ends before it starts');
  ok(!T.addOwn('not-a-date', { title: 'x', from: '9:00', to: '10:00' }), 'and not on a day that is not a day');
  const held = T.own(FRI);
  ok(held.length === 1 && held[0].own === true && held[0].hours === 4, 'four hours of Friday are gone');

  /* The planner is given it, so nothing is laid on top of it. */
  const plan = C.planWeek(T.eventsFromStore(range), { range });
  const fri = plan.days.filter(d => d.key === FRI)[0];
  ok(fri.committed === 4, 'the planner counts it as committed (' + fri.committed + 'h)');
  C.saveWeek(plan);

  /* And the thing that matters most: a re-pull must not delete your Friday.
     saveWeek rewrites `days` wholesale, so it is stored somewhere else. */
  const again = C.planWeek([], { range });
  C.saveWeek(again);
  ok(T.own(FRI).length === 1, 'a fresh pull of the week leaves it standing');
  ok(ls.read('ct_week_v1').days[FRI].blocks.every(b => !b.own), 'and it is not duplicated into the pulled blocks');

  const d = T.day(FRI);
  ok(d.blocks.some(b => b.title === 'Date night'), 'every page that draws the day sees it');
  ok(d.committed >= 4, 'and it is charged to the day’s committed hours (' + d.committed + 'h)');

  ok(T.dropOwn(FRI, held[0].id) === true, 'it can be let go');
  ok(T.own(FRI).length === 0, 'and then it is gone');
  ok(T.dropOwn(FRI, 'nothing') === false, 'letting go of nothing changes nothing');
}

group('A session already done does not get dealt somewhere else');
{
  /* Re-planning re-deals the week — that is the point of it — but a session
     you have already trained is a fact about a day, not a plan for it. */
  const { T, C, ls } = load();
  const range = { start: new Date(2026, 8, 7), end: new Date(2026, 8, 14) };
  ls.seed('ct_week_v1', { days: {
    [MON]: { session: 'Strength A', slot: 'mon', done: true, committed: 0, free: 15, blocks: [] },
  } });
  const plan = C.planWeek([], { range, pinned: { [MON]: { session: 'Strength A', slot: 'mon' } } });
  const mon = plan.days.filter(d => d.key === MON)[0];
  ok(mon.session === 'Strength A', 'Monday keeps the session it was ticked for');
  const others = plan.days.filter(d => d.key !== MON).map(d => d.session).filter(Boolean);
  ok(others.indexOf('Strength A') < 0, 'and Strength A is not dealt a second time');
  ok(plan.placed.length === 6, 'the other five are still dealt round it');
}

group('Without the programme, nothing explodes');
{
  const { T, ls } = load({ grind: false });
  ls.seed('ct_week_v1', { days: { [MON]: { session: 'Strength A', slot: 'mon', done: false } } });
  const r = T.setDone(MON, true);
  ok(r.week === 1, 'the board’s own week is the fallback when the block cannot date it');
  ok(ls.read('ct_grind_v1').sessions['1|mon'] === true, 'and the tick still lands');
  ok(T.title('mon') === 'Strength A', 'the short label stands in for the programme’s title');
}

group('The rest day is one rule with one owner');
{
  /* WHAT SHIPPED BROKEN. The planner deals the block's SIX TRAINING
     sessions. The seventh thing in the programme — Sunday's recovery walk —
     was never in that deal, so the day the planner left clear came back
     with nothing on it: no title, nothing to tick, and the recovery session
     absent from the week. Reported as a Thursday that "isnt scheduled a
     block and therefore cannot be ticked as done".

     This lives here and not in either page because BOTH pages ask it: the
     board asks about the stored week, Week.html about the plan it has just
     computed. Two copies would disagree the first time those differed. */
  const { T } = load();
  const d = (iso, free, slot, planned) => {
    const x = { iso: iso, free: free, slot: slot || null };
    if (planned !== undefined) x.planned = planned;
    return x;
  };

  /* Least free wins: the rest day is the day your calendar took hardest. */
  ok(T.restDay([d('2026-09-07', 15, 'mon'), d('2026-09-08', 10, 'tue'),
                d('2026-09-09', 9.5, 'wed'), d('2026-09-10', 4.5, null),
                d('2026-09-11', 15, 'fri'), d('2026-09-12', 10.5, 'sat'),
                d('2026-09-13', 9, 'thu')]) === '2026-09-10',
     'the clear day is the rest day');

  /* Equal free hours: the earlier date, so the answer cannot move between
     two reads of the same week. */
  ok(T.restDay([d('2026-09-07', 1, null), d('2026-09-08', 1, null),
                d('2026-09-09', 1, null), d('2026-09-10', 1, null),
                d('2026-09-11', 15, 'mon'), d('2026-09-12', 10, 'tue'),
                d('2026-09-13', 9, 'wed')]) === '2026-09-07',
     'an equal-free tie goes to the earlier date');

  /* Four clear days are not four rest days. */
  const four = [d('2026-09-07', 1, null), d('2026-09-08', 2, null),
                d('2026-09-09', 3, null), d('2026-09-10', 4, null),
                d('2026-09-11', 15, 'mon'), d('2026-09-12', 10, 'tue'),
                d('2026-09-13', 9, 'wed')];
  ok(four.filter(x => x.iso === T.restDay(four)).length === 1,
     'only one day is ever named');

  /* A week that already has its recovery keeps it rather than gaining a
     second one. */
  ok(T.restDay([d('2026-09-07', 15, 'mon'), d('2026-09-08', 10, 'tue'),
                d('2026-09-09', 9.5, 'wed'), d('2026-09-10', 4.5, null),
                d('2026-09-11', 15, 'fri'), d('2026-09-12', 10.5, 'sat'),
                d('2026-09-13', 9, 'sun')]) === null,
     'a week whose Sunday kept its recovery gains no second rest day');

  /* A day the planner never saw falls back to the weekday grid, which gives
     it a session of its own — so it cannot be the rest day. */
  ok(T.restDay([d('2026-09-07', 15, 'mon'), d('2026-09-08', 0, null, false),
                d('2026-09-09', 5, null, true)]) === '2026-09-09',
     'a day the planner never saw is skipped, however little room it had');

  ok(T.restDay([]) === null && T.restDay(null) === null,
     'and nothing is named when there is no week');

  /* The slot it uses is the one every reader already knows. */
  ok(T.REST.slot === 'sun' && T.label(T.REST.slot) === 'Recovery',
     'the rest slot is the programme\u2019s own recovery slot');
}

console.log(failed ? '\n' + failed + ' FAILED' : '\nall green');
process.exit(failed ? 1 : 0);
