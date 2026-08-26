/* ─────────────────────────────────────────────────────────────────────────
   anatomy-core.test.js — the two closure-log rules that went wrong, pinned.

   Run it with `node tools/anatomy-core.test.js` from the repo root. It needs
   nothing installed: anatomy-data.js and anatomy-core.js are plain scripts,
   so they run in a vm context with a window and a localStorage stub, exactly
   as a page loads them.

   It covers the failures behind "the closure log is glitching out", and the
   shape the Today tab reads back out of them:

     1. A load where anatomy-data.js did not arrive — a request that failed,
        a 404 served mid-deploy, a partial offline cache — used to file every
        block record under `orphans` on the next write, permanently, so the
        open loops disappeared from the log and every block read as "not
        started" on every load afterwards.

     2. Re-entry used to depend on whether the day's tier had been declared:
        on the second day back the cap said no, and lifted the instant you
        pressed a tier button.

     3. What an open loop is, so the Phase 0 list can show all of them — a
        block opened today included, which used to be filtered out for having
        no gate to clear until tomorrow.

     4. Choosing today's block and finishing it are two separate writes: the
        picker used to stamp `studied` the moment you chose, so a session you
        sat down to but never finished left an open loop nothing could undo.

   These are the kind of thing that only shows up on a specific day with a
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

group('Blanks written over the parked history');

/* Asking status() about a block used to create a record for it. Anything that
   consulted status inside a write — "Draw one" does — persisted a blank for
   every block, so a store caught by the parking bug ends up holding a full set
   of blanks in `blocks` and its whole real history in `orphans`. */
const smothered = JSON.stringify({
  schema: 3, app: 'anatomy-closure', savedAt: '',
  meta: { repaired: 0, rollover: 5, mirrored: 1 }, days: {},
  blocks: Object.fromEntries(REF.allBlocks().map((b) => [b.id, block({})])),   // 61 blanks
  orphans: { nk2: block({ studied: ago(12) }),
             nk1: block({ studied: ago(20), inv: '85', topo: '90', gate: ago(20) }) },
});
const dug = load(true, smothered);
const ds = dug.A.read();
ok(dug.A.status(ds, 'nk2') === 'stale', 'a blank does not outrank the real record behind it');
ok(dug.A.status(ds, 'nk1') === 'closed', 'a closed block comes back closed, not "not started"');
ok(!Object.keys(JSON.parse(dug.store.ct_anatomy_v1).orphans).length, 'and the repair is written back');

const bothReal = JSON.stringify({
  schema: 3, app: 'anatomy-closure', meta: {}, days: {},
  blocks: { nk2: block({ studied: ago(2), inv: '90', topo: '90', gate: ago(2) }) },
  orphans: { nk2: block({ studied: ago(40) }) },
});
const clash = load(true, bothReal);
const cs = clash.A.read();
ok(clash.A.status(cs, 'nk2') === 'closed', 'a real live record is not displaced by a parked one');
ok(!!cs.orphans.nk2, 'and the parked one is kept rather than thrown away');

group('status() is a read, not a write');
const quiet = load(true);
const qs = quiet.A.blank();
qs.blocks.nk1 = block({ studied: ago(3) });
quiet.A.write(qs);
quiet.A.mut((st) => { quiet.A.allBlocks().forEach((b) => quiet.A.status(st, b.id)); });
ok(Object.keys(JSON.parse(quiet.store.ct_anatomy_v1).blocks).join() === 'nk1',
   'consulting every block inside a write leaves no blanks behind');

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

/* ── 4. what the Today tab lists as an open loop ── */
group('Every open loop, including the ones opened today');

const loops = load(true);
const ls = loops.A.blank();
ls.blocks.nk1 = block({ studied: TODAY });                                  // opened today
ls.blocks.nk2 = block({ studied: ago(4) });                                 // stale
ls.blocks.nk3 = block({ studied: ago(4), inv: '60', topo: '70' });          // repeat
ls.blocks.nk4 = block({ studied: ago(4), inv: '85', topo: '90', gate: ago(4) }); // closed
loops.A.write(ls);
const rec = loops.A.read();

ok(loops.A.status(rec, 'nk1') === 'open', 'a block studied today is open, not nothing');
ok(loops.A.openLoops(rec).map((b) => b.id).sort().join() === 'nk1,nk2,nk3',
   'open, stale and repeat are all open loops; closed is not');
ok(loops.A.openLoops(rec).every((b) => !!loops.A.blockRec(rec, b.id).studied),
   'every open loop carries a studied date — the Today list can show them all');
ok(loops.A.openLoops(rec).filter((b) => loops.A.blockRec(rec, b.id).studied === TODAY).length === 1,
   'and one of them is only waiting on tomorrow morning, not missing');

/* ── 5. the tripwire panel tells the truth at rest ── */
group('Tripwire lines on a log with almost nothing in it');

const fresh = load(true);
const fs5 = fresh.A.blank();
fs5.days[TODAY] = day({ tier: 'full', p0: false, minRead: 90, minDraw: 0 });
fresh.A.write(fs5);
const lines = fresh.A.tripwires(fresh.A.read());

ok(lines.every((x) => !/NaN|undefined|null/.test(x.text)),
   'no line prints NaN, undefined or null');
ok(!/above 5 \(0\)/.test(lines[0].text), 'does not claim open loops are above five when there are none');
ok(/no d45 retest scored yet/i.test(lines[3].text), 'says nothing has been scored rather than "pass rate 0%"');
ok(/says nothing yet/.test(lines[5].text), 'says cards per block is not measurable rather than NaN');
ok(!/^Past /.test(lines[6].text), 'does not say "Past <gate>" before the gate: ' + JSON.stringify(lines[6].text));
ok(lines.filter((x) => x.fired).length === 2,
   'and the two that genuinely fired still fire (nothing on paper, draw behind read)');

/* The wording turns, what fires does not. */
const breached = load(true);
const bs = breached.A.blank();
REF.allBlocks().slice(0, 7).forEach((b) => { bs.blocks[b.id] = block({ studied: ago(1) }); });
bs.days[TODAY] = day({ tier: 'full', p0: false, minRead: 100, minDraw: 10 });
bs.days[ago(1)] = day({ tier: 'full', p0: false, minRead: 10, minDraw: 0 });
breached.A.write(bs);
const hot = breached.A.tripwires(breached.A.read());
ok(hot[0].fired && /above 5 \(7\)/.test(hot[0].text), 'seven open loops still fires with the breach wording');
ok(hot[1].fired && /skipped 2 times/.test(hot[1].text), 'two skipped Phase 0s still fires');
ok(hot.every((x) => !/NaN|undefined/.test(x.text)), 'and nothing prints NaN there either');

/* ── 6. choosing today's block is not the same as finishing it ── */
group('Pick a block, then mark it studied');

const picked = load(true);
picked.A.write(picked.A.blank());

picked.A.setPick('nk1');
let ps6 = picked.A.read();
ok(ps6.days[TODAY].pick === 'nk1', 'the choice is recorded on the day, so it survives a reload');
ok(picked.A.status(ps6, 'nk1') === 'todo', 'choosing does not start the block');
ok(picked.A.openLoops(ps6).length === 0, 'and opens no loop');
ok(picked.A.pickOf(ps6).studied === false, 'the page can tell the work is not finished yet');

picked.A.setPick('nk2');
ps6 = picked.A.read();
ok(ps6.days[TODAY].pick === 'nk2' && picked.A.status(ps6, 'nk1') === 'todo',
   'changing your mind costs nothing — the first block is untouched');

picked.A.markStudied();
ps6 = picked.A.read();
ok(picked.A.status(ps6, 'nk2') === 'open', 'marking it studied is what opens the loop');
ok(ps6.blocks.nk2.studied === TODAY, 'and stamps today on the block record');
ok(picked.A.pickOf(ps6).studied === true, 'the panel reads back as finished for the day');

picked.A.unmarkStudied();
ps6 = picked.A.read();
ok(picked.A.status(ps6, 'nk2') === 'todo', 'a mis-press can be taken back the same day');
ok(ps6.days[TODAY].pick === 'nk2', 'and it is still the block you chose');

// Yesterday's work is history, not a slip: undo must not reach back into it.
const older = load(true);
const os6 = older.A.blank();
os6.blocks.nk3 = block({ studied: ago(2), inv: '85', topo: '90', gate: ago(2) });
os6.days[TODAY] = day({ tier: 'full', pick: 'nk3' });
older.A.write(os6);
older.A.unmarkStudied('nk3');
ok(older.A.read().blocks.nk3.studied === ago(2), 'a block studied on an earlier day is left alone');

console.log(failed ? '\n' + failed + ' failed\n' : '\nall green\n');
process.exit(failed ? 1 : 0);
