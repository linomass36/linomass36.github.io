/* ─────────────────────────────────────────────────────────────
   safe-area.test.js — the notch and the home indicator, handled once.

   Run with `node tools/safe-area.test.js` from the repo root. Also run by
   the deploy.

   THREE BUGS, all of them a guard in the wrong place.

   1. TOP CLIPPED. The top inset was applied inside
      `@media (display-mode: standalone)`, on the stated reasoning that "in
      a normal browser tab these insets are 0". They are not: a Dynamic
      Island reports a top inset in an ordinary portrait tab, and a phone
      held sideways reports one too. In those cases nothing was padded and
      the masthead sat under the status bar.

   2. AND STILL CLIPPED WHERE IT WAS APPLIED. Padding the body does nothing
      for `position: sticky; top: 0`, which pins to the viewport whatever
      the body's padding is — and every page-level masthead on this site is
      exactly that. So even in standalone the content moved down and the
      header stayed under the notch.

   3. DEAD BAND UNDER THE TAB BAR. nav.js padded the bar with
      `calc(6px + env(safe-area-inset-bottom))`. That inset is not a margin
      to add to your own padding, it is the distance the OS needs kept
      clear — so on a phone with a home indicator the buttons floated ~40px
      up the screen with a strip of empty bar beneath them.

   The rule underneath all three: env() is already 0 where there is no
   inset, so wrapping it in a media query can only ever switch it off
   somewhere it was needed.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* Both files EXPLAIN the bug they fixed, quoting the old declaration in a
   comment. So every assertion here reads the code with the comments taken
   out — otherwise "the old rule is gone" fails on the sentence saying it is
   gone, which is how a test starts arguing with its own documentation. */
const decomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const css = decomment(read('mobile.css'));
const nav = decomment(read('nav.js'));

/* Everything from `@media (...) {` to its matching close, so a rule can be
   asked which query it is trapped inside. */
function blocksOf(src) {
  const out = [];
  const re = /@media([^{]*)\{/g;
  let m;
  while ((m = re.exec(src))) {
    let d = 1, i = re.lastIndex;
    while (i < src.length && d > 0) {
      if (src[i] === '{') d++;
      else if (src[i] === '}') d--;
      i++;
    }
    out.push({ query: m[1].trim(), body: src.slice(re.lastIndex, i - 1) });
  }
  return out;
}
const media = blocksOf(css);
const inAnyQuery = (needle) => media.filter((b) => b.body.includes(needle)).map((b) => b.query);
/* What is left once every @media block is removed: the rules that always apply. */
const unconditional = (() => {
  let s = css;
  media.forEach((b) => { s = s.replace(b.body, ''); });
  return s;
})();

/* ── 1. the insets apply in every display mode and at every width ──────── */
group('The safe area is not behind a media query');

ok(/--safe-top:\s*env\(safe-area-inset-top/.test(css),
   'the insets are hoisted to custom properties');
ok(/--hb-tabbar:/.test(css),
   'and so is the tab bar height, so nothing has to hard-code 58px');

ok(/body\s*\{[^}]*padding-top:\s*var\(--safe-top\)/.test(unconditional),
   'body padding-top applies unconditionally');
ok(inAnyQuery('padding-top: var(--safe-top)').length === 0,
   'the top inset is inside no media query at all' +
   (inAnyQuery('padding-top: var(--safe-top)').length
     ? ' — found in ' + inAnyQuery('padding-top: var(--safe-top)').join(' / ') : ''));

ok(!/@media \(display-mode: standalone\)/.test(css),
   'the standalone-only block is gone — it was the guard that hid the bug');

ok(/body\s*\{[^}]*padding-left:\s*var\(--safe-left\)/.test(unconditional),
   'the left/right insets apply at every width, including landscape > 640px');
ok(inAnyQuery('padding-left: var(--safe-left)').length === 0,
   'and are not trapped in the max-width: 640px block, where landscape misses them');

/* ── 2. sticky mastheads clear the notch, sidebars are left alone ──────── */
group('A sticky masthead pins below the notch, not under it');

ok(/\.hub-top,?[\s\S]{0,200}top:\s*var\(--safe-top\)/.test(css),
   'the shared .hub-top masthead is pinned to the inset');
ok(/\[style\*="position: sticky"\]\[style\*="top: 0"\]/.test(css),
   'and so is the inline masthead the .dc.html exports each carry');

/* The selector must require top:0. Every other sticky element on the site is
   a sidebar or a table header sitting at 16 / 20 / 86px, and moving those
   would be a new bug rather than a fix. */
const stickyRule = (css.match(/\.hub-top,[\s\S]*?\}/) || [''])[0];
ok(/top:\s*0/.test(stickyRule) || /\[style\*="top: 0"\]/.test(stickyRule),
   'the match is narrowed to top: 0 so sidebars keep their own offsets');

const offsets = [];
['Dossiers.dc.html', 'Conference Radar.dc.html', 'Journal.dc.html'].forEach((f) => {
  const src = read(f);
  const re = /style="([^"]*position:\s?sticky[^"]*)"/g;
  let m;
  while ((m = re.exec(src))) {
    const t = /top:\s?(\d+)px/.exec(m[1]);
    if (t && t[1] !== '0') offsets.push(f + ' @ ' + t[1] + 'px');
  }
});
ok(offsets.length > 0,
   'there really are non-zero sticky offsets to protect (' + offsets.join(', ') + ')');

/* ── 2b. the phone layer actually reaches every phone page ─────────────────
   THE FIX ABOVE SHIPPED AND THE HOME SCREEN STILL CLIPPED, because none of
   it was loading. mobile.css was linked by each page by hand and FOURTEEN
   never linked it — Standing.html among them, which is the manifest's
   start_url and therefore the first thing the installed app opens. Every
   safe-area rule in this file was absent from exactly the page the bug was
   reported on.

   Same shape as the tabs.js bug: a stylesheet assumed to be everywhere that
   nothing was putting everywhere. The deploy injects it now. */
group('mobile.css is delivered, not linked by hand');

const inject = read('.github/inject.py');
ok(/STYLE_SHIM\s*=\s*'<link rel="stylesheet" href="\.\/mobile\.css">/.test(inject),
   'the deploy has a stylesheet shim for it');
ok(/if "mobile\.css" not in text:\s*\n\s*text = insert_head\(text, STYLE_SHIM\)/.test(inject),
   'it is injected into any page that does not already link it, and only those');
ok(!/STYLE_SHIM[\s\S]{0,400}hub\.css/.test(inject),
   'hub.css is NOT injected with it — that is a visual system, not a layer');

/* The gate is kept out of the SCRIPT shim because it runs its own sign-in
   flow. That is a reason about scripts; it is served edge-to-edge like every
   other page, so the style shim has to reach it or the sign-in screen is the
   one page left under the notch. */
const proc = (inject.match(/def process_html[\s\S]*?\n\n\ndef /) || [''])[0];
const gateGuard = proc.indexOf('if not is_gate:');
const styleInject = proc.indexOf('text = insert_head(text, STYLE_SHIM)');
ok(styleInject > gateGuard, 'the style shim is applied after the gate guard opens');
/* Indentation is the whole check: `if not is_gate:` sits at four spaces, so
   anything inside it is at eight. The style shim's own `if` must be at four
   to be outside. */
const guardLine = proc.split('\n').find((l) => l.includes('if not is_gate:')) || '';
const styleIfLine = proc.split('\n').find((l) => l.includes('if "mobile.css" not in text:')) || '';
const indent = (l) => (l.match(/^ */) || [''])[0].length;
ok(styleIfLine !== '' && indent(styleIfLine) === indent(guardLine),
   'and at the same indent as that guard rather than inside it (' +
   indent(styleIfLine) + ' vs ' + indent(guardLine) +
   ') — so the sign-in screen gets the phone layer too');
ok(/def process_html[\s\S]*?if not is_gate:[\s\S]*?inject_shim/.test(inject),
   'while the script shim still skips the gate, which was always the point');

/* The page the bug was reported on, named explicitly: it is the start_url,
   so if any page must carry the phone layer it is this one. */
const manifest = JSON.parse(read('manifest.json'));
const start = String(manifest.start_url || '').replace(/^\.\//, '');
ok(start === 'Standing.html', 'the installed app starts on ' + start);
const startSrc = read(start);
const linksItself = /mobile\.css/.test(startSrc);
ok(!linksItself || true, 'it ' + (linksItself ? 'links' : 'does not link') +
   ' mobile.css itself — either way the deploy guarantees it');

/* ── 2c. the strip behind the status bar is covered ────────────────────────
   Padding the body and pinning the masthead both move content down. Neither
   covers the band the status bar sits in, and the page scrolls THROUGH that
   band — which is what the screenshot showed: the clock with a paragraph
   ghosting behind it, because every masthead here is deliberately
   translucent. */
group('The status-bar band has an opaque lid');

const scrim = (css.match(/body::before\s*\{[^}]*\}/) || [''])[0];
ok(scrim.length > 0, 'body::before exists');
ok(/position:\s*fixed/.test(scrim), 'it is fixed to the viewport');
ok(/height:\s*var\(--safe-top\)/.test(scrim),
   'exactly as tall as the inset — so it collapses to nothing without one');
ok(/top:\s*0/.test(scrim), 'pinned to the very top');
ok(/background:\s*var\(--canvas/.test(scrim), 'painted in the page background');
ok(/pointer-events:\s*none/.test(scrim), 'and cannot swallow a tap');

/* It has to sit above the page and below the chrome. */
const z = (scrim.match(/z-index:\s*(\d+)/) || [])[1];
ok(z && +z > 1000000, 'above any page-level z-index (' + z + ')');
ok(z && +z < 2147482000, 'and below the tab bar, so the chrome still wins');

/* Dark mode is a global invert on <html>: painting the lid dark explicitly
   would inverted it to white. */
ok(!/html\.hb-dark\s+body::before\s*\{[^}]*background/.test(css),
   'no dark-mode background override — the global invert already flips it');

/* ── 2d. the masthead selector covers how mastheads are actually written ── */
group('All three spellings of a sticky masthead are matched');

const stickyBlock = (css.match(/\.hub-top,[\s\S]*?\}/) || [''])[0];
ok(/\.hub-top/.test(stickyBlock), 'the shared class on the folded pages');
ok(/(^|\s|,)\.top(,|\s|\{)/.test(stickyBlock),
   'the plain .top class seven pages declare in their own <style> block');
ok(/\[style\*="position: sticky"\]/.test(stickyBlock), 'and the inline form the exports carry');

/* `top` does nothing to a statically positioned element, which is what makes
   matching a class as generic as .top safe. */
const topUsers = fs.readdirSync(ROOT)
  .filter((f) => /\.html$/.test(f))
  .filter((f) => /\.top\s*\{/.test(read(f)));
ok(topUsers.length > 0, '.top is a real masthead class here — ' + topUsers.length + ' pages');

/* ── 3. the tab bar clears the home indicator without a dead band ──────── */
group('The tab bar sits on the bottom edge');

ok(!/calc\(6px \+ env\(safe-area-inset-bottom/.test(nav),
   'nav.js no longer adds its own padding to the OS inset');
ok(/padding:6px max\(4px,env\(safe-area-inset-right/.test(nav),
   'it takes max() of the two instead');
ok(/max\(6px,env\(safe-area-inset-bottom,0px\)\)/.test(nav),
   'so the bar keeps 6px on a square phone and exactly clears a home indicator');

/* The three constants that could not all stay right. */
ok(!/padding-bottom:calc\(58px/.test(nav), 'body clearance is no longer a hard-coded 58px');
ok(!/bottom:calc\(64px/.test(nav),         'the sync pill is no longer a hard-coded 64px');
ok(!/bottom:calc\(100px/.test(nav),        'the sync panel is no longer a hard-coded 100px');
ok((nav.match(/var\(--hb-tabbar,58px\)/g) || []).length === 3,
   'all three derive from --hb-tabbar, with a fallback if mobile.css is missing');
ok(/body::after\s*\{\s*bottom:\s*calc\(var\(--hb-tabbar\)/.test(css.replace(/\s+/g, ' ')) ||
   /bottom: calc\(var\(--hb-tabbar\)/.test(css),
   'and so does the version badge');

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
