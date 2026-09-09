/* ─────────────────────────────────────────────────────────────
   school-year.test.js — the Lublin cash model reproduces its source,
   and then disagrees with it in the one place the source was wrong.

   Run with `node tools/school-year.test.js` from the repo root. Also run by
   the deploy.

   Finances 26-28.html states four tables: nine running balances, and
   fourteen "June 2027 cash" rows across two tutoring rates. Those are
   RESULTS. plan-v2-data.js stores only the inputs they came from — the
   2 200 in, the 3 000 out, a 6 300 scholarship paid as a January lump plus
   five instalments, two paper lots — and plan-v2.js recomputes the rest.

   So the first job of this file is to prove the encoding is faithful: every
   published figure has to come back out. If one does not, the inputs were
   mistyped and every verdict built on them is furniture.

   The second job is the reason the model exists. The document closes with
   "Local: about 24–32 h/month self-funds a housed unpaid summer. USD:
   16–20 h/month does the same job." Its own inputs do not produce that.
   Clearing the bottom of its own 9–13k pile takes 31 h/month local or
   21 h/month US, and the top of that range is unreachable at the local rate
   inside the file's own 32 h cap. Two different goals — holding the floor,
   and funding the summer — collected one recommendation, and the floor
   figure (12 h local, 8 h US) is the one that is right.

   A model that stored its conclusions could not have found that.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function load() {
  const store = {};
  const ctx = {
    console, JSON, Object, Array, String, RegExp, Date, Math, isNaN,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } },
    document: { createElement: () => ({}) }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('plan-v2-data.js'), ctx, { filename: 'plan-v2-data.js' });
  vm.runInContext(read('plan-v2.js'), ctx, { filename: 'plan-v2.js' });
  return ctx.PlanV2;
}
const P = load();
const S = P.schoolYear();
const r0 = (n) => Math.round(n);

/* ── 1. the inputs are the document's inputs ───────────────────────────── */
group('The inputs match the source document');

const pm = P.syPerMonth();
ok(pm.income === 2200, 'guaranteed in is 2 200 (allowance 1 200 + research 1 000)');
ok(pm.out === 3000,    'out is 3 000 (rent 1 800 + food 800 + extra 400)');
ok(pm.hole === -800,   'so the hole before scholarship is −800');
ok(S.start === 5000,   'the year opens on 5 000 after Arizona');

/* The line that reads like double-counting every time and is not. */
ok(S.scholarship.perMonth * S.scholarship.months === S.scholarship.total,
   '9 months x 700 = the 6 300 total');
const lump = S.scholarship.paid.reduce(
  (a, p) => a + p.amt * (p.through ? (S.months.indexOf(p.through) - S.months.indexOf(p.m) + 1) : 1), 0);
ok(lump === S.scholarship.total,
   'and 2 800 in January + 700 x 5 pays exactly that, not more (' + lump + ')');

/* Research is the second-biggest block and the worst-paid hour in the file. */
const rr = P.syRate('research'), loc = P.syRate('local'), us = P.syRate('us');
ok(Math.abs(rr.zl - 1000 / 30) < 0.1, 'the research wage is the implied 1 000 / 30 h');
ok(rr.zl < loc.zl && loc.zl < us.zl, 'and it is the lowest of the three rates');

/* ── 2. every published figure comes back out ──────────────────────────── */
group('The model reproduces the document\'s own tables');

/* "Bare bones", nine rows, no tutoring. */
const bare = P.syMonths(0, 'local').map((r) => r0(r.running));
const published = [4200, 1200, 400, 2400, 2300, 2200, 100, 0, -100];
ok(bare.join(',') === published.join(','),
   'the bare-bones running balances are exact — ' + bare.join(' '));

/* And the sentence under that table. */
const noSchol = 5000 + 9 * -800 - 2200 - 2000;
ok(noSchol === -6400, 'without the scholarship the year ends at −6 400, as stated');

/* The June 2027 table, both rates. */
const june = [
  ['local', 4, 1700], ['local', 8, 3500], ['local', 12, 5300], ['local', 16, 7100],
  ['local', 20, 8900], ['local', 24, 10700], ['local', 28, 12500], ['local', 32, 14300],
  ['us', 4, 2600], ['us', 8, 5300], ['us', 12, 8000], ['us', 16, 10700],
  ['us', 20, 13400], ['us', 24, 16100], ['us', 28, 18800], ['us', 32, 21500]
];
const wrong = june.filter(([rate, h, want]) => r0(P.syEnd(h, rate)) !== want);
ok(wrong.length === 0,
   'all ' + june.length + ' published June-2027 rows reproduce' +
   (wrong.length ? ' — off: ' + wrong.map(([r, h, w]) => h + 'h ' + r + ' want ' + w +
     ' got ' + r0(P.syEnd(h, r))).join('; ') : ''));

/* ── 3. and then it disagrees, with the receipts ───────────────────────── */
group('The recommendation the document closes with does not follow from it');

const need = (target, rate) => P.syHoursFor(target, rate);

const floorLocal = need(S.cushion, 'local'), floorUs = need(S.cushion, 'us');
ok(floorLocal.hours > 11 && floorLocal.hours <= 12,
   'holding the 5 000 floor takes ~12 h/month local (' + floorLocal.hours + ')');
ok(floorUs.hours > 7 && floorUs.hours <= 8,
   'or ~8 h/month US (' + floorUs.hours + ') — the closing sentence is right about this');

const pileLoLocal = need(S.cushion + S.pile.lo, 'local');
const pileLoUs = need(S.cushion + S.pile.lo, 'us');
ok(pileLoLocal.hours > 31 && pileLoLocal.hours < 32,
   'but the BOTTOM of the summer pile takes ~31 h/month local (' + pileLoLocal.hours +
   '), not the 24 the document recommends');
ok(pileLoUs.hours > 20 && pileLoUs.hours < 22,
   'and ~21 h/month US (' + pileLoUs.hours + '), not 16');

const pileHiLocal = need(S.cushion + S.pile.hi, 'local');
ok(!pileHiLocal.reachable && pileHiLocal.hours > S.cap.hours,
   'the TOP of the pile is unreachable at the local rate — ' + pileHiLocal.hours +
   ' h/month against the file\'s own ' + S.cap.hours + ' h cap');
ok(need(S.cushion + S.pile.hi, 'us').reachable,
   'it is reachable in USD, which is the whole argument for the US rate');

/* At the cap, local buys the bottom rung and nothing more. */
const atCap = P.syEnd(S.cap.hours, 'local') - S.cushion;
ok(atCap >= S.pile.lo && atCap < S.pile.hi,
   'maxed at 32 h local the pile is ' + r0(atCap) + ' zł — over the 9 000 floor, under the 13 000 top');

/* ── 4. the pile is insurance, and the model says so ───────────────────── */
group('The pile is priced against the unpaid branch');

ok(/stipend/i.test(S.pile.note) && /housing/i.test(S.pile.note),
   'the pile note records that the campaign\'s first target pays and houses');
const P2 = P.plan();
ok(/Stipend \(NIH SIP pays\)/.test((P2.finance.funding2027 || []).join('|')),
   'which is what the funding list has said since August');

/* ── 5. the hours the document never wrote down ────────────────────────── */
group('The overhead that every feasibility verdict turned on');

const b = P.syBudget();
ok(b.awake === 510, 'the awake month is 510 h');
ok(b.awake - S.hours.blocks[0].plan - S.hours.blocks[1].plan === 300,
   'and 510 − 180 study − 30 research is 300 h, not the 100–120 the document claims');
ok(S.hours.overhead.plan > 0 && b.available === b.awake - b.overhead,
   'the missing overhead is an explicit dial (' + b.overhead + ' h), not a hidden constant');
ok(b.fits, 'the planned month fits: ' + b.planned + ' h of ' + b.available);
ok(!b.maxedFits,
   'and "everything maxed" does not: ' + b.maxed + ' h of ' + b.available +
   ' — the same verdict the document reaches, now derived');
ok(b.nonStudy === 86,
   'non-study work at the planned settings is ' + b.nonStudy + ' h/month');

/* ── 6. nothing derived is also stored ─────────────────────────────────── */
group('Only inputs live in the data file');

const src = read('plan-v2-data.js');
const syBlock = src.slice(src.indexOf('schoolYear: {'), src.indexOf('/* ── §14 risk register'));
ok(syBlock.length > 500, 'found the schoolYear block');
const leaked = ['4200', '14300', '21500', '10700', '31.4', '20.9'].filter((n) => syBlock.includes(n));
ok(leaked.length === 0,
   'no computed result is stored beside its inputs' +
   (leaked.length ? ' — found ' + leaked.join(', ') : ''));

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
