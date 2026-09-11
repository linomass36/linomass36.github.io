/* ─────────────────────────────────────────────────────────────
   guide-current.test.js — the Guide cannot fall behind the hub.

   Run with `node tools/guide-current.test.js` from the repo root. Also run
   by the deploy.

   WHY THIS EXISTS. Guide.html generates its list of places from sitemap.js,
   which is what stops that list going stale. Everything else on the page is
   written by hand — and a hand-written description is exactly the thing that
   goes quietly wrong, because nothing breaks when it does. Four panels were
   added to the hub in one sitting and the Guide did not mention that money
   had currencies, that two documents were published unedited, or that the
   figure at the top of Debt had started coming from somewhere real.

   So: every destination and every panel the site map declares has to appear
   on the Guide, either in the generated list or in its prose. A new panel
   that nobody described fails the deploy rather than shipping unmentioned.

   WHAT THIS DOES NOT CHECK is whether the prose is any good, or true. It
   checks that the words exist. Keeping them honest is the commit's job —
   see CLAUDE.md.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function sitemap() {
  const ctx = { window: {}, console, JSON, Object, Array, String, RegExp, Date, Math };
  ctx.globalThis = ctx; ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('sitemap.js'), ctx, { filename: 'sitemap.js' });
  return ctx.window.SITEMAP;
}

const S = sitemap();
const guide = read('Guide.html');
/* The generated list is built from sitemap.js at runtime, so a destination
   named only there still counts as covered. Prose is matched against the
   rendered words, not the markup. */
const text = guide.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const generated = /SITEMAP|byDestination\(\)/.test(guide);

/* ── 1. the generated list still generates ─────────────────────────────── */
group('The list of places is still generated, not typed');

ok(generated, 'Guide.html builds its places list from the site map');
ok(/panels/.test(guide), 'and prints each destination\'s panel names');

/* If that ever turns into a hardcoded list, this whole file is the only
   thing standing between the Guide and a decade of drift.

   The Guide's own name is exempt: this page IS the "guide" destination, so
   its <h1> and its footer say "The Guide" for the same reason every page
   carries its own title. Every OTHER destination naming itself in the markup
   would mean the list had been typed out. */
const destNames = S.destinations()
  .filter((d) => d.id !== 'guide')
  .map((d) => d.name);
const hardcoded = destNames.filter((n) => guide.includes('>' + n + '<'));
ok(hardcoded.length === 0,
   'no destination other than this page names itself in the markup' +
   (hardcoded.length ? ' — found ' + hardcoded.join(', ') : ''));

/* ── 2. every destination lands somewhere the Guide can reach ──────────── */
group('Every destination is reachable from the Guide');

const dests = S.destinations();
ok(dests.length >= 9, 'the site map declares ' + dests.length + ' destinations');

const unreachable = dests.filter((d) => !d.lands);
ok(unreachable.length === 0,
   'each one lands on a page' +
   (unreachable.length ? ' — ' + unreachable.map((d) => d.id).join(', ') : ''));

/* ── 3. a panel that changes what a page DOES gets described ───────────── */
group('Panels that carry their own subject are described in the prose');

/* Not every panel needs a paragraph — "Log" and "Trends" are self-evident
   from their names in the generated list. These are the ones that introduce
   a concept the list alone does not explain, and each is paired with a word
   that has to appear somewhere on the page. Adding a panel like this without
   a line about it is the failure being prevented. */
const NEEDS_PROSE = [
  { panel: 'Source',      word: 'source document',
    why: 'two plans are published unedited and corrected elsewhere' },
  { panel: 'School year', word: 'School year',
    why: 'a second money page answering a different question from Debt' },
  { panel: 'Net worth',   word: 'net worth',
    why: 'one place records it and everything else reads that' },
  { panel: 'Debt',        word: 'Debt',
    why: 'the fifteen-year model, as against the nine-month one' },
  { panel: 'Wait',        word: 'waking hours',
    why: 'a gate whose elapsed figure is in her hours, not in days' }
];

const allPanels = [];
dests.forEach((d) => {
  (S.panelsOf(d.id) || []).forEach((p) => {
    if (allPanels.indexOf(p.panel) < 0) allPanels.push(p.panel);
  });
});

NEEDS_PROSE.forEach((n) => {
  if (allPanels.indexOf(n.panel) < 0) {
    ok(true, '"' + n.panel + '" is no longer a panel — nothing to describe');
    return;
  }
  ok(new RegExp(n.word, 'i').test(text),
     'the Guide explains "' + n.panel + '" — ' + n.why);
});

/* ── 4. the money model, which is what went wrong ──────────────────────── */
group('The money model is written down');

[
  ['currency', 'that amounts carry a currency'],
  ['rate', 'that rates are typed by hand and dated'],
  ['Cushion', 'what the Cushion pot is'],
  ['Nest', 'what the Nest pot is']
].forEach(([word, what]) => {
  ok(new RegExp(word, 'i').test(text), 'the Guide says ' + what);
});

/* ── 5. the rule that keeps this page true is on the page ──────────────── */
group('The standing rule is stated where it will be read');

ok(/updated with every change/i.test(text),
   'the Guide states that it is updated with every change');
ok(/CLAUDE\.md/.test(text), 'and points at the convention file');
ok(fs.existsSync(path.join(ROOT, 'CLAUDE.md')), 'which exists');

const claude = fs.existsSync(path.join(ROOT, 'CLAUDE.md')) ? read('CLAUDE.md') : '';
ok(/Guide\.html/.test(claude), 'CLAUDE.md names Guide.html as something a change must update');
ok(/guide-current\.test\.js/.test(claude), 'and names this check, so the rule has teeth');

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
