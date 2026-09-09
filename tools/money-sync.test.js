/* ─────────────────────────────────────────────────────────────
   money-sync.test.js — every page answers "what is net worth" the same way.

   Run with `node tools/money-sync.test.js` from the repo root. Also run by
   the deploy.

   THE BUG, as reported: "the debt page doesn't sync with the networth page."
   It did not, and neither did anything else. Four places answered the same
   question, and three of them never read the store:

     Vault.dc.html    the real snapshots, formatted with a design-canvas prop
     systems.js       its own reader and its own conversion, inline
     Money.html #debt a hardcoded −250 under the words "Net worth today",
                      frozen on the day the plan was recalibrated
     plan-v2-data.js  the same −250 again, in the ground-truth table

   So the Debt panel and the Net worth panel of the SAME PAGE disagreed, and
   the front page could disagree with both. Worse, the Vault wrote snapshots
   with no currency at all while every other reader assumed the base — so a
   złoty balance entered on that page was read back as dollars everywhere
   else, which is the exact failure money.js was written to end and which it
   had only half-fixed.

   Money.position() is the one reader now. These checks are about the wiring
   rather than the arithmetic: that the store is read at all, that a currency
   survives the round trip, and that nothing silently guesses.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* money.js in a page-like context, with whatever is already in storage. */
function money(store) {
  const s = Object.assign({}, store);
  const ctx = {
    console, JSON, Object, Array, String, Number, Math, Date, isFinite, isNaN, parseFloat,
    localStorage: {
      getItem: (k) => (k in s ? s[k] : null),
      setItem: (k, v) => { s[k] = String(v); },
      removeItem: (k) => { delete s[k]; }
    }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('money.js'), ctx, { filename: 'money.js' });
  return ctx.Money;
}

const vaultOf = (snaps, extra) =>
  ({ ct_vault_v1: JSON.stringify(Object.assign({ snaps }, extra || {})) });
const ratesOf = (base, rates, at) =>
  ({ ct_rates_v1: JSON.stringify({ base, rates, at: at || '2026-09-01' }) });

/* ── 1. the reader exists and reads the Vault's own store ──────────────── */
group('Money.position() reads the store the Vault writes');

const M0 = money({});
ok(typeof M0.position === 'function', 'Money.position() is exported');
ok(M0.VAULT_KEY === 'ct_vault_v1', 'and points at the key Vault.dc.html writes (' + M0.VAULT_KEY + ')');

const empty = M0.position();
ok(empty.net === null, 'with no snapshot the answer is null, not 0');
ok(empty.count === 0 && empty.asOf === null, 'and it says so rather than inventing a date');

const M1 = money(vaultOf([
  { m: '2026-07', ccy: 'USD', cash: 500, inv: 0, debt: 100 },
  { m: '2026-09', ccy: 'USD', cash: 2000, inv: 300, debt: 250 }
]));
const p1 = M1.position('USD');
ok(p1.net === 2050, 'the newest snapshot is the answer: 2000 + 300 − 250 = ' + p1.net);
ok(p1.asOf === '2026-09', 'dated by the month it was taken');
ok(p1.count === 2, 'and it says how many are on the ledger');

/* Order in the file must not decide which one is newest. */
const M2 = money(vaultOf([
  { m: '2026-09', ccy: 'USD', cash: 2000, inv: 0, debt: 0 },
  { m: '2026-07', ccy: 'USD', cash: 500, inv: 0, debt: 0 }
]));
ok(M2.position('USD').net === 2000, 'snapshots are sorted by month, not by insertion order');

/* The older spelling systems.js used to tolerate on its own. */
const M3 = money({ ct_vault_v1: JSON.stringify({ snapshots: [{ m: '2026-09', ccy: 'USD', cash: 42, inv: 0, debt: 0 }] }) });
ok(M3.position('USD').net === 42, 'the legacy `snapshots` spelling still reads');

/* ── 2. currency survives the round trip ───────────────────────────────── */
group('A złoty snapshot is not read back as dollars');

const store = Object.assign(
  vaultOf([{ m: '2026-09', ccy: 'PLN', cash: 4000, inv: 0, debt: 0 }]),
  ratesOf('USD', { PLN: 4 })
);
const M4 = money(store);

const inPln = M4.position('PLN');
ok(inPln.net === 4000, 'read in PLN it is 4 000 zł');
ok(inPln.ccy === 'PLN' && !inPln.assumed, 'and the currency is declared, not assumed');

const inUsd = M4.position('USD');
ok(inUsd.net === 1000, 'read in USD it is $1 000 at 4 zł/$ — not 4 000');
ok(M4.fmt(inPln.net, 'PLN') !== M4.fmt(inUsd.net, 'USD'), 'the two formats do not collide');

/* ── 3. an old currency-less snapshot is flagged, not guessed ──────────── */
group('A snapshot written before the currency field says so');

const M5 = money(vaultOf([{ m: '2026-09', cash: 4000, inv: 0, debt: 0 }], { assume: 'PLN' }));
const p5 = M5.position('PLN');
ok(p5.net === 4000, 'it is read as the store\'s recorded assumption');
ok(p5.assumed === true, 'and marked assumed, so a page can caveat it');

const M6 = money(vaultOf([{ m: '2026-09', ccy: 'PLN', cash: 4000, inv: 0, debt: 0 }]));
ok(M6.position('PLN').assumed === false, 'a declared currency is not marked assumed');

/* ── 4. a missing rate is refused, never guessed at 1:1 ────────────────── */
group('No rate means no number');

const M7 = money(vaultOf([{ m: '2026-09', ccy: 'PLN', cash: 4000, inv: 0, debt: 0 }]));
const p7 = M7.position('USD');       // no PLN rate set
ok(p7.net === null, 'converting without a rate returns null rather than 4 000');
ok(p7.complete === false && p7.missing.indexOf('PLN') >= 0,
   'and names the currency it could not count');

/* ── 5. age, so a stale figure cannot pass for today ───────────────────── */
group('The figure carries its age');

const M8 = money(vaultOf([{ m: '2026-03', ccy: 'USD', cash: 1, inv: 0, debt: 0 }]));
ok(M8.positionAge('2026-09-09') === 6, 'six months between March and September');
ok(money({}).positionAge('2026-09-09') === null, 'and no snapshot has no age');

/* ── 6. the pages are actually wired to it ─────────────────────────────── */
group('The three readers go through the one reader');

const debtPanel = read('Money.html');
ok(/Money\.position\(\)/.test(debtPanel), 'the Debt panel calls Money.position()');
ok(!/pv-ff-lab[^>]*>Net worth today</.test(debtPanel),
   'and no longer prints "Net worth today" over a constant');
ok(/positionAge\(\)/.test(debtPanel), 'it also asks how old the figure is');

const vaultPage = read('Vault.dc.html');
ok(/ccy: S\.fCcy/.test(vaultPage), 'the Vault writes a currency onto each snapshot');
ok(/<option value="PLN"/.test(vaultPage), 'and offers one in the form');
ok(!/this\.props\.currency/.test(vaultPage),
   'and no longer formats from a design-canvas prop, which was the split');

const sys = read('systems.js');
ok(/Mv\.vault\(\)/.test(sys), 'systems.js reads the store through Money.vault()');

/* ── 6b. the Vault's own arithmetic, without its runtime ───────────────────
   Vault.dc.html is a React export whose runtime loads from unpkg, so it
   cannot be rendered in a sandbox with no egress — which means the methods
   changed here would otherwise ship unexecuted. The class body is plain
   JavaScript, so it is lifted out, given a stub base and a fake store, and
   its money methods are called directly. */
group('The Vault converts rather than adding currencies together');

function vaultLogic(store) {
  const src = read('Vault.dc.html');
  const m = src.match(/class Component extends DCLogic \{([\s\S]*?)\n\}\n<\/script>/);
  if (!m) return null;
  const s = Object.assign({}, store);
  const ctx = {
    console, JSON, Object, Array, String, Number, Math, Date, isFinite, isNaN, parseFloat,
    localStorage: {
      getItem: (k) => (k in s ? s[k] : null),
      setItem: (k, v) => { s[k] = String(v); },
      removeItem: (k) => { delete s[k]; }
    },
    setTimeout: () => {}
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('money.js'), ctx, { filename: 'money.js' });
  vm.runInContext(
    'class DCLogic { constructor(){ this.props = {}; this.state = {}; } setState(){} }\n' +
    'class Component extends DCLogic {' + m[1] + '\n}\n' +
    'globalThis.__mk = () => new Component();',
    ctx, { filename: 'Vault.class.js' });
  return ctx.__mk();
}

const pln = vaultLogic(Object.assign(
  vaultOf([{ m: '2026-08', ccy: 'PLN', cash: 3000, inv: 0, debt: 0 },
           { m: '2026-09', ccy: 'PLN', cash: 5200, inv: 0, debt: 400 }], { assume: 'PLN' }),
  ratesOf('USD', { PLN: 3.9 })));

ok(pln !== null, 'the Vault class body lifts out and runs');
if (pln) {
  const snaps = pln.read().snaps;
  const last = snaps[snaps.length - 1];
  ok(pln.ccyOf(last) === 'PLN', 'a snapshot reports its own currency');
  ok(pln.netOf(last) === 4800, 'its own net is 5 200 − 400 = ' + pln.netOf(last) + ' zł');
  ok(Math.round(pln.netIn(last, 'USD')) === 1231,
     'converted for display it is $' + Math.round(pln.netIn(last, 'USD')) + ' at 3.9 zł/$');
  ok(pln.fmt(4800, 'PLN') !== pln.fmt(4800, 'USD'),
     'and the two currencies do not format identically');

  /* The reason a page-wide symbol was wrong: two snapshots in different
     currencies must not be subtracted from one another raw. */
  const mixed = vaultLogic(Object.assign(
    vaultOf([{ m: '2026-08', ccy: 'USD', cash: 1000, inv: 0, debt: 0 },
             { m: '2026-09', ccy: 'PLN', cash: 4000, inv: 0, debt: 0 }]),
    ratesOf('USD', { PLN: 4 })));
  const ms = mixed.read().snaps;
  ok(mixed.netIn(ms[0], 'USD') === 1000 && mixed.netIn(ms[1], 'USD') === 1000,
     'a $1 000 month and a 4 000 zł month are the same money once converted');

  /* And with no rate, nothing is invented. */
  const norate = vaultLogic(vaultOf([{ m: '2026-09', ccy: 'PLN', cash: 4000, inv: 0, debt: 0 }]));
  ok(norate.netIn(norate.read().snaps[0], 'USD') === null,
     'without a rate the conversion is null, so the chart drops the point instead of lying');
}

/* ── 7. the Targets panel keeps what it says it keeps ──────────────────── */
group('The Targets panel remembers its own record');

ok(/ct_targets_v1/.test(debtPanel), 'targets persist under a ct_ key, so sync carries them');
ok(/function tRead\(/.test(debtPanel) && /function tWrite\(/.test(debtPanel),
   'with a read and a write rather than an in-memory array');
ok(/restore\(\)/.test(debtPanel), 'and the stored values are restored before the first paint');
/* The button claims the decision is "on the record". It has to actually be. */
ok(/st\.chain\.push/.test(debtPanel) && /chain: st\.chain/.test(debtPanel),
   'revising the target writes the reason to the stored chain');

/* ── 8. sync.js will carry all of it ───────────────────────────────────── */
group('Everything new rides the existing sync');

const sync = read('sync.js');
const skips = /__sync|__local/.test(sync);
ok(skips, 'sync.js pushes every localStorage key that is not __sync* or __local*');
['ct_vault_v1', 'ct_targets_v1', 'ct_rates_v1'].forEach((k) => {
  ok(/^ct_/.test(k), k + ' is a ct_ key, so it is pushed rather than skipped');
});

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
