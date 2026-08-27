/* ─────────────────────────────────────────────────────────────
   feeds.test.js — a newer reading wins, but does not delete what it
   does not carry.

   Run with `node tools/feeds.test.js` from the repo root.

   The bug this pins destroyed data silently and looked like the feature
   had never worked. `anki_sync.py --backfill` sends a year of daily rows,
   because the Mac's revlog is the only place that history exists. A ROUTINE
   sync sends a snapshot and no history at all — and apply() replaced the
   whole stored object with it. Thirty minutes after backfilling, the launchd
   job ran and the year was gone.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

function load(store) {
  const mem = Object.assign({}, store || {});
  const ctx = { window: {}, console, JSON, Object, Array, Date, String, Number, isNaN,
    localStorage: { getItem: (k) => (k in mem ? mem[k] : null),
                    setItem: (k, v) => { mem[k] = String(v); },
                    removeItem: (k) => { delete mem[k]; } },
    setTimeout: () => 0, clearTimeout: () => {} };
  ctx.globalThis = ctx; ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'feeds.js'), 'utf8'), ctx, { filename: 'feeds.js' });
  ctx.__mem = mem;
  return ctx;
}

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const read = (ctx) => JSON.parse(ctx.__mem.ct_anki_v1 || '{}');

const YEAR = { from: '2025-08-27', days: 365, reps: new Array(365).fill(100) };

group('A routine sync does not delete the backfill');
{
  const ctx = load();
  ctx.window.Feeds.apply({ anki: { repsToday: 40, dueTotal: 186, at: '2026-08-27T10:00:00Z', history: YEAR } });
  ok(read(ctx).history.days === 365, 'the backfill lands');

  ctx.window.Feeds.apply({ anki: { repsToday: 44, dueTotal: 180, at: '2026-08-27T10:30:00Z' } });
  const after = read(ctx);
  ok(after.history && after.history.days === 365, 'and survives the next routine sync');
  ok(after.repsToday === 44 && after.dueTotal === 180, 'while the reading itself is updated');
}

group('A newer history replaces an older one');
{
  const ctx = load();
  ctx.window.Feeds.apply({ anki: { at: '2026-08-27T10:00:00Z', history: YEAR } });
  ctx.window.Feeds.apply({ anki: { at: '2026-08-27T11:00:00Z',
    history: { from: '2025-09-01', days: 366, reps: new Array(366).fill(1) } } });
  ok(read(ctx).history.days === 366, 'a second backfill wins, rather than being merged into the first');
}

group('Newer-wins still holds');
{
  const ctx = load();
  ctx.window.Feeds.apply({ anki: { repsToday: 50, at: '2026-08-27T11:00:00Z' } });
  ctx.window.Feeds.apply({ anki: { repsToday: 9, at: '2020-01-01T00:00:00Z' } });
  ok(read(ctx).repsToday === 50, 'an older reading is ignored');
  const ctx2 = load();
  const changed = ctx2.window.Feeds.apply({ anki: { repsToday: 1, at: '2026-01-01T00:00:00Z' } });
  ok(changed.indexOf('anki') >= 0, 'and a newer one reports that it changed something');
}

group('The incoming object is not mutated');
{
  const ctx = load();
  ctx.window.Feeds.apply({ anki: { at: '2026-08-27T10:00:00Z', history: YEAR } });
  const incoming = { repsToday: 44, at: '2026-08-27T10:30:00Z' };
  ctx.window.Feeds.apply({ anki: incoming });
  ok(incoming.history === undefined, 'the caller\'s payload is left as it was');
}

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
