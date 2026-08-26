/* ─────────────────────────────────────────────────────────────────────────
   anatomy-core.test.js — the two closure-log rules that went wrong, pinned.

   Run it with `node tools/anatomy-core.test.js` from the repo root. It needs
   nothing installed: anatomy-data.js and anatomy-core.js are plain scripts,
   so they run in a vm context with a window and a localStorage stub, exactly
   as a page loads them.

   It covers the two failures behind "the closure log is glitching out":

     1. A load where anatomy-data.js did not arrive — a request that failed,
        a 404 served mid-deploy, a partial offline cache — used to file every
        block record under `orphans` on the next write, permanently, so the
        open loops disappeared from the log and every block read as "not
        started" on every load afterwards.

     2. Re-entry used to depend on whether the day's tier had been declared:
        on the second day back the cap said no, and lifted the instant you
        pressed a tier button.

   Both are the kind of thing that only shows up on a specific day with a
   specific history, which is why they are tests rather than a careful read.
   ───────────────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

// One page load: a fresh window, a fresh localStorage, the scripts in order.
function load(withSyllabus, seed) {
  const store = {};
  if (seed) store.ct_anatomy_v1 = seed;
  const ctx = {
    window: {},
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    console, Date, JSON, Object, Array, Math, String, Number, parseFloat, isNaN,
  };
  vm.createContext(ctx);
  const files = withSyllabus ? ['anatomy-data.js', 'anatomy-core.js'] : ['anatomy-core.js'];
  files.forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
  return { A: ctx.window.AnatomyCore, store };
}

/* Days are counted back from the store's own study day, not from the calendar
   one: the 05:00 rollover puts them a day apart every night. */
const REF = load(true).A;
const TODAY = REF.today(REF.blank());
const ago = (n) => REF.addDays(TODAY, -n);

let failed = 0;
function ok(cond, what) {
  console.log((cond ? '  pass  ' : '  FAIL  ') + what);
  if (!cond) failed++;
}
function group(name) { console.log('\n' + name); }

function block(over) { return Object.assign({}, REF.BLOCK_DEF, { reps: [] }, over); }
function day(over) { return Object.assign({}, REF.DAY_DEF, over); }

/* ── 1. a load without the syllabus must not flatten the log ── */
group('A load with anatomy-data.js missing');

const seeded = load(true);
const s = seeded.A.blank();
s.blocks.nk2 = block({ studied: ago(12) });                                  // studied, never scored — stale
s.blocks.nk1 = block({ studied: ago(20), inv: '85', topo: '90', gate: ago(20),
                       reps: [{ date: ago(20), inv: '85', topo: '90' }] });   // closed
s.days[ago(12)] = day({ tier: 'full', p0: true, minRead: 40, minDraw: 40 });
seeded.A.write(s);

const blind = load(false, seeded.store.ct_anatomy_v1);
blind.A.setTier('core');                       // one ordinary write from that load
const written = JSON.parse(blind.store.ct_anatomy_v1);
ok(Object.keys(written.blocks).sort().join() === 'nk1,nk2', 'leaves the block records where they are');
ok(Object.keys(written.orphans).length === 0, 'parks nothing — there is nothing to check against');
ok(written.days[TODAY] && written.days[TODAY].tier === 'core', 'still records the day itself');

const reopened = load(true, blind.store.ct_anatomy_v1);
const rs = reopened.A.read();
ok(reopened.A.status(rs, 'nk2') === 'stale', 'the stale loop is stale again on the next healthy load');
ok(reopened.A.openLoops(rs).map((b) => b.id).join() === 'nk2', 'and is back among the open loops');

/* ── 2. a store the old bug already flattened repairs itself ── */
group('A store already flattened by the old bug');

const wrecked = JSON.stringify({
  schema: 3, app: 'anatomy-closure', savedAt: '',
  meta: { repaired: 0, rollover: 5, mirrored: 1 },
  blocks: {}, days: { [ago(12)]: day({ tier: 'full', p0: true }) },
  orphans: { nk2: block({ studied: ago(12) }) },
});
const repaired = load(true, wrecked);
const ps = repaired.A.read();
ok(!!ps.blocks.nk2 && !Object.keys(ps.orphans).length, 'the parked record comes home');
ok(repaired.A.status(ps, 'nk2') === 'stale', 'and reads as the stale loop it always was');
ok(/returned to its block/.test(repaired.A.migrationNote()), 'the Data panel says what happened');
ok(!Object.keys(JSON.parse(repaired.store.ct_anatomy_v1).orphans).length,
   'and the repair is written back, not redone on every load');

group('An id that really is not in this build');
const ghost = load(true, JSON.stringify({ schema: 3, app: 'anatomy-closure', meta: {}, days: {}, orphans: {},
                                          blocks: { zz9: block({ studied: ago(5) }) } }));
const gs = ghost.A.read();
ok(!gs.blocks.zz9 && !!gs.orphans.zz9, 'is still kept aside rather than dropped');

/* ── 3. re-entry does not hang on the tier button ── */
group('Re-entry after a nine-day break');

// Three days run, then the break, then whichever days back are given.
function history(daysBack) {
  const m = load(true);
  const x = m.A.blank();
  [12, 11, 10].concat(daysBack).forEach((n) => { x.days[ago(n)] = day({ tier: 'full' }); });
  m.A.write(x);
  return m;
}
const stillAway = history([]);
const away = stillAway.A.reentryInfo(stillAway.A.read());
ok(away.on === true && away.gap === 10, 'still away: capped, and the gap is the days away (' + away.gap + ')');

const first = history([]);
ok(first.A.reentryInfo(first.A.read()).on === true, 'first day back, before declaring: capped');
first.A.setTier('core');
ok(first.A.reentryInfo(first.A.read()).on === true, 'first day back, after declaring: still capped');

const second = history([1]);
ok(second.A.reentryInfo(second.A.read()).on === false, 'second day back, before declaring: lifted');
second.A.setTier('core');
ok(second.A.reentryInfo(second.A.read()).on === false, 'second day back, after declaring: still lifted');

const steady = load(true);
const sd = steady.A.blank();
for (let n = 0; n < 10; n++) sd.days[ago(n)] = day({ tier: 'full' });
steady.A.write(sd);
ok(steady.A.reentryInfo(steady.A.read()).on === false, 'ten days straight: no re-entry at all');

console.log(failed ? '\n' + failed + ' failed\n' : '\nall green\n');
process.exit(failed ? 1 : 0);
