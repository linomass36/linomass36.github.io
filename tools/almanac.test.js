/* ─────────────────────────────────────────────────────────────
   almanac.test.js — the v6.0 front door asks; it does not keep.

   Run with `node tools/almanac.test.js` from the repo root. Also run by the
   deploy.

   WHAT THIS PAGE REPLACED. The Standing asked something of thirteen systems
   every morning, counted what was owed, and turned three quiet days into a
   floor day. When term began none of that fitted, and the hub went unopened
   for a month while one standalone page — Study Control — was the only thing
   in use. The overdue eligibility checks in the plan stopped reaching anyone.

   So the Almanac answers four questions and stops. The ways it can go wrong
   are the ones this repo has already had four times: a page answering a
   question some other file owns, and answering it differently. These checks
   pin that it asks the owners, that its short lists are short for a reason,
   and that the Contents cannot lose a page.

   Every date below is SET, never read (CLAUDE.md).
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function hub(stores, files) {
  const store = Object.assign({}, stores || {});
  const ctx = {
    console, JSON, Object, Array, String, Number, Boolean, RegExp, Date, Math, Intl,
    isNaN, isFinite, parseInt, parseFloat, encodeURIComponent,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      get length() { return Object.keys(store).length; },
      key: (i) => Object.keys(store)[i]
    }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  (files || ['day.js', 'plan-v2-data.js', 'plan-v2.js', 'study-control.js', 'sitemap.js'])
    .forEach((f) => vm.runInContext(read(f), ctx, { filename: f }));
  ctx.__store = store;
  return ctx;
}

const NOW = new Date(2026, 9, 14, 21, 0, 0, 0).getTime();   // Wed 14 Oct 2026, 21:00
const TODAY = '2026-10-14';

/* ── 1. the dates come from the plan, and leave when they are done ─────── */
group('Dates that matter are the plan\'s, in one list');
{
  const c = hub({});
  const D = c.PlanV2.dated(TODAY);
  ok(D.length > 0, 'the plan has dated things to show (' + D.length + ')');
  ok(D.every((x, i) => i === 0 || D[i - 1].date <= x.date), 'oldest first, so overdue comes before upcoming');
  ok(D.some((x) => x.kind === 'item') && D.some((x) => x.kind === 'verify') && D.some((x) => x.kind === 'milestone'),
     'all three kinds are asked: phase items, verification questions, milestones');
  ok(D.filter((x) => x.kind === 'milestone').every((x) => x.date >= TODAY),
     'a milestone already past is not listed, since it cannot be ticked off');
  ok(D.filter((x) => x.late).every((x) => x.date < TODAY) && D.filter((x) => !x.late).every((x) => x.date >= TODAY),
     'late means before the day asked about, and only that');

  const sip = D.find((x) => x.kind === 'verify' && /NIH SIP/.test(x.label));
  ok(sip && sip.late, 'the NIH SIP eligibility question, due 30 September, shows as overdue on 14 October');

  const item = D.find((x) => x.kind === 'item');
  c.PlanV2.setDone(item.id, true);
  ok(!c.PlanV2.dated(TODAY).some((x) => x.id === item.id), 'ticking an item in the plan removes it');

  c.PlanV2.setVerify(sip.n, 'yes, eligible');
  ok(!c.PlanV2.dated(TODAY).some((x) => x.id === sip.id), 'answering a question on the Verify panel removes it');
}

/* ── 2. heads up is three, and only the rules that change what you do ──── */
group('Heads up is short on purpose');
{
  const c = hub({});
  const SC = c.StudyControl, seed = SC.SEED;
  const all = SC.open(seed, NOW), hu = SC.headsUp(seed, NOW);
  ok(all.length > 3, 'the full rule set trips ' + all.length + ' flags on the term as written');
  ok(hu.length === 3, 'the front door shows three of them');
  ok(hu.every((f) => ['R1', 'R2', 'R3', 'R5', 'R8'].indexOf(f.rule) >= 0),
     'and only rules that change what you do next (' + hu.map((f) => f.rule).join(', ') + ')');
  ok(!hu.some((f) => f.rule === 'R5' && !f.assess),
     'prep is a heads-up only for a graded class, not for a seminar');
  ok(hu[0].rule === 'R1' && /67%/.test(hu[0].title), 'the 6/9 histology quiz is first, because it needs a change');

  SC.write(seed, NOW);
  SC.handle(SC.read(), hu[0].id, '', NOW);
  ok(!SC.headsUp(SC.read(), NOW).some((f) => f.id === hu[0].id),
     'marking it done on the front door is the same record Study Control\'s Handled writes');
}

/* ── 3. the page asks, it does not keep ────────────────────────────────── */
group('The Almanac asks the owners');
{
  const src = read('Almanac.html');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ['study-control.js', 'plan-v2.js', 'systems.js', 'training.js', 'sitemap.js', 'hub.css'].forEach((f) =>
    ok(src.indexOf(f) >= 0, 'it loads ' + f));
  ok(!/localStorage\.setItem/.test(code), 'it writes no store of its own — every write goes through an owner');
  ok(!/getItem\(['"]ct_/.test(code), 'and reads no ct_ key directly');
  ok(/SC\.headsUp\(/.test(code) && /PV\.dated\(/.test(code) && /SYS\.all\(/.test(code),
     'heads up, dates and tracker notes are each asked of their owner');
  ok(!/floorDay|drift\(/.test(code), 'it has no floor day and no drift count');
  ok(/SM\.destinations\(\)/.test(code) && /SM\.panelsOf\(/.test(code),
     'the Contents are generated from the site map, not typed');
}

/* ── 4. the Contents cannot lose a page ────────────────────────────────── */
group('Every live page is in the Contents');
{
  const c = hub({}, ['sitemap.js']);
  const S = c.SITEMAP;
  const listed = {};
  S.destinations().forEach((d) => (S.panelsOf(d.id) || []).forEach((p) => { listed[p.file] = 1; }));
  const missing = S.live().filter((f) => !S.isShell(f) && !listed[f]);
  ok(missing.length === 0, 'every live page appears under some destination' +
     (missing.length ? ' — missing: ' + missing.join(', ') : ''));
  ok(listed['Standing.html'] === 1, 'the Standing is still there, as a tab under Home');
  ok((S.destinations().find((d) => d.id === 'home') || {}).lands === 'Almanac.html', 'and Home opens on the Almanac');
}

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
