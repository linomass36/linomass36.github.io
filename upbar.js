/* ─────────────────────────────────────────────────────────────
   upbar.js — every page's back link names the page that owns it.

   Fifteen pages carried a hand-written back button and between them they used
   five different labels for one destination:

     "← Mission Control"  x7      "⌂ Hub"  x5
     "→ Back to Mission Control"  "the workshop →"  "the conference desk →"

   All of them pointed at Hub.dc.html, which the v2 recalibration retired as
   the front door and which links onward into the archive. Meanwhile the ten
   pages built after that recalibration already point at Standing or the Plan
   and are perfectly correct.

   SO THIS DOES NOT ADD A BAR. An earlier draft injected a global up-bar on
   every page, and it was wrong: a phone page already carries four fixed
   controls (the drawer button, the tab bar, the sync pill, the capture
   button) and the tab bar already reaches the front door in one tap. A fifth
   control would have cost 44px to duplicate something already on screen.

   Instead: find the back link a page already has and correct its label and
   destination from sitemap.js. Nothing new appears, every page keeps its own
   styling, and the ten correct ones are left alone. A page with no back link
   at all gets one injected — but only above 640px, where there is no tab bar
   to do the job.

   The match is by href rather than by a marker attribute, so the raw exports
   never have to be hand-edited.
   ───────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';
  if (w.__hbUpbarLoaded) return;
  w.__hbUpbarLoaded = true;

  var STALE = /(^|\/)Hub\.dc\.html($|[?#])/i;   // what the wrong ones point at

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function build() {
    var S = w.SITEMAP;
    if (!S) return;
    var here = S.here();
    var page = S.get(here);
    if (!page) return;

    /* An archived page says what replaced it rather than pretending to a
       place in the live tree. */
    if (page.archived) return markArchived(page);

    var parent = S.parentOf(here);
    if (!parent) return;                       // the front door
    var label = '← ' + S.nameOf(parent);

    var found = rewrite(parent, label);
    if (!found && page.back === 'none') inject(parent, label);
  }

  /* Correct the link the page already has. Only links that point at the
     retired front door are touched — a page whose back link is already right
     is left exactly as its author wrote it. */
  function rewrite(parent, label) {
    var links = document.querySelectorAll('a[href]');
    var hit = 0;
    Array.prototype.forEach.call(links, function (a) {
      var href = a.getAttribute('href') || '';
      if (!STALE.test(href)) return;
      /* Only the one acting as a back control. A body link that happens to
         mention the Workshop is not a navigation affordance, and the
         difference is that a back control is short and sits in a header. */
      var txt = (a.textContent || '').trim();
      if (txt.length > 28) return;
      a.setAttribute('href', parent);
      a.setAttribute('data-upbar', 'rewritten');
      setLabel(a, label);
      hit++;
    });
    return hit > 0;
  }

  /* Replace the visible text without disturbing whatever markup the page
     wrapped it in — several of these are an icon span plus a text node. */
  function setLabel(a, label) {
    var textNodes = [];
    (function walk(n) {
      for (var i = 0; i < n.childNodes.length; i++) {
        var c = n.childNodes[i];
        if (c.nodeType === 3 && c.nodeValue.trim()) textNodes.push(c);
        else if (c.nodeType === 1) walk(c);
      }
    })(a);
    if (!textNodes.length) { a.textContent = label; return; }
    textNodes[0].nodeValue = label;
    for (var i = 1; i < textNodes.length; i++) textNodes[i].nodeValue = '';
    /* A leading glyph span would now sit before an arrow that already has
       one. Drop it — the arrow is the affordance. */
    Array.prototype.forEach.call(a.querySelectorAll('span'), function (sp) {
      if (!sp.textContent.trim()) return;
      if (sp.textContent.trim().length <= 2 && !/[A-Za-z]/.test(sp.textContent)) sp.textContent = '';
    });
  }

  /* Pages that never had one. Desktop only: below 640px the tab bar and the
     drawer already reach everything, and the screen has no room to spare. */
  function inject(parent, label) {
    var css = document.createElement('style');
    css.textContent =
      '#hb-up{position:fixed;left:calc(12px + env(safe-area-inset-left,0px));' +
      'top:calc(12px + env(safe-area-inset-top,0px));z-index:2147483100;' +
      'display:none;align-items:center;gap:6px;min-height:36px;padding:7px 14px;' +
      'border-radius:20px;border:1px solid #E4E2DD;background:#FFFDF8;color:#55564F;' +
      'font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;' +
      'text-decoration:none;box-shadow:0 3px 12px rgba(26,27,26,.12);}' +
      '#hb-up:hover{border-color:#993C1D;color:#993C1D;}' +
      'html.hb-dark #hb-up{background:#1B1B1D;border-color:#2E2E31;color:#B0AEA5;}' +
      '@media (min-width:641px){#hb-up{display:inline-flex;}}';
    document.head.appendChild(css);
    var a = document.createElement('a');
    a.id = 'hb-up';
    a.href = parent;
    a.textContent = label;
    a.setAttribute('data-upbar', 'injected');
    document.body.appendChild(a);
  }

  /* A v1 document, reached from somewhere. Say so at the top of it rather
     than letting a stale bookmark pass for the live plan. */
  function markArchived(page) {
    if (document.getElementById('hb-archived')) return;
    var S = w.SITEMAP;
    var css = document.createElement('style');
    css.textContent =
      '#hb-archived{position:sticky;top:0;z-index:2147483100;display:flex;align-items:center;' +
      'gap:10px;flex-wrap:wrap;padding:10px 16px;background:#FBEDE8;border-bottom:1px solid #E8C4B6;' +
      'font-family:"IBM Plex Sans",system-ui,sans-serif;font-size:13px;color:#7d2a24;}' +
      '#hb-archived b{font-family:"IBM Plex Mono",monospace;font-size:9.5px;letter-spacing:.14em;' +
      'text-transform:uppercase;color:#A32E27;}' +
      '#hb-archived a{margin-left:auto;font-family:"IBM Plex Mono",monospace;font-size:11px;' +
      'color:#A32E27;border:1px solid #A32E27;border-radius:16px;padding:5px 12px;text-decoration:none;}' +
      '#hb-archived a:hover{background:#A32E27;color:#fff;}';
    document.head.appendChild(css);
    var bar = document.createElement('div');
    bar.id = 'hb-archived';
    var lab = document.createElement('b'); lab.textContent = 'Archived';
    var txt = document.createElement('span');
    txt.textContent = 'This is a v1 document. It is kept, but it is not the live plan.';
    var a = document.createElement('a');
    a.href = page.replacedBy || 'Plan.html';
    a.textContent = 'open ' + S.nameOf(page.replacedBy || 'Plan.html') + ' →';
    bar.appendChild(lab); bar.appendChild(txt); bar.appendChild(a);
    if (document.body.firstChild) document.body.insertBefore(bar, document.body.firstChild);
    else document.body.appendChild(bar);
  }

  w.CTUpbar = { build: build };
  ready(build);
})(typeof window !== 'undefined' ? window : this);
