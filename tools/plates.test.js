/* ─────────────────────────────────────────────────────────────
   plates.test.js — the pictures rotate, and everybody gets a turn.

   Run with `node tools/plates.test.js` from the repo root.

   Thirty public-domain plates shipped and six slots named ten of them, so
   twenty were on the site and never on a page. The six that were shown never
   changed, which is the same as wallpaper — and wallpaper stops being looked
   at inside a week.

   The rotation has to be three things at once, and they pull against each
   other: stable within a day (a picture that changes on every render cannot
   be looked at), different on every page (or the whole site is one painting
   a day), and a rotation rather than a draw (random-with-replacement shows
   you the same canvas twice in a week and hides another for a month). All
   three, with nothing written to storage, because the answer has to be the
   same on the phone and the laptop.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

function load(today) {
  const doc = { readyState: 'complete', querySelectorAll: () => [], getElementById: () => null,
                addEventListener: () => {}, createElement: () => ({ appendChild() {} }),
                head: { appendChild() {} }, documentElement: null };
  const ctx = { window: {}, document: doc, Image: function () {}, location: { pathname: '/Test.html' },
                fetch: () => Promise.reject(new Error('no network in tests')),
                Promise, Object, Array, String, Math, Number, Date, console, setTimeout,
                MutationObserver: null };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  if (today) ctx.CTDay = { today: () => today };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'plates.js'), 'utf8'), ctx, { filename: 'plates.js' });
  return ctx.window.Plates;
}

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);

const P = load('2026-09-09');
const DAY = Math.floor(Date.parse('2026-09-09T00:00:00Z') / 86400000);

group('A group is a group');
{
  const all = P.inGroup('any'), anat = P.inGroup('anatomy'), pol = P.inGroup('polish');
  ok(all.length === Object.keys(P.catalogue).length, 'everything is in "any" (' + all.length + ')');
  ok(anat.length >= 7 && anat.every(k => P.catalogue[k].group === 'anatomy'),
     'the anatomy group is Maclise and nothing else (' + anat.length + ')');
  ok(pol.every(k => P.catalogue[k].group === 'polish'), 'and the Polish one is Polish');
  const two = P.inGroup('polish american');
  ok(two.length === pol.length + P.inGroup('american').length, 'two groups is both of them');
  ok(P.inGroup('nonsense').length === 0, 'a group nobody has is empty rather than everything');
}

group('The same day gives the same picture');
{
  const a = P.rotation('anatomy', 'plan-foot', DAY)[0];
  const b = P.rotation('anatomy', 'plan-foot', DAY)[0];
  ok(a === b, 'twice on the same day is the same picture (' + a + ')');
  const other = load('2026-09-09').rotation('anatomy', 'plan-foot', DAY)[0];
  ok(other === a, 'and on another device, with nothing shared but the date');
  const at2am = load('2026-09-09');   // day.js puts the boundary at 05:00
  ok(at2am.rotation('anatomy', 'plan-foot')[0] === a,
     'the hub’s day is the day, so 02:00 is still yesterday’s picture');
}

group('A different slot, a different picture');
{
  const day = DAY;
  const slots = ['plan-foot', 'week-foot', 'standing-foot', 'health-foot', 'trends-foot'];
  /* Independent slots, so two pages CAN coincide on a given day — with thirty
     pictures and five pages that is the birthday problem, not a bug. What
     matters is that it is rare, and that it does not persist. */
  let clean = 0;
  for (let d = 0; d < 30; d++) {
    const seen = slots.map(s => P.rotation('any', s, day + d)[0]);
    if (new Set(seen).size === seen.length) clean++;
  }
  ok(clean >= 20, 'on most days five pages show five different pictures (' + clean + '/30)');
  const marg = P.rotation('anatomy', 'plan-margin', day)[0];
  const foot = P.rotation('anatomy', 'plan-foot', day)[0];
  ok(marg !== foot, 'and two slots on one page start from different cards');
}

group('Everyone gets a turn before anyone gets a second');
{
  const pool = P.inGroup('anatomy');
  const seen = {};
  for (let d = 0; d < pool.length; d++) {
    const pick = P.rotation('anatomy', 'plan-foot', DAY + d)[0];
    seen[pick] = (seen[pick] || 0) + 1;
  }
  ok(Object.keys(seen).length === pool.length,
     'over ' + pool.length + ' days every anatomy plate comes round exactly once');
  ok(Object.keys(seen).every(k => seen[k] === 1), 'and none of them twice');

  /* And it holds from ANY starting day, not just from a lucky one — the
     guarantee is about consecutive days, not about a calendar boundary. */
  let worst = 0;
  for (let start = 0; start < 40; start++) {
    const run = [];
    for (let d = 0; d < pool.length; d++) run.push(P.rotation('anatomy', 'plan-foot', DAY + start + d)[0]);
    worst = Math.max(worst, pool.length - new Set(run).size);
  }
  ok(worst === 0, 'and from any starting day at all, over forty of them');

  /* Each slot gets its own order, so two pages do not march in step. */
  const a = [], b = [];
  for (let d = 0; d < pool.length; d++) {
    a.push(P.rotation('anatomy', 'plan-foot', DAY + d)[0]);
    b.push(P.rotation('anatomy', 'health-foot', DAY + d)[0]);
  }
  ok(a.join() !== b.join(), 'two slots run the group in different orders');
}

group('The day turns the picture over');
{
  const runs = ['anatomy', 'polish', 'american'].map(g => {
    let changes = 0;
    for (let d = 1; d < 14; d++) {
      if (P.rotation(g, 'foot', DAY + d)[0] !== P.rotation(g, 'foot', DAY + d - 1)[0]) changes++;
    }
    return changes;
  });
  ok(runs.every(c => c === 13), 'a fortnight is a fortnight of different pictures (' + runs.join(', ') + ')');
}

group('A missing file costs one picture, not the slot');
{
  const list = P.rotation('anatomy', 'plan-foot', DAY);
  ok(list.length === P.inGroup('anatomy').length, 'the whole group is offered, today’s first');
  ok(new Set(list).size === list.length, 'each of them once');
}

group('A picture is a break, not an obstacle');
{
  /* What went wrong on a laptop: a portrait plate sized to the text column
     came out nearly 900px tall, and at browser zoom the margin figure — which
     sits wherever the text needed it, near the top of the Plan — became a
     full-width one. You scrolled past a painting to reach the page. Both
     caps are in the stylesheet plates.js ships, so they are checked here
     rather than left to a screenshot nobody takes again. */
  const css = fs.readFileSync(path.join(ROOT, 'plates.js'), 'utf8');
  const decl = css.slice(css.indexOf('var BREAK_CSS'), css.indexOf('function styleOnce'));
  ok(/--plate-h:clamp\(150px,26vh,300px\)/.test(decl),
     'the height is capped against the viewport, so zoom cannot inflate it');
  ok(/max-height:var\(--plate-h\)/.test(decl), 'and the picture obeys the cap');
  ok(/width:min\(100%,32rem,calc\(var\(--plate-h\) \* var\(--plate-ar-true/.test(decl),
     'the width follows from the height and the picture’s own shape, so nothing is cropped to fit');

  const hub = fs.readFileSync(path.join(ROOT, 'hub.css'), 'utf8');
  const marg = hub.slice(hub.indexOf('.hub-marginal {'), hub.indexOf('.hub-rule-orn'));
  ok(/\.hub-marginal \{ display: none; \}/.test(marg), 'the margin figure is hidden by default');
  ok(/min-width: 1280px/.test(marg), 'and drawn only where there is a margin to draw it in');
  ok(!/max-width: 11\d\dpx/.test(marg),
     'never re-flowed into the body of a narrow page, which is what put a painting at the top of the Plan');

  /* Every page carries one at its foot, so hiding the margin figure costs
     nothing. */
  const pages = fs.readdirSync(ROOT).filter((f) => /\.html$/i.test(f));
  const withMargin = pages.filter((f) => /hub-marginal/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  const alsoBreak = withMargin.filter((f) => /plate-break/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  ok(withMargin.length === alsoBreak.length,
     'every page with a margin figure also has a plate in its flow (' +
     alsoBreak.length + '/' + withMargin.length + ')');
}

console.log(failed ? '\n' + failed + ' FAILED' : '\nall green');
process.exit(failed ? 1 : 0);
