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
