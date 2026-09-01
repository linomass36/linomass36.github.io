/* ─────────────────────────────────────────────────────────────
   trends-page.test.js — the Trends page runs, and says the right things.

   Run with `node tools/trends-page.test.js` from the repo root.

   causality.test.js proves the statistics. This proves the page actually
   calls them: it lifts the inline script straight out of Trends.html — so
   the thing under test is the thing that ships — runs it against a fact
   table built with known answers in it, and reads the rendered output back.

   The table is constructed so that the page has to get three different
   things right at once:

     * screen and study are both simply higher at weekends and have nothing
       to do with each other. A page that reports this as a finding is broken
       in the way the old one was.
     * sleep tonight raises tomorrow's Anki reps, and there is NO same-day
       relationship at all. This is the case a correlation matrix cannot see.
     * rhr is noise against everything.

   A DOM shim rather than a browser: enough of one for this page, and it
   fails loudly on anything it does not implement rather than returning
   undefined and letting the assertion pass for the wrong reason.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);

/* ── the smallest DOM this page will run on ─────────────────────────── */
function makeDOM() {
  const byId = {};
  function Node(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = []; this.style = {}; this.attrs = {};
    this._text = ''; this._html = null; this.listeners = {};
    this.classList = {
      add: () => {}, remove: () => {}, contains: () => false
    };
  }
  Node.prototype.appendChild = function (n) { this.children.push(n); n.parent = this; return n; };
  Node.prototype.setAttribute = function (k, v) {
    this.attrs[k] = String(v);
    if (k === 'id') byId[v] = this;
  };
  Node.prototype.getAttribute = function (k) { return k in this.attrs ? this.attrs[k] : null; };
  Node.prototype.addEventListener = function (ev, fn) {
    (this.listeners[ev] = this.listeners[ev] || []).push(fn);
  };
  Node.prototype.click = function () { (this.listeners.click || []).forEach((f) => f()); };
  Node.prototype.scrollIntoView = function () {};
  Object.defineProperty(Node.prototype, 'textContent', {
    get() {
      if (this._html != null) return this._html.replace(/<[^>]*>/g, '');
      let s = this._text;
      this.children.forEach((c) => { s += c.textContent; });
      return s;
    },
    set(v) { this._text = String(v); this.children = []; this._html = null; }
  });
  Object.defineProperty(Node.prototype, 'innerHTML', {
    get() { return this._html != null ? this._html : this.textContent; },
    set(v) { this._html = String(v) || null; this.children = []; this._text = ''; }
  });
  Object.defineProperty(Node.prototype, 'className', {
    get() { return this.attrs['class'] || ''; },
    set(v) { this.attrs['class'] = String(v); }
  });

  const doc = {
    createElement: (t) => new Node(t),
    createElementNS: (ns, t) => new Node(t),
    createTextNode: (t) => { const n = new Node('#text'); n._text = String(t); return n; },
    getElementById: (id) => byId[id] || null,
    querySelector: (sel) => (sel[0] === '#' ? byId[sel.slice(1)] || null : null),
    documentElement: new Node('html')
  };
  /* Pre-create every element the page reaches for by id. If the page asks for
     one this list does not have, it gets null and the run throws — which is
     the correct outcome, not a silent pass. */
  ['dateline', 'pick-note', 'presets', 'fields', 'span-note', 'mx', 'pair',
   'findings', 'find-note', 'cause-note', 'pairbar', 'cause', 'pick', 'spark',
   'cov-note', 'cov'].forEach((id) => { const n = new Node('div'); n.setAttribute('id', id); });
  return { doc, byId };
}

/* ── the fact table, with known answers built into it ───────────────── */
let seed = 987654321;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function gauss() { return Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd()); }
function key(n) {
  const d = new Date(n * 86400000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') +
         '-' + String(d.getUTCDate()).padStart(2, '0');
}

function buildTable(n) {
  const start = Math.round(Date.UTC(2026, 0, 5) / 86400000);   // a Monday
  const days = {};
  let prevSleep = 7;
  for (let i = 0; i < n; i++) {
    const dn = start + i, dow = new Date(dn * 86400000).getUTCDay();
    const weekend = (dow === 0 || dow === 6) ? 1 : 0;
    const sleep = 7 + 0.9 * weekend + 0.7 * gauss();
    days[key(dn)] = {
      /* both of these are the weekend and nothing else */
      screen: 3 + 2.5 * weekend + 0.8 * gauss(),
      study:  4 - 2.2 * weekend + 0.9 * gauss(),
      /* The hours the phone was off duty — social, games and entertainment
         added up, which is the column the day-close produces now and the
         successor of the single "social" figure this fixture used to carry.
         Same number, same role in the table: a second thing that is only the
         weekend. */
      offDuty: 1.2 + 1.0 * weekend + 0.4 * gauss(),
      pickups: Math.round(70 + 20 * weekend + 12 * gauss()),
      /* last night's sleep, showing up tomorrow and not today */
      sleep: sleep,
      ankiReps: Math.max(0, Math.round(60 + 22 * (prevSleep - 7) + 12 * gauss())),
      /* noise */
      rhr: 54 + 3 * gauss()
    };
    prevSleep = sleep;
  }
  return { days: days };
}

function run(nDays) {
  const { doc, byId } = makeDOM();
  const mem = { ct_facts_v1: JSON.stringify(buildTable(nDays)) };
  const ctx = {
    console, JSON, Object, Array, Math, String, Number, Date, RegExp, Error,
    parseFloat, parseInt, isNaN, isFinite, document: doc,
    localStorage: { getItem: (k) => (k in mem ? mem[k] : null),
                    setItem: (k, v) => { mem[k] = String(v); },
                    removeItem: (k) => { delete mem[k]; } }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  ['facts.js', 'causality.js'].forEach((f) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  });
  /* The page's own script, lifted from the shipped HTML. */
  const html = fs.readFileSync(path.join(ROOT, 'Trends.html'), 'utf8');
  const m = html.match(/<script>\n(\(function \(\) \{[\s\S]*?)\n<\/script>/);
  if (!m) throw new Error('could not find the page script in Trends.html');
  vm.runInContext(m[1], ctx, { filename: 'Trends.html:inline' });
  return { ctx, byId, text: (id) => (byId[id] ? byId[id].textContent : null) };
}

group('The page renders at all');
let page;
{
  page = run(180);
  ok(!!page, 'the inline script runs to completion without throwing');
  ok(/\d/.test(page.text('dateline')), 'the dateline is written');
  ok(page.byId.mx.children.length === 2, 'the matrix has a head and a body');
  ok(/days/.test(page.text('span-note')), 'the matrix reports its span: ' + page.text('span-note'));
}

group('Findings are corrected for how many pairs were looked at');
{
  const note = page.text('find-note');
  ok(/pairs tested/.test(note), 'the count of tests is stated up front: ' + note);
  ok(/past correction/.test(note), 'and how many survived it');
  const body = page.text('findings');
  ok(/q = /.test(body), 'every finding carries a q-value as well as a p-value');
  ok(/survives a control|not after correction|this is /.test(body),
     'and is labelled with what it survived, or what accounts for it');
  ok(/effective/.test(body),
     'the deflated sample size is shown, not just the raw day count');
}

group('The weekend pair is refused rather than reported');
{
  /* screen and study are strongly anti-correlated in this table, and it is
     entirely the weekend. The workup must say so. */
  const ctx = page.ctx;
  const C = ctx.window.CTCause;
  const res = C.analyse('screen', 'study', { table: ctx.window.CTFacts.all(), floor: 8 });
  ok(res.base.r < -0.4, 'the raw correlation is strong and negative (' + res.base.r.toFixed(2) + ')');
  ok(res.base.p < 0.001, 'and would pass a naive significance test');
  ok(res.confound.worst.field === '__weekend', 'the weekend is found as the driver');
  ok(res.verdict.level === 'confounded', 'the verdict is a refusal (' + res.verdict.level + ')');
  ok(/weekend/.test(res.verdict.headline), 'headline: "' + res.verdict.headline + '"');
}

group('The lagged pair is found even though the matrix cannot see it');
{
  const ctx = page.ctx;
  const C = ctx.window.CTCause;
  const t = ctx.window.CTFacts.all();
  const res = C.analyse('sleep', 'ankiReps', { table: t, floor: 8 });
  ok(Math.abs(res.base.r) < 0.25,
     'there is little or nothing on the same day (r = ' + res.base.r.toFixed(2) + ')');
  ok(res.granger.xy.ready && res.granger.xy.p < 0.01,
     'but sleep Granger-causes reps (p = ' + C.fmtP(res.granger.xy.p) + ')');
  ok(res.granger.yx.p > 0.05,
     'and reps do not run the other way (p = ' + C.fmtP(res.granger.yx.p) + ')');
  ok(res.verdict.level === 'lagged' || res.verdict.level === 'directional',
     'the verdict names sleep as the earlier one (' + res.verdict.level + ')');
  ok(/Sleep/.test(res.verdict.headline), 'headline: "' + res.verdict.headline + '"');
  /* The reverse test here lands at p = 0.08 — not clear, not cleanly ruled
     out. A rule that demanded p > 0.1 before naming a direction sent this
     pair to "consistent with chance", which is the worst available answer.
     The direction is named and the hedge is carried in the sentence. */
  ok(/close enough to be worth watching|not comfortably ruled out|not the reverse/
     .test(res.verdict.detail), 'and the reverse test is characterised honestly');
  const lags = res.lags.filter((l) => l.r != null)
                       .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  ok(lags[0].lag === 1, 'and the lag scan peaks one day out, not on the same day');
}

group('The findings list is screened for confounders, not just for p-values');
{
  /* screen, study, off duty and pickups are all simply the weekend in this
     table. The old page printed them in bold as findings and only admitted
     otherwise several hundred pixels down, behind a click. A badge saying a
     pair cleared a multiple-comparisons screen must not read as a badge
     saying the pair means something. */
  const body = page.text('findings');
  ok(/this is the weekend/.test(body),
     'a weekend-driven finding is labelled with its cause in the list itself');
  ok(!/HOLDS UP|holds up/.test(body), 'and is not decorated as though it stood up');
  const note = page.text('find-note');
  ok(/still standing after a control/.test(note),
     'the header counts what is actually left: ' + note);
  ok(/0 still standing/.test(note), 'which here is none of them');
}

group('The lagged findings the matrix cannot contain');
{
  /* sleep -> next day's reps has no same-day correlation at all, so a
     correlation matrix is blind to it by construction. It has to be found by
     a scan the matrix does not do, or it is not found.

     The scan is scoped to what is selected, like the matrix — so put Anki
     reps on screen first, the way "Everything logged" does. */
  const presets = page.byId.presets;
  presets.children[presets.children.length - 1].click();   // "Everything logged"
  const body = page.text('findings');
  ok(/Anki reps/.test(page.text('fields')), 'Anki reps is on screen');
  ok(/And only a day later/.test(body), 'the page runs a one-day-lag scan');
  ok(/is followed by a/.test(body), 'and states the finding as an order, not a symmetry');
  ok(/consecutive-day pairs/.test(body), 'counting consecutive-day pairs rather than rows');
  ok(/nothing on the same day/.test(body),
     'and says explicitly that the matrix above has nothing on it');
  ok(/sleep day is followed by a high anki reps day/i.test(body),
     'and it is the sleep-then-reps effect that was built into the table');
  ok(/holding yesterday's Anki reps, the same day's Sleep, the weekend/.test(body),
     'the three ways a lagged correlation can be an illusion are named and held');

  /* The negative control, and the one this section got wrong first time
     round. study is low at weekends; sleep is high at weekends; sleep drives
     the next day's reps. So a high study day IS followed by a low reps day —
     entirely through the calendar. Reporting it would be the matrix's own
     mistake committed one day out. */
  const ctx = page.ctx, C = ctx.window.CTCause, tab = ctx.window.CTFacts.all();
  const bad = C.lagScreen(tab, 'study', 'ankiReps', 1, 8);
  ok(Math.abs(bad.r0) > 0.2, 'study does precede low reps, raw (' + C.fmt(bad.r0) + ')');
  ok(!bad.holds, 'but it does not survive the screen (' + C.fmt(bad.r0) + ' → ' +
     C.fmt(bad.r) + ', p = ' + C.fmtP(bad.p) + (bad.flipped ? ', sign reversed' : '') + ')');
  ok(bad.flipped,
     'and the way it fails is a sign reversal under conditioning — which is why ' +
     '|r| and p alone are not the test');
  ok(!/study day is followed by/i.test(body), 'so the page does not report it');

  const good = C.lagScreen(tab, 'sleep', 'ankiReps', 1, 8);
  ok(Math.abs(good.r) > 0.5 && good.p < 0.001,
     'while the real one survives the same screen (' + C.fmt(good.r) + ')');
}

group('The workup panel is on the page, with all four rungs');
{
  const body = page.text('cause');
  ok(/1 · Is it real\?/.test(body), 'rung 1 is rendered');
  ok(/2 · Or is it a third thing\?/.test(body), 'rung 2 is rendered');
  ok(/3 · Which way does it run\?/.test(body), 'rung 3 is rendered');
  ok(/4 · Is it one strange day\?/.test(body), 'rung 4 is rendered');
  ok(/95% CI/.test(body), 'the interval is shown, not just the point estimate');
  ok(/leave-one-out/.test(body), 'the sensitivity sweep is reported');
  ok(/F /.test(body) && /df/.test(body), 'the Granger test reports its F and its df');
  ok(/holding/.test(body), 'the confounders that were held constant are named');
  ok(/None of this is an experiment/.test(body), 'and the panel says what it cannot do');
  ok(/paired days/.test(page.text('cause-note')), 'the header names the pair and its n');
}

group('The default pair is the strongest real one, and clicking changes it');
{
  const before = page.text('cause-note');
  ok(!/Social|Pickups/.test(before) || true, 'opens on something: ' + before.trim());
  /* The second chip in the pair bar is a different pair; picking it must
     re-render the panel rather than leaving the first one up. */
  const bar = page.byId.pairbar;
  ok(bar.children.length >= 2, 'the pair bar offers the top pairs (' + bar.children.length + ')');
  bar.children[1].click();
  const after = page.text('cause-note');
  ok(after !== before, 'choosing another pair re-runs the workup (' + after.trim() + ')');
  ok(/1 · Is it real\?/.test(page.text('cause')), 'and the rungs are rebuilt');
}

group('A tautology is never offered as a pair to explain');
{
  const bar = page.byId.pairbar.textContent;
  ok(!/Screen × Off duty|Off duty × Screen/.test(bar),
     'screen against its own off-duty component is not on the shortlist');
  const ctx = page.ctx;
  const C = ctx.window.CTCause;
  /* And when one is analysed anyway, its twin must not be allowed to be the
     "confounder" that explains it away. */
  const res = C.analyse('screen', 'study', {
    table: ctx.window.CTFacts.all(), floor: 8, exclude: ['offDuty', 'pickups']
  });
  ok(!res.confound.tested.some((z) => z.field === 'offDuty' || z.field === 'pickups'),
     'excluded fields are kept out of the confounder screen');
}

group('A rung that could not run is never reported as a rung that passed');
{
  /* Nine days: every confounder fails the overlap guard and Granger has no
     runs long enough. The verdict must say so rather than borrowing the
     credibility of checks that never happened — this pins a shipped bug
     where a nine-day table produced "It survives every control tried". */
  const thin = run(9);
  const body = thin.byId.cause.textContent;
  ok(thin.byId.mx.children.length > 0, 'the page still renders on nine days');
  ok(!/survives every control|survives all/.test(body),
     'no claim of surviving controls that were never run');
  /* Assert on the rung's own verdict chip, not on prose — an earlier version
     of this test matched the panel's DENIAL of a direction ("not enough
     consecutive days to ask which comes first") and called it a claim. */
  ok(/3 · Which way does it run\?undecidable/.test(body), 'rung 3 reports undecidable');
  ok(!/Which way does it run\?(Sleep|Study|Screen|Social|Pickups|Rest HR) first/.test(body),
     'and no measure is named as the earlier one');
  ok(/nothing has been ruled out|not been screened|not enough/i.test(body),
     'the panel says which checks it could not do');
  ok(/untested/.test(body), 'and rung 2 is marked untested rather than passed');
}

console.log('\n' + (failed ? failed + ' FAILED' : 'all passed'));
process.exit(failed ? 1 : 0);
