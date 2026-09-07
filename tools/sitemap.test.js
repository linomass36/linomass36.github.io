/* ─────────────────────────────────────────────────────────────
   sitemap.test.js — the map matches the repo, and nothing live points
   at an archived page.

   Run with `node tools/sitemap.test.js` from the repo root. Also run by the
   deploy, because these are exactly the checks that were missing: five files
   each kept their own copy of the site map, they drifted, and the drift was
   only ever found by clicking a link and landing somewhere retired.

   Three tripwires:

     1. Every .html in the repo is declared in sitemap.js, and every page
        sitemap.js declares exists. A page nobody declared is a page the
        drawer cannot show and the deploy cannot check.
     2. No live page links to a page marked archived. This is the one that
        would have caught Mission Control's eight links into the v1 plan and
        the two archived hrefs on the Standing's own board.
     3. Every live page can be walked back to the front door, so nothing is
        reachable-but-inescapable.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

function load(file) {
  const ctx = { window: {}, console, JSON, Object, Array, String, RegExp, Date, Math };
  ctx.globalThis = ctx; ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
  return ctx.window;
}

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);

const S = load('sitemap.js').SITEMAP;

/* The .md files are rendered to .html at deploy time, so they count as pages. */
const onDisk = fs.readdirSync(ROOT)
  .filter((f) => /\.html$/i.test(f) || /\.md$/i.test(f))
  .filter((f) => !/^(index|index\.dc)\.html$/i.test(f))      // the gate is not a hub page
  .filter((f) => !/^(DEPLOY|VAULT|README)\.md$/i.test(f))    // docs, not pages
  .map((f) => f.replace(/\.md$/i, '.html'));

group('Every page is declared, and every declaration exists');
{
  const declared = Object.keys(S.pages);
  const missing = onDisk.filter((f) => declared.indexOf(f) < 0);
  ok(missing.length === 0, 'every page on disk is in sitemap.js' +
     (missing.length ? ' — undeclared: ' + missing.join(', ') : ''));

  const ghosts = declared.filter((f) => onDisk.indexOf(f) < 0);
  ok(ghosts.length === 0, 'every declared page exists on disk' +
     (ghosts.length ? ' — missing files: ' + ghosts.join(', ') : ''));
}

/* ── the archive must contain the whole archive ────────────────────────────
   Reference.dc.html was archived in sitemap.js and absent from Archive.html,
   because Archive.html kept its own hardcoded copy of the list. Nothing live
   may link to an archived page — that is the check below — so a page missing
   from the Archive as well is reachable only by typing its URL. That is the
   exact failure the archive exists to prevent, and it was silent.

   Archive.html now renders sitemap.js's list, so this pins the two together:
   every archived page is described, and every description is of a page that
   really is archived. It matters more as pages are consolidated — each one
   retired is a chance to drop a document on the floor. */
group('The Archive describes every archived page');

(function () {
  const archived = S.archived();
  ok(archived.length > 0, 'there are archived pages to describe (' + archived.length + ')');

  const recs = S.archivedPages();
  ok(recs.length === archived.length,
     'archivedPages() covers all of them (' + recs.length + '/' + archived.length + ')');

  const thin = recs.filter((r) => !r.was || !r.why || !r.now);
  ok(thin.length === 0,
     'each says what it was, why it was retired, and what replaced it' +
     (thin.length ? ' — missing on ' + thin.map((r) => r.href).join(', ') : ''));

  const dead = recs.filter((r) => !fs.existsSync(path.join(ROOT, r.href)));
  ok(dead.length === 0,
     'every archived page it lists still exists on disk' +
     (dead.length ? ' — ' + dead.map((r) => r.href).join(', ') : ''));

  const gone = recs.filter((r) => S.isArchived(r.now));
  ok(gone.length === 0,
     'no archived page points at another archived page as its replacement' +
     (gone.length ? ' — ' + gone.map((r) => r.href + ' -> ' + r.now).join(', ') : ''));

  /* The page must READ that list rather than keep one. A reintroduced literal
     array is how the drift happened the first time. */
  const html = fs.readFileSync(path.join(ROOT, 'Archive.html'), 'utf8');
  ok(/SITEMAP[\s\S]{0,80}archivedPages\(\)/.test(html),
     'Archive.html renders the sitemap list rather than a copy of it');
  ok(!/\bhref:\s*'[^']+\.(?:dc\.)?html'/.test(html),
     'Archive.html no longer hardcodes archived page hrefs');
})();

group('Nothing live links to an archived page');
{
  /* Read the raw HTML rather than the map: the point is to catch a link the
     map does not know about, which is how the last drift survived. */
  const archived = S.archived();
  const offenders = [];
  S.live().forEach((page) => {
    const file = path.join(ROOT, page);
    if (!fs.existsSync(file)) return;
    const html = fs.readFileSync(file, 'utf8');
    archived.forEach((a) => {
      /* Archive.html and the v1 documents are allowed to reference each
         other — that is the whole job of an archive. */
      if (page === 'Archive.html' || page === 'Settings.html') return;
      const re = new RegExp('href=["\']' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\']', 'i');
      if (re.test(html)) offenders.push(page + ' → ' + a);
    });
  });
  ok(offenders.length === 0, 'no live page links to a v1 document' +
     (offenders.length ? '\n          ' + offenders.join('\n          ') : ''));
}

group('The board and the drawer point somewhere live');
{
  const sys = load('systems.js');
  const all = sys.Systems.all();
  const bad = all.filter((s) => S.isArchived(String(s.href).split('#')[0]));
  ok(bad.length === 0, 'no system tile opens an archived page' +
     (bad.length ? ' — ' + bad.map((b) => b.id + '→' + b.href).join(', ') : ''));

  const unknown = all.filter((s) => !S.get(String(s.href).split('#')[0]));
  ok(unknown.length === 0, 'every system tile points at a declared page' +
     (unknown.length ? ' — ' + unknown.map((b) => b.id + '→' + b.href).join(', ') : ''));

  const tabsOk = S.tabs.every((t) => !!S.get(t[0]) && !S.isArchived(t[0]));
  ok(tabsOk, 'every tab points at a live declared page');
}

group('Every page can be walked home');
{
  const stranded = S.live().filter((f) => {
    if (f === 'Standing.html') return false;
    const chain = S.chain(f);
    return chain[chain.length - 1] !== 'Standing.html';
  });
  ok(stranded.length === 0, 'every live page reaches the front door' +
     (stranded.length ? ' — stranded: ' + stranded.join(', ') : ''));

  const selfParent = S.live().filter((f) => S.parentOf(f) === f);
  ok(selfParent.length === 0, 'no page is its own parent');
}

group('The manifest opens the front door');
{
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const start = String(m.start_url || '').replace(/^\.\//, '');
  ok(!S.isArchived(start), 'start_url is not an archived page (' + start + ')');
  ok(start === 'Standing.html', 'start_url is the front door');
  ok(!/Mission Control/i.test(m.name || ''), 'the installed app is not named after the retired page');
}

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
