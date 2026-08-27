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

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
