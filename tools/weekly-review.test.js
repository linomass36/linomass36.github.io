/* ─────────────────────────────────────────────────────────────
   weekly-review.test.js — the ritual's three weeks, and the key both
   sides of it agree on.

   Run with `node tools/weekly-review.test.js` from the repo root.

   Three bugs lived here, and they compounded:

     1. The board asked `reviews[monday()]` where monday() was the Monday of
        the CURRENT week. At 00:05 on Monday the key flipped, so a review done
        on Sunday stopped counting and every surface read DUE for a week that
        had not happened yet.

     2. monday() built that key through isoDay(), which routes through the
        hub's 05:00 day boundary — so midnight on Monday came back as the
        Sunday before it. The Weekly Review page keys its store off the plain
        calendar Monday. The two never matched, which means the board could
        not show a completed review at all, whatever week it looked at. This
        one only appears when day.js is loaded, which is every real page and
        no unit test that forgot it.

     3. Next week's three priorities were written under wkKey(now + 7d) and
        READ under the same expression, so from Monday the page looked one
        week further ahead and found nothing. The list you were meant to be
        working from was on disk and never shown again.

   The fix is that a week key is a label for a week rather than a stamp on a
   moment, and that the ritual names three of them: the week being reviewed,
   the week being worked, and the week being planned.

   A fourth bug lived one section further down, and it took the whole page
   with it. The v2 recalibration moved wins and loops off the v1 master plan
   and deleted the read that gave them `history` and `itemById` — but the
   stale check below still used both. `history` is a global in a browser, so
   this was not a ReferenceError anyone would spot in review: it resolved to
   window.history, `.forEach` was undefined, and renderVals threw. A throw
   there is invisible from the outside — the component falls back to its
   empty defaults and the page still looks like a page, with nothing in it.

   So the last group here lifts the logic class straight out of the page and
   calls renderVals() for real, which is the only assertion that can catch a
   name that no longer exists.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

function load(files, store, now) {
  const mem = Object.assign({}, store || {});
  const RealDate = Date;
  const D = now ? class extends RealDate {
    constructor(...a) { return a.length ? new RealDate(...a) : new RealDate(now); }
    static now() { return now; }
  } : Date;
  const ctx = { window: {}, console, Date: D, JSON, Object, Array, Math, String, Number,
    parseFloat, parseInt, isNaN, isFinite, RegExp, Error,
    localStorage: { getItem: (k) => (k in mem ? mem[k] : null),
                    setItem: (k, v) => { mem[k] = String(v); },
                    removeItem: (k) => { delete mem[k]; } } };
  ctx.globalThis = ctx; ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  ctx.__mem = mem;
  return ctx;
}

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);

/* The page's own key, copied from Weekly Review.dc.html's wkKey/mondayOf, so
   the test compares the two implementations rather than trusting one. */
function pageWeekKey(at, offsetWeeks) {
  const x = new Date(at);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7) + (offsetWeeks || 0) * 7);
  x.setHours(0, 0, 0, 0);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' +
         String(x.getDate()).padStart(2, '0');
}

const THU = new Date(2026, 7, 27, 9, 0).getTime();   // Thursday 27 Aug 2026
const SUN = new Date(2026, 7, 30, 20, 0).getTime();  // the Sunday that closes that week
const MON = new Date(2026, 7, 31, 0, 5).getTime();   // five past midnight, the next week

group('The week key survives the 05:00 day boundary');
{
  /* day.js is what makes this fail: without it isoDay falls back to the plain
     calendar date and the bug is invisible. Every real page loads it. */
  const S = load(['day.js', 'systems.js'], {}, THU).window.Systems;
  ok(S.monday(0) === pageWeekKey(THU, 0),
     'systems and the page agree on this week (' + S.monday(0) + ')');
  ok(S.monday(-1) === pageWeekKey(THU, -1),
     'and on last week (' + S.monday(-1) + ')');
  ok(/^\d{4}-\d{2}-\d{2}$/.test(S.monday(0)), 'it is a day key');
  const d = new Date(S.monday(0) + 'T12:00:00');
  ok(d.getDay() === 1, 'and it lands on a Monday, not the Sunday before it');
}

group('A review is owed for the week that ended');
{
  const thu = load(['day.js', 'systems.js'], {}, THU).window.Systems;
  ok(thu.reviewWeek() === thu.monday(-1), 'on a Thursday, the week under review is last week');
  ok(thu.workWeek() === thu.monday(0), 'and the week being worked is this one');
  const sun = load(['day.js', 'systems.js'], {}, SUN).window.Systems;
  ok(sun.reviewWeek() === sun.monday(0), 'on a Sunday it is the week closing today');
}

group('Sunday\'s review still counts on Wednesday');
{
  /* Do the review on Sunday, then look at the board on Monday morning. */
  const sunCtx = load(['day.js', 'systems.js'], {}, SUN);
  const wk = sunCtx.window.Systems.reviewWeek();
  const store = { ct_weekly_v1: JSON.stringify({ reviews: { [wk]: SUN }, priorities: {}, prioDone: {}, steps: {}, answers: {} }) };

  const sunTile = load(['day.js', 'systems.js'], store, SUN).window.Systems.all().find((s) => s.id === 'weekly');
  ok(sunTile.big === '✓', 'the Sunday it was done, the tile reads done');

  const monTile = load(['day.js', 'systems.js'], store, MON).window.Systems.all().find((s) => s.id === 'weekly');
  ok(monTile.big === '✓', 'five past midnight on Monday it STILL reads done');
  ok(monTile.tone === 'ok', 'and is not owed');
  ok(/last week/.test(monTile.unit), 'and says which week it is talking about (' + monTile.unit + ')');
}

group('An unreviewed week is owed, and names itself');
{
  const S = load(['day.js', 'systems.js'], { ct_weekly_v1: JSON.stringify({ reviews: {} }) }, THU).window.Systems;
  const t = S.all().find((s) => s.id === 'weekly');
  ok(t.big === 'DUE', 'an unreviewed week is DUE');
  ok(t.tone === 'go', 'and wants you');
  ok(/week of/.test(t.line), 'and the line names the week (' + t.line + ')');
}

group('The board no longer opens archived pages');
{
  const S = load(['day.js', 'systems.js'], {}, THU).window.Systems;
  const bad = S.all().filter((s) => /CT Master Plan\.html|Research Plan\.dc\.html|Summer Sprint|Plan Analysis|Timeline\.dc/.test(s.href));
  ok(bad.length === 0, 'no system tile points at a v1 document' +
     (bad.length ? ' — ' + bad.map((b) => b.id + '→' + b.href).join(', ') : ''));
  const plan = S.all().find((s) => s.id === 'plan');
  ok(plan && plan.href === 'Plan.html', 'the first tile opens the live plan');
}

/* ── the page's own logic class, run for real ─────────────────────────
   The DC runtime gives the class a base with state and setState on it and
   nothing else this page touches: it reads no DOM and takes no props. So a
   five-line stub is the whole harness, and what runs is the shipped file. */
function page(store, now) {
  const ctx = load(['day.js', 'systems.js', 'plan-v2-data.js', 'plan-v2.js',
                    'anatomy-data.js', 'anatomy-core.js'], store, now);
  const html = fs.readFileSync(path.join(ROOT, 'Weekly Review.dc.html'), 'utf8');
  const m = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no logic class found in Weekly Review.dc.html');
  vm.runInContext('class DCLogic { constructor() { this.state = {}; } ' +
                  'setState(u) { Object.assign(this.state, typeof u === "function" ? u(this.state) : u); } }',
                  ctx, { filename: 'DCLogic stub' });
  vm.runInContext(m[1] + '\nglobalThis.__Component = Component;', ctx,
                  { filename: 'Weekly Review.dc.html' });
  return vm.runInContext('new __Component()', ctx);
}

group('renderVals() survives an empty store');
{
  let vals = null, threw = null;
  try { vals = page({}, SUN).renderVals(); } catch (e) { threw = e; }
  ok(!threw, 'the page renders on a device with nothing saved' + (threw ? ' — ' + threw.message : ''));
  ok(!!vals && Object.keys(vals).length > 50, 'and returns a full set of values, not the empty fallback');
  ok(!!vals && Array.isArray(vals.staleRows), 'including the stale check that used to throw');
}

group('The stale check reads the live pages, not the archived plan');
{
  const S = load(['sitemap.js'], {}, SUN).window.SITEMAP;
  const rows = page({}, SUN).renderVals().staleRows;
  const bad = rows.filter((r) => S.isArchived(r.href));
  ok(bad.length === 0, 'no stale row sends you into a v1 document' +
     (bad.length ? ' — ' + bad.map((b) => b.label + '→' + b.href).join(', ') : ''));
  const unknown = rows.filter((r) => !S.get(r.href));
  ok(unknown.length === 0, 'every stale row points at a declared page' +
     (unknown.length ? ' — ' + unknown.map((b) => b.label + '→' + b.href).join(', ') : ''));

  const labels = rows.map((r) => r.label);
  ok(labels.indexOf('Finances') >= 0 && labels.indexOf('Risk register') >= 0,
     'an untouched hub flags both standing branches');
}

group('Recording the thing clears its row');
{
  /* August 2026 is the month SUN falls in, so a snapshot taken in it is
     current; the verification was settled five days before. */
  const store = {
    ct_vault_v1: JSON.stringify({ snaps: [{ m: '2026-08', cash: 1000, inv: 0, debt: 0 }] }),
    plan_v2_state_v1: JSON.stringify({ verify: { 1: { result: 'confirmed', at: '2026-08-25' } } })
  };
  const rows = page(store, SUN).renderVals().staleRows;
  const labels = rows.map((r) => r.label);
  ok(labels.indexOf('Finances') < 0, 'this month’s Vault snapshot clears Finances');
  ok(labels.indexOf('Risk register') < 0, 'a recently settled assumption clears the risk register');

  /* One month behind is a snapshot you are still in time to take; two is a
     month that went unrecorded. */
  const july = page({ ct_vault_v1: JSON.stringify({ snaps: [{ m: '2026-07' }] }) }, SUN)
    .renderVals().staleRows.map((r) => r.label);
  ok(july.indexOf('Finances') < 0, 'last month’s snapshot is not yet late');
  const june = page({ ct_vault_v1: JSON.stringify({ snaps: [{ m: '2026-06' }] }) }, SUN)
    .renderVals().staleRows.find((r) => r.label === 'Finances');
  ok(!!june && june.age === '2 mo', 'a month with no snapshot at all is flagged (' +
     (june ? june.age : 'not flagged') + ')');

  const old = page({ plan_v2_state_v1: JSON.stringify({ verify: { 1: { result: 'confirmed', at: '2026-06-01' } } }) }, SUN)
    .renderVals().staleRows.find((r) => r.label === 'Risk register');
  ok(!!old && /^9[01]d$/.test(old.age), 'and an assumption settled three months ago is stale again (' +
     (old ? old.age : 'not flagged') + ')');
}

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
