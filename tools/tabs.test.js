/* ─────────────────────────────────────────────────────────────
   tabs.test.js — the destination tab bar styles itself.

   Run with `node tools/tabs.test.js` from the repo root. Also run by the
   deploy.

   THE BUG. tabs.js drew the bar as <a class="hub-tab"> inside
   <nav class="hub-tabs">, and its own comment said "the bar uses hub.css,
   which the deploy injects everywhere." It does not. inject.py ships
   PWA_HEAD, the script SHIM and THEME_BOOT — no stylesheet at all. The
   plain .html pages link hub.css from their own <head>; the .dc.html
   exports carry their styles in <helmet> and never load it.

   Six of the seven two-level destinations land on .dc.html pages, so on the
   Body, Study, People and Review boards `.hub-tabs` and `.hub-tab` matched
   nothing. The four fallback rules in tabs.js set no display, no gap, no
   font and no padding, so the bar rendered as bare anchors in the browser's
   default link blue with no space between them:

     SessionRestLogBodyTrendsWeek

   Nothing could catch it. Every href was correct, every label was correct,
   the sitemap tripwires were green, and upbar.test.js proved the drawer was
   untouched. The bar was right in every respect except that it was
   invisible as a control.

   So the checks are: the bar depends on no other stylesheet, and the rules
   it ships actually lay it out.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ── a DOM with just enough in it to run tabs.js ───────────────────────── */
function makeDom(here) {
  function Node(tag) {
    this.tagName = String(tag || '').toUpperCase();
    this.nodeType = 1;
    this.childNodes = [];
    this.attrs = {};
    this.className = '';
    this.id = '';
    this._text = '';
  }
  Node.prototype.appendChild = function (c) { this.childNodes.push(c); c.parentNode = this; return c; };
  Node.prototype.insertBefore = function (c, ref) {
    const i = this.childNodes.indexOf(ref);
    if (i < 0) this.childNodes.push(c); else this.childNodes.splice(i, 0, c);
    c.parentNode = this; return c;
  };
  Node.prototype.setAttribute = function (k, v) { this.attrs[k] = String(v); };
  Node.prototype.getAttribute = function (k) { return k in this.attrs ? this.attrs[k] : null; };
  Object.defineProperty(Node.prototype, 'textContent', {
    get() { return this._text; }, set(v) { this._text = String(v); }
  });

  const doc = {
    readyState: 'complete',
    head: new Node('head'),
    body: new Node('body'),
    createElement: (t) => new Node(t),
    getElementById(id) {
      let hit = null;
      (function walk(n) {
        if (n.id === id) hit = n;
        (n.childNodes || []).forEach(walk);
      })(doc.head);
      return hit;
    },
    querySelector: () => null,        // no <main>, no header — a .dc.html page
    addEventListener() {}
  };
  doc.body.parentNode = doc;

  const SITEMAP = {
    here: () => here,
    isArchived: () => false,
    destOf: () => 'body',
    naming: () => 'named',
    destination: () => ({ id: 'body', name: 'The Body', plain: 'Body' }),
    panelsOf: () => ([
      { href: 'Grind.dc.html',    panel: 'Session' },
      { href: 'Rest.html',        panel: 'Rest' },
      { href: 'Life Log.dc.html', panel: 'Log' },
      { href: 'Health.html',      panel: 'Body' },
      { href: 'Trends.html',      panel: 'Trends' },
      { href: 'Week.html',        panel: 'Week' }
    ])
  };

  const ctx = { console, document: doc, SITEMAP };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('tabs.js'), ctx, { filename: 'tabs.js' });
  return { doc, ctx };
}

/* ── 1. the bar is built at all ────────────────────────────────────────── */
group('The bar builds on a .dc.html page with no <main> and no header');

const { doc } = makeDom('Grind.dc.html');
const bar = doc.body.childNodes.find((n) => n.className && /hb-desttabs/.test(n.className));

ok(!!bar, 'a nav.hb-desttabs is inserted into the body');
ok(bar && bar.childNodes.length === 6, 'it carries one control per panel (' +
   (bar ? bar.childNodes.length : 0) + ')');
ok(bar && bar.childNodes.map((a) => a.textContent).join('|') ===
   'Session|Rest|Log|Body|Trends|Week', 'labelled in panel order');
ok(bar && bar.childNodes[0].getAttribute('aria-selected') === 'true',
   'the page you are on is the selected one');
ok(bar && bar.childNodes[1].getAttribute('aria-selected') === 'false',
   'and the others are not');

/* ── 2. the stylesheet it ships actually lays the bar out ──────────────── */
group('The bar does not depend on hub.css');

const sheet = doc.getElementById('hb-desttabs-css');
ok(!!sheet, 'a stylesheet is injected');

const css = sheet ? sheet.textContent : '';

/* The container has to establish a row. Without this the anchors are inline
   and run together, which is the whole bug. */
ok(/\.hb-desttabs\{[^}]*display:flex/.test(css), 'the container is a flex row');
ok(/\.hb-desttabs\{[^}]*gap:/.test(css),          'with a gap between the controls');

/* Each control has to look like a control: its own box, its own type, and a
   tap target. A bare anchor inherits the browser's link blue and nothing
   else, which is exactly what shipped. */
const tabRule = (css.match(/\.hb-desttabs \.hub-tab\{[^}]*\}/) || [''])[0];
ok(/padding:/.test(tabRule),      'each control has padding');
ok(/border(-radius)?:/.test(tabRule), 'each control has a border of its own');
ok(/background:/.test(tabRule),   'each control has a background');
ok(/font-family:/.test(tabRule),  'each control sets its own font');
ok(/color:/.test(tabRule),        'each control sets its own colour');
ok(/min-height:3[0-9]px/.test(tabRule), 'and is tall enough to tap');

/* The selected one has to be distinguishable by more than an underline that
   only rendered because it was the single rule that landed. */
ok(/\[aria-selected="true"\]\{[^}]*background:/.test(css),
   'the selected control is filled, not just underlined');

/* Every rule is scoped, so dropping this bar into a page that HAS hub.css
   cannot restyle that page's own tabs. */
const selectors = css.replace(/\{[^}]*\}/g, '|').split('|')
  .map((s) => s.trim()).filter(Boolean)
  .filter((s) => !/^@media/.test(s) && !/^\}/.test(s));
const unscoped = selectors.filter((s) => !/hb-desttabs/.test(s));
ok(unscoped.length === 0,
   'every rule is scoped to .hb-desttabs' + (unscoped.length ? ' — ' + unscoped.join(', ') : ''));

/* ── 3. the claim that started it does not come back ───────────────────── */
group('The comment that caused this is gone');

const src = read('tabs.js');
ok(!/hub\.css, which the deploy injects everywhere/.test(src),
   'tabs.js no longer claims the deploy injects hub.css');

const inject = read('.github/inject.py');
const shipsCss = /SHIM\s*=\s*\(([\s\S]*?)\)\n/.exec(inject);
ok(shipsCss && !/hub\.css/.test(shipsCss[1]),
   'and the deploy still does not — the claim was the bug, not the code');

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
