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
/* ── the v5 destination model ──────────────────────────────────────────────
   Thirty-one pages became ten places. The pages have not moved yet — each
   destination still LANDS on one of them — so these assertions are about the
   model being complete and coherent before any content is touched, which is
   the whole reason the structure is being changed first.

   The one that matters most is coverage: a live page with no destination is a
   page that will vanish from the navigation the moment the drawer stops
   listing all thirty-one. That is precisely how Reference.dc.html became
   unreachable, one layer up. */
group('Every live page has a destination, and every destination works');

(function () {
  const dests = S.destinations();
  ok(dests.length >= 9, 'the destinations are declared (' + dests.length + ')');

  const live = S.live();
  const homeless = live.filter((f) => !S.destOf(f));
  ok(homeless.length === 0,
     'every live page belongs to a destination' +
     (homeless.length ? ' — orphaned: ' + homeless.join(', ') : ''));

  const stray = S.archived().filter((f) => S.pages[f].dest);
  ok(stray.length === 0,
     'no archived page claims a destination' +
     (stray.length ? ' — ' + stray.join(', ') : ''));

  const ids = dests.map((d) => d.id);
  const bogus = live.map((f) => S.destOf(f)).filter((d) => ids.indexOf(d) < 0);
  ok(bogus.length === 0, 'no page names a destination that does not exist');

  /* Every destination has to be reachable and land somewhere real, or a tab
     leads nowhere. */
  const badLand = dests.filter((d) => !d.lands || !fs.existsSync(path.join(ROOT, d.lands)));
  ok(badLand.length === 0,
     'each destination lands on a page that exists' +
     (badLand.length ? ' — ' + badLand.map((d) => d.id + '->' + d.lands).join(', ') : ''));

  const landsArchived = dests.filter((d) => S.isArchived(d.lands));
  ok(landsArchived.length === 0, 'no destination lands on an archived page');

  const empty = dests.filter((d) => S.panelsOf(d.id).length === 0);
  ok(empty.length === 0,
     'no destination is empty' + (empty.length ? ' — ' + empty.map((d) => d.id).join(', ') : ''));

  /* You must land somewhere the tabs include. Two shapes qualify: the landing
     page is itself a panel (Plan.html keeps its own `Now` content), or it is a
     SHELL that hosts them (Money.html hosts three folded panels and has no
     content of its own). Comparing on the file part, because a folded panel's
     href carries a hash. */
  const offPanel = dests.filter((d) => {
    if (S.isShell(d.lands)) return false;
    return !S.panelsOf(d.id).some((p) => String(p.href).split('#')[0] === d.lands);
  });
  ok(offPanel.length === 0,
     'each destination lands on one of its own panels, or on its shell' +
     (offPanel.length ? ' — ' + offPanel.map((d) => d.id).join(', ') : ''));

  /* A shell must host something, or it is a page with nothing on it. */
  const shells = live.filter((f) => S.isShell(f));
  const barren = shells.filter((f) => S.panelsOf(S.destOf(f)).length === 0);
  ok(barren.length === 0, 'every shell hosts at least one panel');

  const idle = shells.filter((f) => !dests.some((d) => d.lands === f));
  ok(idle.length === 0,
     'every shell is the landing page of its destination' +
     (idle.length ? ' — ' + idle.join(', ') : ''));

  const total = dests.reduce((n, d) => n + S.panelsOf(d.id).length, 0);
  ok(total + shells.length === live.length,
     'panels plus shells account for every live page exactly once (' +
     total + '+' + shells.length + '/' + live.length + ')');

  /* Panel order is a decision — the first panel is what opens — so it must be
     declared rather than inherited from file order. */
  const unordered = live.filter((f) => !S.isShell(f) && typeof S.pages[f].ord !== 'number');
  ok(unordered.length === 0,
     'every page declares its panel order' +
     (unordered.length ? ' — ' + unordered.join(', ') : ''));

  const clash = [];
  dests.forEach((d) => {
    const seen = {};
    S.panelsOf(d.id).forEach((p) => {
      if (seen[p.ord]) clash.push(d.id + ':' + p.ord);
      seen[p.ord] = 1;
    });
  });
  ok(clash.length === 0,
     'no two panels in a destination share an order' +
     (clash.length ? ' — ' + clash.join(', ') : ''));
})();

/* ── folding ───────────────────────────────────────────────────────────────
   A folded page's content has moved into a destination panel, but its FILE
   stays as a redirect stub. Deleting those stubs is what turns a
   consolidation into a wall of broken bookmarks, so the tests treat the stub
   as load-bearing: it must exist, it must point at the panel, and the panel
   it points at must be a real panel of a real destination. */
group('Folded pages still resolve');

(function () {
  const folded = S.live().filter((f) => S.isFolded(f));
  ok(folded.length > 0, 'some pages are folded (' + folded.length + ')');

  folded.forEach((f) => {
    const target = S.pages[f].foldedInto;
    const [file, hash] = String(target).split('#');
    ok(fs.existsSync(path.join(ROOT, f)),
       f + ' keeps a stub on disk so old links survive');
    ok(!!S.get(file) && !S.isArchived(file),
       f + ' folds into a live declared page (' + file + ')');
    ok(S.destOf(f) === S.destOf(file),
       f + ' folds into its own destination');
    ok(!!hash, f + ' folds to a named panel, not just a page');

    /* The stub must actually send you there, or it is a dead end wearing a
       redirect's clothes. */
    const stub = fs.readFileSync(path.join(ROOT, f), 'utf8');
    ok(stub.indexOf(target) >= 0, f + ' stub points at ' + target);
    ok(/location\.replace|http-equiv="refresh"/i.test(stub), f + ' stub actually redirects');
  });

  /* The destination page has to contain the panel each fold names. */
  const byDest = {};
  folded.forEach((f) => {
    const [file, hash] = String(S.pages[f].foldedInto).split('#');
    (byDest[file] = byDest[file] || []).push(hash);
  });
  Object.keys(byDest).forEach((file) => {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    byDest[file].forEach((h) => {
      ok(html.indexOf('panel-' + h) >= 0,
         file + ' contains the #' + h + ' panel it is folded into');
    });
  });
})();

group('Both namings are complete, so the toggle cannot show a blank');

(function () {
  const live = S.live();
  const noPlain = live.filter((f) => !S.pages[f].plain);
  ok(noPlain.length === 0,
     'every page has a plain-language name' + (noPlain.length ? ' — ' + noPlain.join(', ') : ''));

  const noBlurb = live.filter((f) => !S.pages[f].blurb);
  ok(noBlurb.length === 0,
     'every page has a one-line description' + (noBlurb.length ? ' — ' + noBlurb.join(', ') : ''));

  const bad = live.filter((f) => {
    const a = S.label(f, 'named'), b = S.label(f, 'plain');
    return !a.title || !b.title;
  });
  ok(bad.length === 0, 'both namings resolve to a title for every page');

  const dests = S.destinations();
  ok(dests.every((d) => d.name && d.plain && d.blurb),
     'every destination carries a name, a plain word and a description');

  /* A tab bar is five words wide. Anything longer is truncated on a phone,
     which teaches nobody anything. */
  const tabs = S.tabLinks('named').concat(S.tabLinks('plain'));
  const longTab = tabs.filter((t) => t.label.length > 8);
  ok(longTab.length === 0,
     'no tab label is too long for a phone' +
     (longTab.length ? ' — ' + longTab.map((t) => t.label).join(', ') : ''));

  const deadTab = S.tabLinks().filter((t) => !fs.existsSync(path.join(ROOT, t.href)));
  ok(deadTab.length === 0, 'every phone tab points at a page that exists');
})();

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
     array is how the drift happened the first time.

     Follow the fold: the Archive is a panel of Settings now, and Archive.html
     is a redirect stub. Resolving foldedInto rather than hardcoding a filename
     means this keeps checking the real renderer wherever it is moved next. */
  const archiveFile = (S.pages['Archive.html'] && S.pages['Archive.html'].foldedInto)
    ? String(S.pages['Archive.html'].foldedInto).split('#')[0]
    : 'Archive.html';
  const html = fs.readFileSync(path.join(ROOT, archiveFile), 'utf8');
  ok(/SITEMAP[\s\S]{0,80}archivedPages\(\)/.test(html),
     archiveFile + ' renders the sitemap list rather than a copy of it');
  ok(!/\bhref:\s*'[^']+\.(?:dc\.)?html'/.test(html),
     archiveFile + ' no longer hardcodes archived page hrefs');
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

  /* TABS holds destination ids now, not page hrefs — the bar names places, and
     tabLinks() resolves each to whatever page it currently lands on. The check
     is the same one it always was, applied to the resolved form: a tab must
     reach a live, declared page. */
  const ids = S.destinations().map((d) => d.id);
  ok(S.tabs.every((t) => ids.indexOf(t[0]) >= 0),
     'every tab names a destination that exists');

  const links = S.tabLinks();
  const tabsOk = links.every((t) => !!S.get(t.href) && !S.isArchived(t.href));
  ok(tabsOk, 'every tab resolves to a live declared page' +
     (tabsOk ? '' : ' — ' + links.filter((t) => !S.get(t.href) || S.isArchived(t.href))
                          .map((t) => t.id + '→' + t.href).join(', ')));
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
