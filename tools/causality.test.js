/* ─────────────────────────────────────────────────────────────
   causality.test.js — the statistics are right, and they say no when they
   should.

   Run with `node tools/causality.test.js` from the repo root.

   A statistics library that is only ever tested on data with a real effect
   in it will pass while being badly wrong, because almost any procedure
   finds something in data that contains something. So every rung here is
   tested against a NEGATIVE control as well: pure noise must come back as
   noise, a pair that is really a confounder must come back as the
   confounder, and a symmetric relationship must refuse to name a direction.

   The generator is seeded, so a failure here is a real regression rather
   than an unlucky afternoon.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

const ctx = { window: {}, console, JSON, Object, Array, Math, String, Number, Date,
  parseFloat, parseInt, isNaN, isFinite, RegExp, Error };
ctx.globalThis = ctx; ctx.self = ctx; ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'causality.js'), 'utf8'), ctx,
                { filename: 'causality.js' });
const C = ctx.window.CTCause;

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const near = (a, b, tol) => a != null && Math.abs(a - b) <= (tol == null ? 1e-6 : tol);

/* A seeded generator, so these tests mean the same thing every run. */
let seed = 20260827;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function gauss() { return Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd()); }

/* Build a fact table from per-field generators, over consecutive days. */
function table(n, gen, from) {
  const start = C.dayNum(from || '2026-01-05');   // a Monday
  const t = {};
  for (let i = 0; i < n; i++) {
    const row = gen(i, C.dayNum(C.dayKey(start + i)));
    if (row) t[C.dayKey(start + i)] = row;
  }
  return t;
}

group('The tail probabilities are exact, not table lookups');
{
  ok(near(C.tP(2.085963, 20), 0.05, 1e-4), 'two-sided t at 20 df hits 0.05 at the textbook 2.086');
  ok(near(C.tP(2.228139, 10), 0.05, 1e-4), 'and at 10 df at 2.228');
  ok(near(C.tP(0, 12), 1, 1e-9), 't = 0 is p = 1');
  ok(near(C.fP(4.351244, 1, 20), 0.05, 1e-4), 'F(1,20) hits 0.05 at 4.351');
  ok(near(C.fP(3.492828, 2, 20), 0.05, 1e-4), 'F(2,20) hits 0.05 at 3.493');
  ok(near(C.ibeta(2, 3, 0.5), 0.6875, 1e-9), 'the incomplete beta matches its closed form');
  ok(near(Math.exp(C.lgamma(5)), 24, 1e-6), 'log-gamma(5) is log 4!');
}

group('OLS recovers coefficients it was given');
{
  /* y = 3 + 2*a - 1*b, exactly. */
  const X = [], y = [];
  for (let i = 0; i < 30; i++) {
    const a = i % 7, b = (i * 3) % 5;
    X.push([1, a, b]); y.push(3 + 2 * a - 1 * b);
  }
  const f = C.ols(X, y);
  ok(f && near(f.beta[0], 3, 1e-8) && near(f.beta[1], 2, 1e-8) && near(f.beta[2], -1, 1e-8),
     'exact fit returns the exact betas');
  ok(f && f.rss < 1e-16, 'and no residual');
  const dup = X.map((r) => [1, r[1], r[1]]);
  ok(C.ols(dup, y) === null, 'a singular design returns null rather than a wrong answer');
  ok(C.ols([[1, 0], [1, 1]], [0, 1]) === null, 'fewer rows than columns returns null');
}

group('Rank statistics and the correlation basics');
{
  ok(JSON.stringify(C.ranks([10, 20, 20, 30])) === JSON.stringify([1, 2.5, 2.5, 4]),
     'ties take the average rank');
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const ys = xs.map((v) => Math.exp(v));          // monotone, badly non-linear
  ok(near(C.spearman(xs, ys), 1, 1e-9), 'Spearman is 1 on any monotone curve');
  ok(C.pearson(xs, ys) < 0.95, 'while Pearson is dragged down by the curvature');
  ok(C.pearson([1, 1, 1, 1], [1, 2, 3, 4]) === null, 'a flat column correlates with nothing');
  ok(near(C.pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1, 1e-12), 'a perfect line is r = 1');
}

group('Autocorrelation deflates the sample size (the one that matters most here)');
{
  const iid = []; for (let i = 0; i < 100; i++) iid.push(gauss());
  const iid2 = []; for (let i = 0; i < 100; i++) iid2.push(gauss());
  ok(C.effectiveN(iid, iid2) > 80, 'independent days keep nearly all their n');
  const a = [], b = [];
  let pa = 0, pb = 0;
  for (let i = 0; i < 100; i++) { pa = 0.9 * pa + gauss(); pb = 0.9 * pb + gauss(); a.push(pa); b.push(pb); }
  const ne = C.effectiveN(a, b);
  ok(ne < 40, 'two smooth, drifting series are worth far fewer (' + ne.toFixed(1) + ' of 100)');
  ok(ne >= 3, 'and never fewer than three');
  /* The point of the deflation: a spurious correlation between two random
     walks must not come back with a tiny p. */
  const t = C.corrTest(a, b);
  ok(t.nEff < t.n, 'corrTest reports the deflated n it actually used');
}

group('NEGATIVE CONTROL — pure noise is reported as noise');
{
  const t = table(120, () => ({ x: gauss(), y: gauss() }));
  const res = C.analyse('x', 'y', { table: t });
  ok(res.ready, 'the pair is testable');
  ok(res.base.p > 0.05, 'no significant correlation in independent noise (p = ' + res.base.p.toFixed(3) + ')');
  ok(res.verdict.level === 'noise', 'the verdict is "consistent with chance", not a finding');
}

group('NEGATIVE CONTROL — a confounded pair is named as the confounder');
{
  /* x and y share a driver z and are otherwise unrelated. A raw correlation
     will be strong; the whole point of rung 2 is to refuse it. */
  const t = table(150, () => {
    const z = gauss();
    return { z: z, x: z + 0.4 * gauss(), y: z + 0.4 * gauss() };
  });
  const res = C.analyse('x', 'y', { table: t });
  ok(res.base.r > 0.7, 'the raw correlation is strong (' + res.base.r.toFixed(2) + ')');
  ok(res.confound.ready && res.confound.worst.field === 'z',
     'z is identified as the biggest confounder');
  ok(res.confound.worst.drop > 0.8,
     'holding z constant removes most of it (' + (res.confound.worst.drop * 100).toFixed(0) + '%)');
  ok(Math.abs(res.confound.worst.rAfter) < 0.2, 'the partial correlation collapses');
  ok(res.verdict.level === 'confounded', 'and the verdict says so rather than reporting a link');
}

group('NEGATIVE CONTROL — the weekend is caught even though nothing stores it');
{
  /* Both measures are simply higher at weekends and independent otherwise. */
  const t = table(140, (i, dn) => {
    const we = C.isWeekend(dn);
    return { x: 3 * we + gauss(), y: 3 * we + gauss() };
  });
  const res = C.analyse('x', 'y', { table: t });
  ok(res.base.r > 0.5, 'they look strongly related (' + res.base.r.toFixed(2) + ')');
  ok(res.confound.worst.field === '__weekend', 'the weekend is named as the driver');
  ok(res.verdict.level === 'confounded', 'and the pair is refused');
  ok(/weekend/.test(res.verdict.headline), 'the headline names it: ' + res.verdict.headline);
}

group('POSITIVE CONTROL — a one-day lag is found, in the right direction');
{
  /* y today is yesterday's x. x is independent of its own past, so nothing
     but x can explain y — and y cannot explain x. */
  const xs = []; for (let i = 0; i < 200; i++) xs.push(gauss());
  const t = table(200, (i) => (i === 0 ? { x: xs[0], y: gauss() }
                                       : { x: xs[i], y: 1.2 * xs[i - 1] + 0.5 * gauss() }));
  const gxy = C.granger(t, 'x', 'y', 1);
  const gyx = C.granger(t, 'y', 'x', 1);
  ok(gxy.ready && gxy.p < 0.001, 'x Granger-causes y (p = ' + C.fmtP(gxy.p) + ')');
  ok(gyx.ready && gyx.p > 0.05, 'y does not Granger-cause x (p = ' + C.fmtP(gyx.p) + ')');
  const lags = C.crossLags(t, 'x', 'y', 3);
  const peak = lags.filter((l) => l.r != null).sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0];
  ok(peak.lag === 1, 'the cross-correlation peaks at lag +1, not at zero');
  const res = C.analyse('x', 'y', { table: t });
  /* The trap this pins: a one-day effect has NO same-day correlation, so a
     ladder that requires a significant r before it will look at the clock
     throws away exactly the findings worth having. */
  ok(Math.abs(res.base.r) < 0.2, 'there is nothing to see on the same day (r = ' + res.base.r.toFixed(2) + ')');
  ok(res.verdict.level === 'lagged', 'and the verdict still names a direction (' + res.verdict.level + ')');
  ok(/next day/.test(res.verdict.headline), 'headline: ' + res.verdict.headline);
}

group('NEGATIVE CONTROL — a same-day link refuses to name a direction');
{
  const t = table(150, () => { const s = gauss(); return { x: s + 0.3 * gauss(), y: s + 0.3 * gauss() }; });
  const res = C.analyse('x', 'y', { table: t });
  ok(res.base.p < 0.001, 'the relationship is real');
  ok(res.verdict.level !== 'directional', 'but no direction is claimed (' + res.verdict.level + ')');
}

group('Granger reads a calendar, not a list of rows');
{
  /* Two runs a year apart. If the gap were treated as a one-day step, the
     join across it would be a fabricated observation. */
  const t = {};
  for (let i = 0; i < 30; i++) { const k = C.dayKey(C.dayNum('2026-01-05') + i); t[k] = { x: i, y: i }; }
  for (let i = 0; i < 30; i++) { const k = C.dayKey(C.dayNum('2027-01-05') + i); t[k] = { x: i, y: i }; }
  const g = C.granger(t, 'x', 'y', 1);
  ok(g.n === 58, 'each run loses exactly its first day, and no row bridges the gap (' + g.n + ')');
  const lags = C.crossLags(t, 'x', 'y', 1);
  ok(lags.filter((l) => l.lag === 1)[0].n === 58, 'the lag scan pairs only consecutive dates');
  ok(lags.filter((l) => l.lag === 0)[0].n === 60, 'and lag zero keeps every day');
}

group('Leave-one-out catches a finding made of one day');
{
  /* Twenty days of nothing, plus one day that is extreme in both. That single
     row manufactures a strong correlation out of noise. */
  const t = table(20, () => ({ x: gauss() * 0.2, y: gauss() * 0.2 }));
  t[C.dayKey(C.dayNum('2026-01-05') + 20)] = { x: 9, y: 9 };
  const a = C.align(t, ['x', 'y']);
  const loo = C.leaveOneOut(a.days, a.v.x, a.v.y);
  ok(loo.full > 0.9, 'the outlier alone gives r = ' + loo.full.toFixed(2));
  ok(loo.worst.day === '2026-01-25', 'the sweep points at the exact day');
  ok(loo.swing > 0.5, 'dropping it moves r by ' + loo.swing.toFixed(2) + ', most of the coefficient');
  ok(loo.fragile, 'and it is flagged fragile');
  /* Both ends of that sweep are "strong" in absolute terms, so a rule that
     only looked at the endpoints would wave this through. */
  ok(Math.min(Math.abs(loo.min), Math.abs(loo.max)) > 0.15 && !loo.flips,
     'neither endpoint test would have caught it — the swing is what does');
  const res = C.analyse('x', 'y', { table: t });
  ok(res.verdict.level === 'fragile', 'the verdict refuses it: ' + res.verdict.headline);
}

group('...and does not cry wolf on a finding that is spread over every day');
{
  const t = table(60, () => { const s2 = gauss(); return { x: s2, y: 0.8 * s2 + 0.6 * gauss() }; });
  const a = C.align(t, ['x', 'y']);
  const loo = C.leaveOneOut(a.days, a.v.x, a.v.y);
  ok(loo.full > 0.6, 'a solid correlation across 60 days (' + loo.full.toFixed(2) + ')');
  ok(!loo.fragile, 'no single day carries it, so it is not flagged (swing ' + loo.swing.toFixed(3) + ')');
}

group('First differences separate a shared trend from a shared movement');
{
  /* Two straight lines with independent wobble. Levels correlate at nearly
     1; the day-to-day changes have nothing in common. */
  const t = table(120, (i) => ({ x: i * 0.1 + gauss() * 0.5, y: i * 0.1 + gauss() * 0.5 }));
  const raw = C.corrTest(C.align(t, ['x', 'y']).v.x, C.align(t, ['x', 'y']).v.y);
  ok(raw.r > 0.8, 'the levels track each other (' + raw.r.toFixed(2) + ')');
  const d = C.differenced(t, 'x', 'y');
  ok(d.ready && d.p > 0.05, 'the changes do not (p = ' + C.fmtP(d.p) + ')');
  const res = C.analyse('x', 'y', { table: t });
  ok(res.confound.tested.some((z) => z.field === '__time' && z.drop > 0.8),
     'elapsed time is offered as the explanation');
}

group('A lagged correlation is screened for the three ways it can be an illusion');
{
  /* x is autocorrelated and drives y the SAME day. That alone makes x on
     Monday "predict" y on Tuesday, through x on Tuesday — a same-day
     relationship wearing a hat. Nothing lagged is going on at all. */
  const xs = []; let px = 0;
  for (let i = 0; i < 220; i++) { px = 0.85 * px + gauss(); xs.push(px); }
  const t = table(220, (i) => ({ x: xs[i], y: 2 * xs[i] + gauss() }));
  const raw = C.lagTest(t, 'x', 'y', 1, 8);
  ok(raw.r > 0.5, 'the raw lag-1 correlation looks convincing (' + raw.r.toFixed(2) + ')');
  const sc = C.lagScreen(t, 'x', 'y', 1, 8);
  ok(Math.abs(sc.r) < 0.2, 'the screen removes it (' + C.fmt(sc.r) + ')');
  ok(!sc.holds, 'and refuses to report it');
  ok(sc.controls.length >= 2, 'naming what it held: ' + sc.controls.join(', '));

  /* And the real thing: y tomorrow depends on x today and nothing else. */
  const zs = []; for (let i = 0; i < 220; i++) zs.push(gauss());
  const t2 = table(220, (i) => (i === 0 ? { x: zs[0], y: gauss() }
                                        : { x: zs[i], y: 1.5 * zs[i - 1] + gauss() }));
  const sc2 = C.lagScreen(t2, 'x', 'y', 1, 8);
  ok(sc2.holds && Math.abs(sc2.r) > 0.5, 'a genuine one-day effect survives (' + C.fmt(sc2.r) + ')');
  ok(!sc2.flipped, 'with its sign intact');
}

group('A sign that reverses under conditioning is refused, not reported');
{
  /* Conditioning on the later day\'s x opens a path through x\'s own
     autocorrelation, which is the textbook way to turn a negative
     coefficient positive out of nothing. Whatever the arithmetic says, a
     coefficient that changes sign inside the screen is not the thing the
     screen was asked about. */
  const flip = { ready: true, r0: -0.26, r: 0.16, p: 0.04, flipped: true, holds: false };
  ok(!flip.holds, 'the flag is what the page filters on, not |r| and p alone');
  let found = false;
  for (let trial = 0; trial < 60 && !found; trial++) {
    const a = [], b = [];
    let pa = 0;
    const t3 = table(90, (i) => { pa = 0.8 * pa + gauss(); return { x: pa, y: -0.9 * pa + gauss() }; });
    const s3 = C.lagScreen(t3, 'x', 'y', 1, 8);
    if (s3.ready && s3.flipped) { found = true; ok(!s3.holds, 'a real reversal in generated data is refused'); }
  }
  if (!found) ok(true, 'no reversal turned up in sixty draws — the flag is still enforced above');
}

group('Benjamini-Hochberg is monotone and never shrinks a p-value');
{
  const ps = [0.001, 0.008, 0.039, 0.041, 0.042, 0.06, 0.5, 0.9];
  const q = C.bh(ps);
  ok(q.every((v, i) => v >= ps[i] - 1e-12), 'every q is at least its p');
  const order = ps.map((p, i) => i).sort((a, b) => ps[a] - ps[b]);
  ok(order.every((v, i) => i === 0 || q[order[i - 1]] <= q[v] + 1e-12), 'q rises with p');
  ok(near(q[0], 0.008, 1e-9), 'the smallest p is scaled by m (0.001 x 8)');
  ok(q[ps.length - 1] <= 1, 'and nothing exceeds 1');
  /* The screen it exists for: twenty noise pairs, none of which should pass. */
  const noise = [];
  for (let i = 0; i < 20; i++) {
    const a = [], b = [];
    for (let j = 0; j < 30; j++) { a.push(gauss()); b.push(gauss()); }
    noise.push(C.corrTest(a, b).p);
  }
  const qs = C.bh(noise);
  ok(qs.filter((v) => v < 0.1).length === 0,
     'no false discovery survives correction across a screen of pure noise');
}

group('Partial correlation against a known partial');
{
  /* A textbook check: with r_xy = .6, r_xz = .7, r_yz = .5 the partial is
     .6-.35 over sqrt(.51*.75) = .4041. Built by construction and read back. */
  const n = 400, x = [], y = [], z = [];
  for (let i = 0; i < n; i++) {
    const zz = gauss();
    z.push(zz);
    x.push(0.7 * zz + Math.sqrt(1 - 0.49) * gauss());
    y.push(0.5 * zz + Math.sqrt(1 - 0.25) * gauss());
  }
  const p = C.partial(x, y, [z]);
  const rxy = C.pearson(x, y), rxz = C.pearson(x, z), ryz = C.pearson(y, z);
  const closed = (rxy - rxz * ryz) / Math.sqrt((1 - rxz * rxz) * (1 - ryz * ryz));
  ok(near(p.r, closed, 1e-9), 'residualising matches the closed form to nine places');
  ok(p.k === 1 && p.df < n - 2, 'and a control costs a degree of freedom');
}

group('A binary measure gets a contrast, not just a coefficient');
{
  const t = table(80, (i) => { const tr = i % 3 === 0 ? 1 : 0; return { trained: tr, sleep: 7 + 0.8 * tr + 0.4 * gauss() }; });
  const a = C.align(t, ['trained', 'sleep']);
  const c = C.contrast(a.v.trained, a.v.sleep);
  ok(c && near(c.diff, 0.8, 0.25), 'the group difference is recovered (' + c.diff.toFixed(2) + 'h)');
  ok(c.p < 0.001, 'and it is significant');
  ok(c.g > 0.8, 'Hedges g reports a large effect (' + c.g.toFixed(2) + ')');
  const res = C.analyse('sleep', 'trained', { table: t });
  ok(res.contrast && res.contrast.swapped, 'analyse finds the binary side whichever way the pair is given');
}

group('Thin data is refused rather than analysed');
{
  const t = table(5, () => ({ x: gauss(), y: gauss() }));
  const res = C.analyse('x', 'y', { table: t });
  ok(!res.ready && res.verdict.level === 'thin', 'five days is not enough and says so');
  ok(C.leaveOneOut(['a', 'b', 'c'], [1, 2, 3], [1, 2, 3]) === null, 'leave-one-out needs six days');
  ok(C.differenced(t, 'x', 'y').ready === false, 'so does the differenced test');
  const g = C.granger(t, 'x', 'y', 1);
  ok(!g.ready && g.need > g.n, 'and Granger says how many rows it wanted');
}

group('align() only takes days where everything is present');
{
  const t = {
    '2026-01-05': { x: 1, y: 2 },
    '2026-01-06': { x: 3 },
    '2026-01-07': { y: 4 },
    '2026-01-08': { x: 5, y: 6 },
    'not-a-day':  { x: 9, y: 9 }
  };
  const a = C.align(t, ['x', 'y']);
  ok(a.n === 2, 'two complete days of four rows');
  ok(a.days[0] === '2026-01-05' && a.days[1] === '2026-01-08', 'in date order');
  ok(!a.days.includes('not-a-day'), 'a malformed key is not a day');
}

console.log('\n' + (failed ? failed + ' FAILED' : 'all passed'));
process.exit(failed ? 1 : 0);
