/* ─────────────────────────────────────────────────────────────────────────
   tabs.js — the destination's tab bar, on every page that belongs to one.

   WHY. Nine destinations, two shapes. Plan and Money are FOLDED: their
   panels live in one file and that file draws its own tab bar. The other
   seven are TWO-LEVEL: each panel is still its own page, because fusing four
   React boards or a React page into a vanilla one is where a regression
   hides. Agreed deliberately — but without this file, "two-level" just means
   six loose pages again, and the Body is not one place, it is six.

   So this draws the same bar on a two-level destination's pages. Open the
   grind board and the Body's six tabs are across the top; tap Rest and you
   are on Rest.html with the same six tabs, Rest lit. One place, several
   files, and nothing had to be merged to get there.

   INJECTED BY THE DEPLOY, like nav.js — the pages never reference it.

   IT DOES NOTHING when it would be wrong to act:
     · on a folded page, which draws its own bar (detected by .hub-tabs)
     · on a destination with one panel — Reading is one page, and a tab bar
       of one tab is furniture
     · on an archived page, which is deliberately outside the structure
     · when sitemap.js did not load, because a bar built from a guess is
       worse than no bar
   ───────────────────────────────────────────────────────────────────────── */
(function (w, d) {
  'use strict';
  if (w.__hbTabsLoaded) return;
  w.__hbTabsLoaded = true;

  function SM() { return w.SITEMAP || null; }

  function build() {
    var m = SM();
    if (!m || !m.destOf) return;

    /* A folded page already has one. Drawing a second would put the
       destination's tabs above the panel's own, which is the same list
       twice. */
    if (d.querySelector('.hub-tabs')) return;

    var here;
    try { here = m.here(); } catch (e) { return; }
    if (!here || (m.isArchived && m.isArchived(here))) return;

    var dest = m.destOf(here);
    if (!dest) return;

    var panels;
    try { panels = m.panelsOf(dest) || []; } catch (e) { return; }
    if (panels.length < 2) return;

    var info = m.destination ? m.destination(dest) : null;
    var mode = m.naming ? m.naming() : 'named';

    var bar = d.createElement('nav');
    bar.className = 'hub-tabs hb-desttabs';
    bar.setAttribute('aria-label', (info && (mode === 'plain' ? info.plain : info.name)) || 'Section');

    panels.forEach(function (p) {
      var file = String(p.href).split('#')[0];
      var on = (file === here);
      var a = d.createElement('a');
      a.className = 'hub-tab';
      a.href = p.href;
      a.textContent = p.panel;
      if (on) { a.setAttribute('aria-selected', 'true'); a.setAttribute('aria-current', 'page'); }
      else { a.setAttribute('aria-selected', 'false'); }
      bar.appendChild(a);
    });

    /* Placed after the page's own header if it has one, so the bar sits under
       the masthead rather than above it; otherwise first in the body. Pages
       here were written independently and do not share a wrapper, so this is
       a best guess made explicit rather than a layout contract. */
    var host = d.querySelector('main') || d.body;
    var head = d.querySelector('header, .hub-top, .top');
    if (head && head.parentNode === d.body) d.body.insertBefore(bar, head.nextSibling);
    else if (host.firstChild) host.insertBefore(bar, host.firstChild);
    else host.appendChild(bar);

    style();
  }

  /* ── the bar's own styling, and why it is all here ───────────────────────
     THIS USED TO SAY "the bar uses hub.css, which the deploy injects
     everywhere". It does not. inject.py ships PWA_HEAD, the script SHIM and
     THEME_BOOT — no stylesheet. The plain .html pages link hub.css
     themselves; the .dc.html pages carry their own styles in <helmet> and
     never load it. Six of the seven two-level destinations land on .dc.html
     pages, so on the Body, Study, People and Review boards `.hub-tabs` and
     `.hub-tab` matched nothing at all and the four rules below — which set
     no display, no gap, no font and no padding — left the bar as a row of
     naked anchors: "SessionRestLogBodyTrendsWeek", run together in the
     browser's default link blue, the current one underlined by the only
     rule that did land.

     So the strip styles itself completely and depends on no other file.
     Every rule is scoped under .hb-desttabs, which also puts it at (0,2,0)
     — above hub.css's own (0,1,0) `.hub-tab` — so the two agree on the
     pages that do load it instead of half-cascading into each other.

     Chips rather than an underline row: this bar is dropped into pages that
     were written independently and share no masthead, so it has to read as
     a control on its own rather than as the bottom edge of a header it does
     not have. */
  function style() {
    if (d.getElementById('hb-desttabs-css')) return;
    var css = d.createElement('style');
    css.id = 'hb-desttabs-css';
    css.textContent =
      /* The 62px on the right is not a margin, it is the drawer button:
         nav.js floats a 44px circle at `right: 12px + inset`, and a strip
         that scrolls under it hides its own last control. 62px is the same
         clearance the hand-written mastheads on this site already use. */
      '.hb-desttabs{display:flex;gap:6px;align-items:center;' +
      'max-width:980px;margin:0 auto;' +
      'padding:10px max(62px,calc(50px + env(safe-area-inset-right,0px))) 10px 16px;' +
      'overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;' +
      'border:0;background:none;}' +
      '.hb-desttabs::-webkit-scrollbar{display:none;}' +
      '.hb-desttabs .hub-tab{flex:none;display:inline-flex;align-items:center;' +
      'min-height:34px;padding:0 13px;border-radius:18px;' +
      'border:1px solid #E4E2DD;background:#FFFDF8;' +
      'font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11.5px;' +
      'font-weight:500;letter-spacing:.04em;color:#55564F;' +
      'text-decoration:none;white-space:nowrap;cursor:pointer;' +
      'text-transform:none;font-variant:normal;' +
      '-webkit-tap-highlight-color:transparent;transition:border-color .12s,color .12s;}' +
      '.hb-desttabs .hub-tab:hover{border-color:#993C1D;color:#993C1D;}' +
      '.hb-desttabs .hub-tab[aria-selected="true"]{' +
      'background:#993C1D;border-color:#993C1D;color:#FFFDF8;font-weight:600;}' +
      /* The tap target is 34px of chip inside a 44px row, so the row — not
         the chip — is what a thumb has to hit. */
      '@media(max-width:640px){.hb-desttabs{padding:9px 12px;gap:5px;}' +
      '  .hb-desttabs .hub-tab{min-height:36px;font-size:12px;padding:0 14px;}}';
    d.head.appendChild(css);
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', build);
  else build();
})(window, document);
