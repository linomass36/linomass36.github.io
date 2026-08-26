/* ─────────────────────────────────────────────────────────────────────────
   day-boundary.test.js — the hub agrees on when a day starts.

   Run with `node tools/day-boundary.test.js` from the repo root. Nothing to
   install: day.js and the modules that use it are plain scripts, run here in
   a vm context with a window and a localStorage stub.

   The thing being pinned is that 02:00 belongs to the evening before, in
   every store rather than in one, and that the closure log's rollover setting
   is what moves it.
   ───────────────────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

function load(files, store) {
  const mem = Object.assign({}, store || {});
  const ctx = { window: {}, console, Date, JSON, Object, Array, Math, String, Number,
    parseFloat, isNaN, isFinite, RegExp, Error,
    localStorage: { getItem: (k) => (k in mem ? mem[k] : null),
                    setItem: (k, v) => { mem[k] = String(v); },
                    removeItem: (k) => { delete mem[k]; } },
    // Enough DOM for the modules that touch it on load; they are being checked
    // for parsing and for their day-key behaviour, not for their rendering.
    document: { addEventListener() {}, removeEventListener() {}, readyState: 'complete',
                createElement: () => ({ style: {}, classList: { add() {}, remove() {} },
                                        appendChild() {}, setAttribute() {}, addEventListener() {} }),
                querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
                getElementsByTagName: () => [], getElementsByClassName: () => [],
                body: { appendChild() {}, classList: { add() {}, remove() {} } },
                head: { appendChild() {} } },
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {} };
  ctx.globalThis = ctx; ctx.self = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return ctx;
}

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi).getTime();

group('The boundary itself');
{
  const D = load(['day.js']).window.CTDay;
  ok(D.rollover() === 5, 'defaults to 05:00');
  ok(D.key(at(2026, 8, 26, 23, 30)) === '2026-08-26', 'half past eleven is that evening');
  ok(D.key(at(2026, 8, 27, 0, 15)) === '2026-08-26', 'quarter past midnight is still that evening');
  ok(D.key(at(2026, 8, 27, 2, 0)) === '2026-08-26', 'two in the morning is still that evening');
  ok(D.key(at(2026, 8, 27, 4, 59)) === '2026-08-26', 'one minute to five is still that evening');
  ok(D.key(at(2026, 8, 27, 5, 0)) === '2026-08-27', 'five sharp is the new day');
  ok(D.shift('2026-08-26', 1) === '2026-08-27', 'shift walks day keys');
  ok(D.between('2026-08-26', '2026-08-29') === 3, 'between counts days');
  ok(D.key(NaN) === '', 'a bad timestamp gives nothing, not a crash');
}

group('The closure log setting moves it');
{
  const withRoll = (h) => JSON.stringify({ schema: 3, app: 'anatomy-closure',
    meta: { repaired: 0, rollover: h }, blocks: {}, days: {}, orphans: {} });
  const D3 = load(['day.js'], { ct_anatomy_v1: withRoll(3) }).window.CTDay;
  ok(D3.rollover() === 3, 'a rollover of 3 is read from ct_anatomy_v1');
  ok(D3.key(at(2026, 8, 27, 2, 0)) === '2026-08-26', 'at 3, two in the morning is still yesterday');
  ok(D3.key(at(2026, 8, 27, 4, 0)) === '2026-08-27', 'and four in the morning is not');
  const D0 = load(['day.js'], { ct_anatomy_v1: withRoll(0) }).window.CTDay;
  ok(D0.rollover() === 0, 'a rollover of 0 is honoured, not treated as unset');
  ok(D0.key(at(2026, 8, 27, 0, 15)) === '2026-08-27', 'and midnight is the boundary again');
  const bad = load(['day.js'], { ct_anatomy_v1: '{not json' }).window.CTDay;
  ok(bad.rollover() === 5, 'an unreadable store falls back to 5');
}

group('The closure log and the shared boundary agree');
{
  const c = load(['day.js', 'anatomy-data.js', 'anatomy-core.js']);
  const A = c.window.AnatomyCore, D = c.window.CTDay;
  ok(A.today(A.blank()) === D.today(), 'AnatomyCore.today() matches CTDay.today()');
  ok(A.rollover(A.blank()) === D.rollover(), 'and so does the rollover it uses');
}

group('The modules use it, and survive without it');
{
  const c = load(['day.js', 'health-data.js']);
  const H = c.window.HealthData || c.window.HEALTH || null;
  const D = c.window.CTDay;
  ok(!!D, 'day.js loaded alongside health-data.js');
  // health-data keys a 02:00 reading to the evening before
  const noDay = load(['health-data.js']);          // no day.js at all
  ok(!noDay.window.CTDay, 'health-data.js loads with no day.js present');
}

group('Every module still parses with and without day.js');
{
  /* capture.js is not in this list: it binds to real elements the moment it
     loads, so a stub DOM proves nothing about it. It is exercised where it
     actually runs, by .github/tests/crash.js in a browser. */
  for (const f of ['systems.js', 'resurface.js', 'conditions.js',
                   'health-data.js', 'money.js', 'plan-v2.js']) {
    let threw = null;
    try { load([f]); } catch (e) { threw = e; }
    ok(!threw, f + ' loads standalone' + (threw ? ': ' + threw.message : ''));
  }
}

console.log(failed ? '\n' + failed + ' failed\n' : '\nall green\n');
process.exit(failed ? 1 : 0);
