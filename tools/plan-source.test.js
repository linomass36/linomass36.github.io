/* ─────────────────────────────────────────────────────────────
   plan-source.test.js — the daily surfaces read the plan that is current.

   Run with `node tools/plan-source.test.js` from the repo root. Also run by
   the deploy.

   plan-v2-data.js opens by saying it supersedes the v1 content in
   hub-data.js and that "nothing reads it as current any more". That was
   false for the three pages you actually open every day:

     Standing.html        "Do these next"   <- HUB_DATA, v1's 371 items
     Today.dc.html        next steps        <- HUB_DATA, one per v1 branch
     Weekly Review.dc.html wins + loops     <- HUB_DATA + v1's store
     systems.js           the board's first tile, sort 0, top of the page:
                          linked to Plan.html and reported v1's percentage

   Two plans, two stores ('ct-master-plan-v2' is v1's, despite the name;
   'plan_v2_state_v1' is v2's), and no connection between them — so a move
   closed on the Plan page never appeared as a win in the Sunday review, and
   the Standing spent every morning naming work the recalibration abandoned.

   Nothing could catch this: both files were valid, every link was correct,
   and the wrong number is a plausible number. So the check is structural —
   the surfaces that answer "what do I do next" must read PlanV2 and must
   not read HUB_DATA.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ── the reader itself ─────────────────────────────────────────────────── */
function planv2(done, todayIso) {
  const store = { plan_v2_state_v1: JSON.stringify({ done: done || {} }) };
  const ctx = {
    console, JSON, Object, Array, String, RegExp, Date, Math, isNaN,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; }
    },
    document: { createElement: () => ({}) }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  if (todayIso) ctx.CTDay = { today: () => todayIso };
  vm.createContext(ctx);
  vm.runInContext(read('plan-v2-data.js'), ctx, { filename: 'plan-v2-data.js' });
  vm.runInContext(read('plan-v2.js'), ctx, { filename: 'plan-v2.js' });
  return ctx.PlanV2;
}

group('The next moves come off the live phase');

const V = planv2({}, '2026-08-27');
const live = V.livePhase();
ok(live && live.id === 'p0', 'on 27 Aug 2026 the live phase is Phase 0, ' + (live && live.label));

const moves = V.moves(6);
ok(moves.length > 0, 'there are open moves to show (' + moves.length + ')');
ok(moves.every(m => m.phaseId === 'p0'),
   'every move belongs to the live phase, not a queued one');
ok(moves[0].due === '2026-09-07',
   'the dated one leads: ' + moves[0].label + ' (' + moves[0].due + ')');
ok(moves.slice(1).every(m => !m.due || m.due >= moves[0].due),
   'and the rest follow by deadline, undated last');

group('A move that is closed stops being next');

const allOpen = V.moves();
const first = moves[0].id;
const after = planv2({ [first]: '2026-08-27' }, '2026-08-27').moves();
ok(!after.some(m => m.id === first), 'a closed move drops out of the list');
ok(after.length === allOpen.length - 1, 'and only that one drops out');

group('The count is of the live phase, not the whole file');

const c = planv2({}, '2026-08-27').counts();
ok(c.live === V.phaseItems(live).length,
   'the denominator is the live phase (' + c.live + ' items), not every item ever');
ok(c.live > 0 && c.live < 100,
   'which is a number that can actually move, unlike v1\'s 371');
ok(c.pct === 0, 'nothing closed reads as 0%');
const c2 = planv2({ [first]: '2026-08-27' }, '2026-08-27').counts();
ok(c2.liveDone === 1 && c2.pct === Math.round(1 / c.live * 100),
   'closing one move moves the percentage (' + c2.pct + '%)');

group('The Sunday review sees the week it is reviewing');

const wins = planv2({ [first]: '2026-08-25' }, '2026-08-27').winsSince(7);
ok(wins.length === 1 && wins[0].id === first, 'a move closed two days ago is a win');
ok(wins[0].label === moves[0].label, 'and it is named, not shown as a bare id');
const old = planv2({ [first]: '2026-08-01' }, '2026-08-27').winsSince(7);
ok(old.length === 0, 'a move closed four weeks ago is not this week\'s win');

/* This group used to be a time bomb, and it went off. winsSince called
   daysBetween without a `from`, so it measured against the REAL clock while
   this file injected 2026-08-27 as today — it passed for one week after it
   was written and failed every day after. It was found eight days on, red,
   with the deploy running it, which would have blocked publishing the site.

   The window is a count of whole days between two DAYS now, both ends
   anchored at midnight and the near end being today() — so it neither drifts
   with the hour asked nor ignores the 05:00 boundary day.js owns. */
group('The review window is a count of days, not a reading of the clock');

const edge = planv2({ [first]: '2026-08-20' }, '2026-08-27').winsSince(7);
ok(edge.length === 1, 'a move closed exactly seven days before the day under review counts');
const past = planv2({ [first]: '2026-08-19' }, '2026-08-27').winsSince(7);
ok(past.length === 0, 'and eight days before it does not');
ok(planv2({ [first]: '2026-08-25' }, '2026-08-27').winsSince(7)[0].ago === 2,
   'the distance is measured from the day under review, not from today\'s date');

/* ── and the surfaces are wired to it ──────────────────────────────────── */
group('The daily surfaces read the current plan');

const DAILY = ['Standing.html', 'Today.dc.html', 'Weekly Review.dc.html'];
DAILY.forEach(f => {
  const src = read(f);
  ok(/plan-v2-data\.js/.test(src) && /plan-v2\.js/.test(src),
     f + ' loads the v2 plan');
  /* Comments may name it; code may not read it. */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(!/\bHUB_DATA\b/.test(code), f + ' does not read v1 HUB_DATA');
  ok(!/['"]ct-master-plan-v2['"]/.test(code), f + " does not write v1's store");
});

const sys = read('systems.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(!/\bHUB_DATA\b/.test(sys), 'systems.js counts the plan off PlanV2');
ok(!/['"]ct-master-plan-v2['"]/.test(sys), "systems.js does not read v1's store");

console.log(failed ? '\n' + failed + ' FAILED' : '\nall green');
process.exit(failed ? 1 : 0);
