/* ─────────────────────────────────────────────────────────────
   causality.js — the arithmetic behind "does this actually cause that".

   THE PROBLEM. Trends.html could draw a correlation matrix and nothing else.
   That is a machine for producing confident nonsense. Thirty-six cells, five
   of them reported as findings, no p-values, no correction for having looked
   thirty-six times, no check for the third thing driving both, no direction.
   The page carried a disclaimer — "correlation is not cause" — and then
   printed "Sleep rises with study" in bold, which is the disclaimer doing no
   work at all.

   Nothing here turns observational self-tracking into a randomised trial.
   What it can do is run the checks that RULE THINGS OUT, which is most of
   what causal inference is in practice. Four rungs, in order, each of which
   can end the climb:

     1. IS IT REAL?      r with a two-sided p, a Fisher CI, and — the one that
                         matters most for daily data — a sample size deflated
                         for autocorrelation. Fifty consecutive days are not
                         fifty independent observations of anything. Then
                         Benjamini-Hochberg across the whole matrix, because
                         the top-of-five ranking is a multiple-comparisons
                         machine and at r ≥ 0.2 with n = 30 you will find
                         "findings" in shuffled noise.

     2. IS IT A THIRD THING? Partial correlation against every other logged
                         measure, plus two the table does not store: whether
                         it was a weekend, and elapsed time. Weekends move
                         sleep, study, screen and training at once, so half
                         the strong cells in this matrix are, at bottom, a
                         calendar. If controlling for Z collapses r, the pair
                         was Z all along.

     3. WHICH WAY?       Direction needs time. Two independent readings of it:
                         the lead-lag asymmetry (does today's X track
                         tomorrow's Y better than today's Y tracks tomorrow's
                         X) and a Granger F-test in both directions — does
                         X's history improve the prediction of Y beyond what
                         Y's own history already gives. Granger causality is
                         not causality; it is precedence with the obvious
                         confound removed, which is strictly more than a
                         same-day r can offer.

     4. IS IT ONE DAY?   Leave-one-out: refit dropping each day and take the
                         largest swing. One food-poisoning night can carry a
                         whole finding at n = 20. Plus the same correlation on
                         first differences, which is immune to slow shared
                         drift — if day-to-day CHANGES move together, that is
                         a much harder result than two lines both trending.

   Everything is exact-ish: the t and F tail probabilities come from a
   regularised incomplete beta, not a lookup table, so this holds up at the
   small n the hub actually has.

   No dependencies. Reads CTFacts if it is there, otherwise takes a table.
   ───────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  /* ── special functions ──────────────────────────────────────────────
     Lanczos log-gamma and the Numerical Recipes continued fraction for the
     incomplete beta. Everything downstream — every p-value on the page — is
     one of these two tails, so they are worth getting right rather than
     approximating with a normal and hoping n is large. It is not large. */

  var LANCZOS = [76.18009172947146, -86.50532032941677, 24.01409824083091,
                 -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];

  function lgamma(x) {
    var y = x, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    var ser = 1.000000000190015;
    for (var j = 0; j < 6; j++) ser += LANCZOS[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }

  function betacf(a, b, x) {
    var MAXIT = 300, EPS = 3e-14, FPMIN = 1e-300;
    var qab = a + b, qap = a + 1, qam = a - 1;
    var c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    var h = d, m, m2, aa, del;
    for (m = 1; m <= MAXIT; m++) {
      m2 = 2 * m;
      aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c;  if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c;  if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; del = d * c; h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }

  /* Regularised incomplete beta I_x(a,b). */
  function ibeta(a, b, x) {
    if (!(x > 0)) return 0;
    if (x >= 1) return 1;
    var bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) +
                      a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
    return 1 - bt * betacf(b, a, 1 - x) / b;
  }

  /* Two-sided p for a t statistic. */
  function tP(t, df) {
    if (!isFinite(t) || !(df > 0)) return null;
    return ibeta(df / 2, 0.5, df / (df + t * t));
  }

  /* Upper tail for an F statistic — the only tail an F-test ever wants. */
  function fP(F, d1, d2) {
    if (!isFinite(F) || F <= 0 || !(d1 > 0) || !(d2 > 0)) return null;
    return ibeta(d2 / 2, d1 / 2, d2 / (d2 + d1 * F));
  }

  /* ── vector arithmetic ──────────────────────────────────────────── */

  function mean(v) {
    var s = 0; for (var i = 0; i < v.length; i++) s += v[i];
    return s / v.length;
  }

  function pearson(xs, ys) {
    var n = xs.length;
    if (n < 3) return null;
    var mx = mean(xs), my = mean(ys), sxy = 0, sxx = 0, syy = 0, i, a, b;
    for (i = 0; i < n; i++) {
      a = xs[i] - mx; b = ys[i] - my;
      sxy += a * b; sxx += a * a; syy += b * b;
    }
    if (sxx === 0 || syy === 0) return null;   // a flat column correlates with nothing
    var r = sxy / Math.sqrt(sxx * syy);
    return Math.max(-1, Math.min(1, r));
  }

  /* Ranks with ties averaged, so Spearman is honest about a measure like
     `diet` that takes four values and repeats them constantly. */
  function ranks(v) {
    var idx = v.map(function (x, i) { return [x, i]; });
    idx.sort(function (a, b) { return a[0] - b[0]; });
    var out = new Array(v.length), i = 0;
    while (i < idx.length) {
      var j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      var rk = (i + j) / 2 + 1;
      for (var k = i; k <= j; k++) out[idx[k][1]] = rk;
      i = j + 1;
    }
    return out;
  }

  /* Spearman: the same question asked of the order rather than the values.
     One outlying day cannot manufacture it, and it survives a relationship
     that is real but bent — sleep helping up to a point and then not. */
  function spearman(xs, ys) { return pearson(ranks(xs), ranks(ys)); }

  /* Lag-1 autocorrelation, the input to the effective-n deflation. */
  function ac1(v) {
    var n = v.length;
    if (n < 4) return 0;
    var m = mean(v), num = 0, den = 0, i;
    for (i = 0; i < n - 1; i++) num += (v[i] - m) * (v[i + 1] - m);
    for (i = 0; i < n; i++) den += (v[i] - m) * (v[i] - m);
    if (den === 0) return 0;
    return num / den;
  }

  /* Bartlett's first-order effective sample size for the correlation of two
     serially dependent series. Sleep is autocorrelated; screen time is
     autocorrelated; run them against each other at face-value n and the
     p-value is a fiction. Negative autocorrelation is clamped away rather
     than allowed to INFLATE n — the point of this is to be conservative. */
  function effectiveN(xs, ys) {
    var n = xs.length;
    var px = Math.max(0, Math.min(0.95, ac1(xs)));
    var py = Math.max(0, Math.min(0.95, ac1(ys)));
    var f = (1 - px * py) / (1 + px * py);
    return Math.max(3, Math.min(n, n * f));
  }

  /* r, with everything needed to know whether to believe it. */
  function corrTest(xs, ys) {
    var n = xs.length;
    var r = pearson(xs, ys);
    if (r == null) return { n: n, r: null };
    var nEff = effectiveN(xs, ys);
    var df = Math.max(1, nEff - 2);
    var denom = 1 - r * r;
    var t = denom <= 1e-12 ? Infinity : r * Math.sqrt(df / denom);
    /* Fisher z for the interval, on the deflated n for the same reason. */
    var z = 0.5 * Math.log((1 + r) / (1 - r));
    var se = nEff > 3 ? 1 / Math.sqrt(nEff - 3) : null;
    var ci = null;
    if (se != null && isFinite(z)) {
      ci = [Math.tanh(z - 1.959964 * se), Math.tanh(z + 1.959964 * se)];
    }
    return {
      n: n, nEff: Math.round(nEff * 10) / 10, r: r,
      t: t, df: df, p: tP(t, df), ci: ci,
      rho: spearman(xs, ys)
    };
  }

  /* ── ordinary least squares ─────────────────────────────────────────
     Needed twice: to residualise for partial correlation, and to fit the two
     nested models a Granger test compares. Normal equations with partial
     pivoting — X is at most a dozen columns here, so the conditioning worry
     that would rule this out at scale does not apply. Returns null rather
     than a wrong answer when the design is singular (two identical control
     columns, a constant covariate). */
  function ols(X, y) {
    var n = X.length;
    if (!n) return null;
    var k = X[0].length;
    if (n <= k) return null;
    var A = [], i, j, l, s;
    for (i = 0; i < k; i++) {
      A.push(new Array(k + 1).fill(0));
    }
    for (i = 0; i < k; i++) {
      for (j = 0; j < k; j++) {
        s = 0; for (l = 0; l < n; l++) s += X[l][i] * X[l][j];
        A[i][j] = s;
      }
      s = 0; for (l = 0; l < n; l++) s += X[l][i] * y[l];
      A[i][k] = s;
    }
    /* Gaussian elimination, partial pivot. */
    for (i = 0; i < k; i++) {
      var piv = i;
      for (j = i + 1; j < k; j++) if (Math.abs(A[j][i]) > Math.abs(A[piv][i])) piv = j;
      if (Math.abs(A[piv][i]) < 1e-10) return null;   // singular
      var tmp = A[i]; A[i] = A[piv]; A[piv] = tmp;
      for (j = i + 1; j < k; j++) {
        var f = A[j][i] / A[i][i];
        if (f === 0) continue;
        for (l = i; l <= k; l++) A[j][l] -= f * A[i][l];
      }
    }
    var beta = new Array(k).fill(0);
    for (i = k - 1; i >= 0; i--) {
      s = A[i][k];
      for (j = i + 1; j < k; j++) s -= A[i][j] * beta[j];
      beta[i] = s / A[i][i];
    }
    var resid = new Array(n), rss = 0;
    for (l = 0; l < n; l++) {
      var fit = 0;
      for (i = 0; i < k; i++) fit += X[l][i] * beta[i];
      resid[l] = y[l] - fit;
      rss += resid[l] * resid[l];
    }
    return { beta: beta, resid: resid, rss: rss, n: n, k: k };
  }

  function withIntercept(cols, n) {
    var X = [], i, j;
    for (i = 0; i < n; i++) {
      var row = [1];
      for (j = 0; j < cols.length; j++) row.push(cols[j][i]);
      X.push(row);
    }
    return X;
  }

  /* Partial correlation: r between X and Y once every control has had its
     say. Residualise both against the controls, correlate what is left. The
     degrees of freedom pay for each control, which is why the number of them
     is capped upstream rather than throwing the kitchen sink at a 30-day
     table. */
  function partial(xs, ys, controls) {
    var n = xs.length, k = controls.length;
    if (n < k + 4) return null;
    var X = withIntercept(controls, n);
    var fx = ols(X, xs), fy = ols(X, ys);
    if (!fx || !fy) return null;
    var r = pearson(fx.resid, fy.resid);
    if (r == null) return null;
    /* The residuals inherit the parent series' serial dependence, so the same
       deflation applies here as to the raw correlation. */
    var nEff = effectiveN(fx.resid, fy.resid);
    var df = Math.max(1, nEff - 2 - k);
    var denom = 1 - r * r;
    var t = denom <= 1e-12 ? Infinity : r * Math.sqrt(df / denom);
    return { r: r, n: n, k: k, df: df, p: tP(t, df) };
  }

  /* ── days, as a calendar rather than a list ─────────────────────────
     Every lag question below needs "the next day", not "the next logged
     day". A gap of a fortnight between two rows is not a one-day lag, and
     treating it as one is how a tracker invents a result. */

  function dayNum(key) {
    var p = String(key).split('-');
    return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
  }
  function dayKey(num) {
    var d = new Date(num * 86400000);
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') +
           '-' + String(d.getUTCDate()).padStart(2, '0');
  }
  function isWeekend(num) {
    var dow = new Date(num * 86400000).getUTCDay();
    return dow === 0 || dow === 6 ? 1 : 0;
  }

  /* The days where every named field is present, in order. */
  function align(table, fields) {
    var days = [], vals = {}, i;
    for (i = 0; i < fields.length; i++) vals[fields[i]] = [];
    Object.keys(table).sort().forEach(function (k) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      var row = table[k];
      for (var i2 = 0; i2 < fields.length; i2++) {
        var v = row[fields[i2]];
        if (typeof v !== 'number' || !isFinite(v)) return;
      }
      days.push(k);
      for (var i3 = 0; i3 < fields.length; i3++) vals[fields[i3]].push(row[fields[i3]]);
    });
    return { days: days, v: vals, n: days.length };
  }

  /* ── rung 3: which way ──────────────────────────────────────────────

     LEAD-LAG. Correlate X on day t with Y on day t+k for k across a small
     window. If the peak sits off zero, the earlier measure is the candidate
     cause. A peak AT zero says the two move the same day, which for a hub
     built on daily aggregates is usually all there is to see.

     The asymmetry test is the honest summary of it: r(X_t, Y_{t+1}) against
     r(Y_t, X_{t+1}). Both are computed on the same set of consecutive-day
     pairs so the comparison is not an artefact of different samples. */
  /* X on day t against Y on day t+k, over calendar-consecutive days only. */
  function lagVectors(table, xf, yf, k) {
    var idx = {};
    Object.keys(table).forEach(function (d) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) idx[dayNum(d)] = table[d];
    });
    var nums = Object.keys(idx).map(Number).sort(function (a, b) { return a - b; });
    var xs = [], ys = [], days = [];
    for (var i = 0; i < nums.length; i++) {
      var a = idx[nums[i]], b = idx[nums[i] + k];
      if (!a || !b) continue;
      var xv = a[xf], yv = b[yf];
      if (typeof xv !== 'number' || typeof yv !== 'number') continue;
      if (!isFinite(xv) || !isFinite(yv)) continue;
      xs.push(xv); ys.push(yv); days.push(dayKey(nums[i]));
    }
    return { xs: xs, ys: ys, days: days, n: xs.length };
  }

  /* The same inference as corrTest, but on a lag. This is how an effect that
     takes a night to arrive becomes visible at all: a bad night showing up
     in the next day's work has NO same-day correlation, so the matrix is
     blind to it by construction. */
  function lagTest(table, xf, yf, k, floor) {
    var v = lagVectors(table, xf, yf, k == null ? 1 : k);
    if (v.n < (floor == null ? 8 : floor)) return { n: v.n, r: null, ready: false };
    var t = corrTest(v.xs, v.ys);
    t.ready = t.r != null;
    t.lag = k == null ? 1 : k;
    return t;
  }

  /* A lagged correlation has three ordinary ways to be an illusion, and all
     three are removable:

       1. Y is autocorrelated and X is correlated with Y the same day — so
          X on Monday "predicts" Y on Tuesday purely through Y on Monday.
          Control: Y at day t.
       2. X is autocorrelated and correlates with Y the same day — so X on
          Monday "predicts" Y on Tuesday through X on TUESDAY, which is just
          the same-day relationship wearing a hat. Control: X at day t+k.
       3. Something drives both on a cycle. The weekend is the one that
          matters here, and it drives nearly everything in this table at once.
          Control: whether day t was a weekend.

     What is left after those three is a lagged association that is not the
     same-day one shifted, not the recipient's own momentum, and not the
     calendar. That is a distributed-lag model, and it is the same idea as
     the Granger test with the weekend added — which matters, because the
     weekend is the confounder Granger cannot see. */
  function lagScreen(table, xf, yf, k, floor) {
    var K = k == null ? 1 : k;
    var idx = {};
    Object.keys(table).forEach(function (d) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) idx[dayNum(d)] = table[d];
    });
    var nums = Object.keys(idx).map(Number).sort(function (a, b) { return a - b; });
    var xs = [], ys = [], yPrev = [], xNow = [], we = [];
    for (var i = 0; i < nums.length; i++) {
      var t = nums[i], a = idx[t], b = idx[t + K];
      if (!a || !b) continue;
      var v = [a[xf], b[yf], a[yf], b[xf]];
      if (v.some(function (q) { return typeof q !== 'number' || !isFinite(q); })) continue;
      xs.push(v[0]); ys.push(v[1]); yPrev.push(v[2]); xNow.push(v[3]);
      we.push(isWeekend(t));
    }
    var n = xs.length;
    if (n < (floor == null ? 10 : floor) + 4) return { ready: false, n: n };
    var r0 = pearson(xs, ys);
    if (r0 == null) return { ready: false, n: n };
    var ctrl = [yPrev, xNow];
    var uniq = {};
    we.forEach(function (q) { uniq[q] = 1; });
    var used = ['yesterday\'s ' + labelFor(yf), 'the same day\'s ' + labelFor(xf)];
    if (Object.keys(uniq).length > 1) { ctrl.push(we); used.push('the weekend'); }
    var pc = partial(xs, ys, ctrl);
    if (!pc) return { ready: false, n: n };
    /* A conditioned coefficient that comes back with the OPPOSITE sign to the
       raw one is not the raw finding confirmed — it is a different claim, and
       one that exists only inside the conditioning. Controlling for X on the
       later day opens a path through X's own autocorrelation, which is the
       textbook way to manufacture a reversal out of nothing. Treated as a red
       flag rather than as a result: whatever survives here has to be the
       thing that was there before it was screened, not its mirror image. */
    var flipped = (r0 > 0) !== (pc.r > 0);
    return {
      ready: true, n: n, r0: r0, r: pc.r, p: pc.p, df: pc.df, lag: K,
      controls: used, flipped: flipped,
      /* What the page should stand behind: the screened figure, and only
         when it agrees in sign with what it screened. */
      holds: !flipped && Math.abs(pc.r) >= 0.15 && pc.p != null && pc.p < 0.05,
      drop: Math.abs(r0) > 1e-9 ? 1 - Math.abs(pc.r) / Math.abs(r0) : 0
    };
  }

  function crossLags(table, xf, yf, maxLag) {
    var M = maxLag == null ? 3 : maxLag;
    var out = [];
    for (var k = -M; k <= M; k++) {
      var v = lagVectors(table, xf, yf, k);
      out.push({ lag: k, n: v.n, r: v.n >= 8 ? pearson(v.xs, v.ys) : null });
    }
    return out;
  }

  /* GRANGER. Does X's past improve the prediction of Y beyond Y's own past?

     Restricted:   Y_t ~ Y_{t-1..t-L}
     Unrestricted: Y_t ~ Y_{t-1..t-L} + X_{t-1..t-L}
     F = ((RSSr - RSSu)/L) / (RSSu/(n - 2L - 1))

     Controlling for Y's own history is what separates this from "yesterday's
     X correlates with today's Y" — which any two autocorrelated series will
     do to each other for free. Rows are built only from runs of genuinely
     consecutive calendar days. */
  function granger(table, xf, yf, lag) {
    var L = lag == null ? 1 : lag;
    var idx = {};
    Object.keys(table).forEach(function (k) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k)) idx[dayNum(k)] = table[k];
    });
    var nums = Object.keys(idx).map(Number).sort(function (a, b) { return a - b; });
    var y = [], yl = [], xl = [], i, j;
    for (i = 0; i < L; i++) { yl.push([]); xl.push([]); }
    for (i = 0; i < nums.length; i++) {
      var t = nums[i], okRun = true, row = idx[t];
      var yv = row && row[yf];
      if (typeof yv !== 'number' || !isFinite(yv)) continue;
      var yls = [], xls = [];
      for (j = 1; j <= L; j++) {
        var prev = idx[t - j];
        if (!prev) { okRun = false; break; }
        var pv = prev[yf], px = prev[xf];
        if (typeof pv !== 'number' || !isFinite(pv) ||
            typeof px !== 'number' || !isFinite(px)) { okRun = false; break; }
        yls.push(pv); xls.push(px);
      }
      if (!okRun) continue;
      y.push(yv);
      for (j = 0; j < L; j++) { yl[j].push(yls[j]); xl[j].push(xls[j]); }
    }
    var n = y.length;
    var need = Math.max(12, 4 * (2 * L + 1));
    if (n < need) return { ready: false, n: n, need: need, lag: L };
    var Xr = withIntercept(yl, n);
    var Xu = withIntercept(yl.concat(xl), n);
    var fr = ols(Xr, y), fu = ols(Xu, y);
    if (!fr || !fu) return { ready: false, n: n, need: need, lag: L };
    var dfd = n - (2 * L + 1);
    if (dfd < 1 || fu.rss <= 0) return { ready: false, n: n, need: need, lag: L };
    var F = ((fr.rss - fu.rss) / L) / (fu.rss / dfd);
    if (!(F > 0)) F = 0;
    return {
      ready: true, n: n, lag: L, F: F, df1: L, df2: dfd,
      p: F > 0 ? fP(F, L, dfd) : 1,
      /* How much of what Y's own history left unexplained X accounts for. */
      gain: fr.rss > 0 ? Math.max(0, (fr.rss - fu.rss) / fr.rss) : 0
    };
  }

  /* ── rung 4: is it one day ──────────────────────────────────────────
     Refit n times, each time without one day. The largest swing in r is the
     answer to "how much of this is a single Tuesday". A finding whose sign
     depends on one row is not a finding. */
  function leaveOneOut(days, xs, ys) {
    var n = xs.length;
    if (n < 6) return null;
    var full = pearson(xs, ys);
    if (full == null) return null;
    var worst = null, minR = full, maxR = full;
    for (var i = 0; i < n; i++) {
      var a = xs.slice(0, i).concat(xs.slice(i + 1));
      var b = ys.slice(0, i).concat(ys.slice(i + 1));
      var r = pearson(a, b);
      if (r == null) continue;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      var d = Math.abs(r - full);
      if (!worst || d > worst.delta) worst = { day: days[i], r: r, delta: d };
    }
    if (!worst) return null;
    return {
      full: full, worst: worst, min: minR, max: maxR,
      /* Three ways to fail. The sign flips without one day; the whole thing
         drops under the noise floor without it; or one day moves r by a large
         share of its own size — which is the case the first two miss, because
         r = 1.00 collapsing to r = 0.41 is still "strong" at both ends and is
         still one row doing all the work. The relative threshold has a floor
         under it so a coefficient near zero is not called fragile for
         wobbling in the third decimal. */
      flips: (minR < 0 && maxR > 0),
      swing: worst.delta,
      fragile: Math.min(Math.abs(minR), Math.abs(maxR)) < 0.15 ||
               (minR < 0 && maxR > 0) ||
               worst.delta > Math.max(0.15, 0.4 * Math.abs(full))
    };
  }

  /* First differences. Two series that both drift upward over a term will
     correlate whatever else is true of them; day-to-day CHANGES moving
     together is a far stronger claim, and one that no shared trend can fake.
     Only consecutive calendar days contribute. */
  function differenced(table, xf, yf) {
    var idx = {};
    Object.keys(table).forEach(function (k) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k)) idx[dayNum(k)] = table[k];
    });
    var nums = Object.keys(idx).map(Number).sort(function (a, b) { return a - b; });
    var dx = [], dy = [];
    for (var i = 0; i < nums.length; i++) {
      var a = idx[nums[i] - 1], b = idx[nums[i]];
      if (!a || !b) continue;
      var x0 = a[xf], x1 = b[xf], y0 = a[yf], y1 = b[yf];
      if ([x0, x1, y0, y1].some(function (v) { return typeof v !== 'number' || !isFinite(v); })) continue;
      dx.push(x1 - x0); dy.push(y1 - y0);
    }
    if (dx.length < 8) return { ready: false, n: dx.length };
    var t = corrTest(dx, dy);
    t.ready = true;
    return t;
  }

  /* A binary measure — trained or not, reviewed or not — deserves a contrast
     rather than a correlation coefficient nobody can picture. Welch, because
     there is no reason the two groups should have equal variance, and Hedges'
     g rather than Cohen's d because n is small enough for the bias to matter. */
  function contrast(xs, ys) {
    var levels = {};
    xs.forEach(function (v) { levels[v] = 1; });
    var ks = Object.keys(levels).map(Number).sort(function (a, b) { return a - b; });
    if (ks.length !== 2) return null;
    var g0 = [], g1 = [];
    for (var i = 0; i < xs.length; i++) (xs[i] === ks[0] ? g0 : g1).push(ys[i]);
    if (g0.length < 3 || g1.length < 3) return null;
    function varOf(v) {
      var m = mean(v), s = 0;
      for (var i = 0; i < v.length; i++) s += (v[i] - m) * (v[i] - m);
      return s / (v.length - 1);
    }
    var m0 = mean(g0), m1 = mean(g1), v0 = varOf(g0), v1 = varOf(g1);
    var n0 = g0.length, n1 = g1.length;
    var se = Math.sqrt(v0 / n0 + v1 / n1);
    if (!(se > 0)) return null;
    var t = (m1 - m0) / se;
    /* Welch-Satterthwaite. */
    var df = Math.pow(v0 / n0 + v1 / n1, 2) /
             (Math.pow(v0 / n0, 2) / (n0 - 1) + Math.pow(v1 / n1, 2) / (n1 - 1));
    var sp = Math.sqrt(((n0 - 1) * v0 + (n1 - 1) * v1) / (n0 + n1 - 2));
    var d = sp > 0 ? (m1 - m0) / sp : null;
    var g = d == null ? null : d * (1 - 3 / (4 * (n0 + n1) - 9));
    return {
      lo: ks[0], hi: ks[1], n0: n0, n1: n1, m0: m0, m1: m1,
      diff: m1 - m0, t: t, df: df, p: tP(t, df), g: g
    };
  }

  /* ── Benjamini-Hochberg ─────────────────────────────────────────────
     The matrix asks up to 36 questions at once. At α = .05 that is nearly two
     false findings expected per screen from pure noise, and the page ranks by
     |r| — which is to say it selects for exactly the cells noise inflates.
     BH controls the false discovery rate: of what survives, the expected
     share of nonsense is the level, not the per-test rate. Bonferroni would
     be defensible and would also report nothing, ever, at this n. */
  function bh(ps) {
    var idx = ps.map(function (p, i) { return { p: p, i: i }; })
                .filter(function (o) { return o.p != null && isFinite(o.p); });
    idx.sort(function (a, b) { return a.p - b.p; });
    var m = idx.length, q = new Array(ps.length).fill(null), prev = 1;
    for (var j = m - 1; j >= 0; j--) {
      var v = Math.min(prev, idx[j].p * m / (j + 1));
      prev = v;
      q[idx[j].i] = Math.min(1, v);
    }
    return q;
  }

  /* ── the workup ─────────────────────────────────────────────────────
     One pair, all four rungs, plus a verdict that says what the numbers
     licence and nothing beyond it. */

  var SYNTH = {
    __weekend: { label: 'the weekend', of: function (num) { return isWeekend(num); } },
    __time:    { label: 'elapsed time', of: function (num) { return num; } }
  };

  /* Candidate confounders: every other measure with enough overlap, plus the
     weekend and the passage of time. Ranked by how much each one shrinks the
     correlation when held constant. */
  function confounders(table, xf, yf, opts) {
    opts = opts || {};
    var exclude = {};
    (opts.exclude || []).forEach(function (f) { exclude[f] = 1; });
    exclude[xf] = 1; exclude[yf] = 1;

    var base = align(table, [xf, yf]);
    if (base.n < 10) return { ready: false, n: base.n, tested: [] };
    var r0 = pearson(base.v[xf], base.v[yf]);
    if (r0 == null) return { ready: false, n: base.n, tested: [] };

    var seen = {};
    Object.keys(table).forEach(function (k) {
      Object.keys(table[k]).forEach(function (f) { seen[f] = 1; });
    });
    var cands = Object.keys(seen).filter(function (f) { return !exclude[f]; });

    var tested = [];
    cands.forEach(function (zf) {
      var a = align(table, [xf, yf, zf]);
      /* Controlling on a covariate that is only present for a third of the
         pair's days answers a different question on a different sample. */
      if (a.n < 10 || a.n < base.n * 0.6) return;
      var rSame = pearson(a.v[xf], a.v[yf]);
      var pc = partial(a.v[xf], a.v[yf], [a.v[zf]]);
      if (!pc || rSame == null) return;
      tested.push({
        field: zf, n: a.n, rBefore: rSame, rAfter: pc.r, p: pc.p,
        drop: Math.abs(rSame) > 1e-9 ? 1 - Math.abs(pc.r) / Math.abs(rSame) : 0
      });
    });

    /* The two the table does not store. Both are computed from the date, so
       they are always available and — for a life measured in weekdays and
       terms — usually the first thing to rule out. */
    Object.keys(SYNTH).forEach(function (zf) {
      var col = base.days.map(function (k) { return SYNTH[zf].of(dayNum(k)); });
      var uniq = {};
      col.forEach(function (v) { uniq[v] = 1; });
      if (Object.keys(uniq).length < 2) return;
      var pc = partial(base.v[xf], base.v[yf], [col]);
      if (!pc) return;
      tested.push({
        field: zf, synthetic: true, n: base.n, rBefore: r0, rAfter: pc.r, p: pc.p,
        drop: Math.abs(r0) > 1e-9 ? 1 - Math.abs(pc.r) / Math.abs(r0) : 0
      });
    });

    tested.sort(function (a, b) { return b.drop - a.drop; });

    /* Hold the worst offenders constant all at once. Capped at three: every
       control costs a degree of freedom, and a 25-day table cannot afford a
       fourth. */
    var pick = tested.filter(function (t) { return t.drop > 0.2; }).slice(0, 3);
    var joint = null;
    if (pick.length) {
      var fields = pick.filter(function (t) { return !t.synthetic; })
                       .map(function (t) { return t.field; });
      var a2 = align(table, [xf, yf].concat(fields));
      if (a2.n >= 10 + pick.length) {
        var cols = fields.map(function (f) { return a2.v[f]; });
        pick.filter(function (t) { return t.synthetic; }).forEach(function (t) {
          cols.push(a2.days.map(function (k) { return SYNTH[t.field].of(dayNum(k)); }));
        });
        var rSame2 = pearson(a2.v[xf], a2.v[yf]);
        var pj = partial(a2.v[xf], a2.v[yf], cols);
        if (pj && rSame2 != null) {
          joint = { fields: pick.map(function (t) { return t.field; }),
                    n: a2.n, rBefore: rSame2, r: pj.r, p: pj.p, df: pj.df,
                    drop: Math.abs(rSame2) > 1e-9 ? 1 - Math.abs(pj.r) / Math.abs(rSame2) : 0 };
        }
      }
    }

    return { ready: true, n: base.n, r0: r0, tested: tested, worst: tested[0] || null, joint: joint };
  }

  function labelFor(f) {
    if (SYNTH[f]) return SYNTH[f].label;
    var L = w.CTTrendLabels;
    return (L && L[f]) || f;
  }

  function analyse(xf, yf, opts) {
    opts = opts || {};
    var table = opts.table || (w.CTFacts ? w.CTFacts.all() : {});
    var floor = opts.floor == null ? 8 : opts.floor;

    var a = align(table, [xf, yf]);
    var out = { x: xf, y: yf, n: a.n, ready: a.n >= floor, days: a.days };
    if (!out.ready) {
      out.verdict = {
        level: 'thin',
        headline: 'Not enough paired days to say anything.',
        detail: a.n + ' day' + (a.n === 1 ? '' : 's') + ' where both were logged; ' +
                floor + ' is the floor.'
      };
      return out;
    }

    var xs = a.v[xf], ys = a.v[yf];
    out.base = corrTest(xs, ys);
    out.base.q = opts.q == null ? null : opts.q;   // FDR-corrected, supplied by the caller
    out.diff = differenced(table, xf, yf);
    out.loo = leaveOneOut(a.days, xs, ys);
    out.confound = confounders(table, xf, yf, opts);
    out.lags = crossLags(table, xf, yf, 3);
    out.granger = {
      xy: granger(table, xf, yf, 1),   // does X's past predict Y
      yx: granger(table, yf, xf, 1)    // and the other way
    };
    out.contrast = contrast(xs, ys);
    if (!out.contrast) {
      var flip = contrast(ys, xs);
      if (flip) { flip.swapped = true; out.contrast = flip; }
    }

    /* The lead-lag asymmetry, read off the lag scan. */
    var fwd = out.lags.filter(function (l) { return l.lag === 1; })[0];
    var rev = out.lags.filter(function (l) { return l.lag === -1; })[0];
    out.lead = { fwd: fwd, rev: rev };

    out.verdict = verdictFor(out);
    return out;
  }

  /* Which way the clock points, if it points. Granger clearing in exactly one
     direction is the strongest claim this data can support: X's history helps
     predict Y beyond Y's own history, and Y's does not return the favour. */
  function direction(o) {
    var gxy = o.granger.xy, gyx = o.granger.yx;
    var xSig = gxy.ready && gxy.p != null && gxy.p < 0.05;
    var ySig = gyx.ready && gyx.p != null && gyx.p < 0.05;
    var xLeads = xSig && !ySig, yLeads = ySig && !xSig;
    /* A reverse test that lands at p = 0.08 has not cleared, but it has not
       been ruled out either. An earlier version demanded p > 0.1 before it
       would name a direction, which left a dead zone: a pair with
       overwhelming evidence one way and a borderline reading the other got
       NO verdict at all and fell through to "consistent with chance" — the
       single most misleading thing the page could say about it. The
       direction is named, and the hedge is carried in `clean` for the
       sentence to own. */
    var rev = xLeads ? gyx : yLeads ? gxy : null;
    var clean = !rev || !rev.ready || rev.p == null || rev.p > 0.1;
    var both = xSig && ySig;
    return { xLeads: xLeads, yLeads: yLeads, both: both, clean: clean,
             gxy: gxy, gyx: gyx, rev: rev,
             g: xLeads ? gxy : yLeads ? gyx : null };
  }

  /* The sentence at the end. It is written to be able to say "no" — most of
     its branches are refusals, which is the correct shape for this. */
  function verdictFor(o) {
    var b = o.base, X = labelFor(o.x), Y = labelFor(o.y);
    if (!b || b.r == null) {
      return { level: 'none', headline: 'No relationship to test.',
               detail: 'One of the two never varies over these days.' };
    }
    var sig = b.p != null && b.p < 0.05;
    var survives = b.q == null ? sig : b.q < 0.1;
    var dir = direction(o);
    b.stat = function () {
      return 'r = ' + fmt(b.r) + ' (p = ' + fmtP(b.p) + ')' +
             (b.ci ? ', 95% CI ' + fmt(b.ci[0]) + ' to ' + fmt(b.ci[1]) : '') +
             ' over ' + b.n + ' days, ' + b.nEff + ' of them effective.';
    };

    /* An effect that takes a day to arrive has NO same-day correlation — a bad
       night showing up in tomorrow's study is invisible at lag zero. Reading
       rung 1 as "no same-day r, therefore nothing" would throw away precisely
       the findings worth having, so the lag evidence is consulted before the
       pair is dismissed. */
    if (!sig) {
      if (dir.xLeads || dir.yLeads) {
        var lc = dir.xLeads ? X : Y, le = dir.xLeads ? Y : X;
        return {
          level: 'lagged',
          headline: lc + ' shows up in the next day\'s ' + le + '.',
          detail: 'Nothing on the same day (r = ' + fmt(b.r) + ', p = ' + fmtP(b.p) +
                  '), but yesterday\'s ' + lc + ' predicts today\'s ' + le +
                  ' beyond what ' + le + '\'s own history gives (F = ' +
                  dir.g.F.toFixed(2) + ', p = ' + fmtP(dir.g.p) + '), and ' +
                  (dir.clean ? 'not the reverse'
                             : 'the reverse test does not clear either, though at p = ' +
                               fmtP(dir.rev.p) + ' it is close enough to be worth watching') +
                  '. This is one extra test on a pair you chose, so it has ' +
                  'not been through the screen the matrix findings have.'
        };
      }
      return {
        level: 'noise', headline: 'Consistent with chance.',
        detail: 'r = ' + fmt(b.r) + ', but p = ' + fmtP(b.p) + ' on ' + b.nEff +
                ' effective days — and nothing at a one-day lag either. At this ' +
                'sample size an r of this size turns up in noise often enough that ' +
                'it is not evidence of anything.'
      };
    }
    if (!survives) {
      return {
        level: 'unscreened', headline: 'Real-looking, but not after correction.',
        detail: 'p = ' + fmtP(b.p) + ' on its own; q = ' + fmtP(b.q) +
                ' once every other pair on screen is counted. Something had to be ' +
                'the largest of thirty-odd coefficients.'
      };
    }

    var c = o.confound;
    if (c && c.ready) {
      var worst = c.joint && c.joint.drop > (c.worst ? c.worst.drop : 0) ? c.joint : c.worst;
      var wr = c.joint ? c.joint.r : (c.worst ? c.worst.rAfter : null);
      var wp = c.joint ? c.joint.p : (c.worst ? c.worst.p : null);
      var wname = c.joint ? c.joint.fields.map(labelFor).join(' and ')
                          : (c.worst ? labelFor(c.worst.field) : null);
      if (wname != null && wr != null && (Math.abs(wr) < 0.15 || (wp != null && wp > 0.1))) {
        return {
          level: 'confounded',
          headline: 'This is ' + wname + ', not ' + X + '.',
          detail: 'Holding ' + wname + ' constant takes r from ' + fmt(b.r) + ' to ' +
                  fmt(wr) + ' (p = ' + fmtP(wp) + '). The two move together because ' +
                  'they both follow something else.'
        };
      }
    }

    if (o.loo && o.loo.fragile) {
      return {
        level: 'fragile',
        headline: 'One day is carrying this.',
        detail: 'Drop ' + o.loo.worst.day + ' and r goes from ' + fmt(o.loo.full) +
                ' to ' + fmt(o.loo.worst.r) + '. Over the whole leave-one-out sweep it ' +
                'ranges ' + fmt(o.loo.min) + ' to ' + fmt(o.loo.max) + '. Log more days ' +
                'before believing it.'
      };
    }

    /* Direction, if the clock has an opinion. */
    if (dir.xLeads || dir.yLeads) {
      var cause = dir.xLeads ? X : Y, effect = dir.xLeads ? Y : X;
      var g = dir.g;
      return {
        level: 'directional',
        headline: cause + ' comes first.',
        detail: 'Yesterday\'s ' + cause + ' improves the prediction of today\'s ' +
                effect + ' beyond what ' + effect + '\'s own history gives ' +
                '(F = ' + g.F.toFixed(2) + ' on ' + g.df1 + ' and ' + g.df2 +
                ' df, p = ' + fmtP(g.p) + ')' +
                (dir.clean ? ', and not the other way round. '
                           : '. The reverse does not clear either, but at p = ' +
                             fmtP(dir.rev.p) + ' it is not comfortably ruled out. ') +
                'That is precedence, not proof — but it is the one direction ' +
                'the data can speak to.'
      };
    }
    if (dir.both) {
      return {
        level: 'loop',
        headline: 'Each one predicts the other.',
        detail: 'Both directions clear the F-test, which is what a feedback loop ' +
                'looks like — and also what a shared driver on a one-day lag looks ' +
                'like. Nothing here separates them.'
      };
    }

    var dd = o.diff && o.diff.ready && o.diff.r != null && o.diff.p != null && o.diff.p < 0.05;
    var tried = c && c.ready ? c.tested.length : 0;
    var timed = o.granger.xy.ready || o.granger.yx.ready;
    var stat = b.stat();

    /* The rung that never ran must not be reported as a rung that passed.
       An earlier version printed "it survives every control tried" on a
       nine-day table where NO control could be tried — every candidate
       failed the overlap guard — and "the timing cannot say" where the
       timing had not been asked. A correlation with the checks skipped is a
       correlation, and should read as one. */
    if (!tried && !timed) {
      return {
        level: 'bare',
        headline: 'Real, but nothing has been ruled out.',
        detail: stat + ' Nothing else is logged on enough of the same days to ' +
                'hold constant, and there are not enough runs of consecutive days ' +
                'to ask which comes first. So: a correlation, and only that. ' +
                'The checks that would make it more than that need more days.'
      };
    }
    return {
      level: 'linked',
      headline: tried ? 'Real, and not obviously a third thing.'
                      : 'Real, and no direction to it.',
      detail: stat +
              (tried ? ' It survives all ' + tried + ' control' +
                       (tried === 1 ? '' : 's') + ' that could be tried'
                     : ' Nothing else is logged on enough of the same days to hold ' +
                       'constant, so it has not been screened for a third variable') +
              (dd ? ', and it holds on day-to-day changes as well as on levels' : '') +
              '. ' + (timed
                ? 'Which way it runs, the timing cannot say — the two move the same day.'
                : 'There are not enough consecutive days to ask which comes first.')
    };
  }

  function fmt(r) { return r == null ? '—' : (r > 0 ? '+' : '') + r.toFixed(2); }
  function fmtP(p) {
    if (p == null) return '—';
    if (p < 0.001) return '<0.001';
    if (p < 0.01) return p.toFixed(3);
    return p.toFixed(2);
  }

  w.CTCause = {
    analyse: analyse,
    align: align, corrTest: corrTest, partial: partial, ols: ols,
    pearson: pearson, spearman: spearman, ranks: ranks,
    granger: granger, crossLags: crossLags, differenced: differenced,
    lagVectors: lagVectors, lagTest: lagTest, lagScreen: lagScreen,
    leaveOneOut: leaveOneOut, confounders: confounders, contrast: contrast,
    direction: direction,
    effectiveN: effectiveN, ac1: ac1, bh: bh,
    tP: tP, fP: fP, ibeta: ibeta, lgamma: lgamma,
    dayNum: dayNum, dayKey: dayKey, isWeekend: isWeekend,
    fmt: fmt, fmtP: fmtP, SYNTH: SYNTH, labelFor: labelFor
  };
})(typeof window !== 'undefined' ? window : this);
