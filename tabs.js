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

    /* The bar uses hub.css, which the deploy injects everywhere. These are the
       few rules it needs that are specific to being a standalone strip rather
       than part of a page's own layout — and a minimal fallback so a page
       served without hub.css still gets something legible rather than a row
       of naked links. */
    if (!d.getElementById('hb-desttabs-css')) {
      var css = d.createElement('style');
      css.id = 'hb-desttabs-css';
      css.textContent =
        '.hb-desttabs{max-width:760px;margin:0 auto;padding:0 16px;}' +
        '.hb-desttabs .hub-tab{text-decoration:none;border-bottom:2px solid transparent;}' +
        '.hb-desttabs .hub-tab[aria-selected="true"]{border-bottom-color:currentColor;}' +
        '@media(max-width:640px){.hb-desttabs{padding:0 12px;}}';
      d.head.appendChild(css);
    }
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', build);
  else build();
})(window, document);
