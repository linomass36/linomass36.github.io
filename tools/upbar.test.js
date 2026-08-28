/* ─────────────────────────────────────────────────────────────
   upbar.test.js — the back-link corrector touches the page, not the chrome.

   Run with `node tools/upbar.test.js` from the repo root. Also run by the
   deploy, because the bug this pins was invisible to every other check.

   upbar.js corrects a back link that still points at Hub.dc.html, the
   retired front door. It found those links with one document-wide scan for
   `a[href]` — and by the time it ran, nav.js had already appended the
   drawer, whose page list contains a legitimate link to Hub.dc.html: the
   Workshop, which is live, not archived.

   So the scan hit the drawer. On every page carrying it, the Workshop entry
   was silently rewritten to that page's own parent:

     on Day Budget   "The Workshop" -> "← The Plan"      -> Plan.html
     on The Body     "The Workshop" -> "← Today"         -> Today.dc.html
     on Conditions   "The Workshop" -> "← The Standing"  -> Standing.html

   Two failures from one line. The Workshop became unreachable from the
   drawer anywhere on the site, and the drawer grew a duplicate of the back
   link that changed its name depending on where you opened it. The site map
   tripwires could not see this: every declaration was correct, and the
   damage was done to the DOM at runtime.

   A third, quieter one: a page declared `back: 'none'` gets a link injected
   only when the scan finds nothing to correct. The drawer's Workshop link
   counted as a find, so the injection never happened.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);

/* ── A DOM with just enough in it to run upbar.js ──────────────────────── */
function makeDom() {
  function Node(tag) {
    this.tagName = String(tag || '').toUpperCase();
    this.nodeType = 1;
    this.childNodes = [];
    this.attrs = {};
    this.parentElement = null;
    this.id = '';
  }
  Node.prototype.appendChild = function (c) { c.parentElement = this; this.childNodes.push(c); return c; };
  Node.prototype.setAttribute = function (k, v) {
    this.attrs[k] = String(v);
    if (k === 'href') this.href = String(v);
    if (k === 'id') this.id = String(v);
  };
  Node.prototype.getAttribute = function (k) {
    if (k === 'href' && this.href != null) return this.href;
    if (k === 'id') return this.id || null;
    return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null;
  };
  Node.prototype.closest = function (sel) {
    const ids = sel.split(',').map(s => s.trim().replace(/^#/, ''));
    let n = this;
    while (n) { if (n.id && ids.indexOf(n.id) >= 0) return n; n = n.parentElement; }
    return null;
  };
  Node.prototype.walk = function (out) {
    this.childNodes.forEach(c => { if (c.nodeType === 1) { out.push(c); c.walk(out); } });
    return out;
  };
  Node.prototype.querySelectorAll = function (sel) {
    const all = this.walk([]);
    if (sel === 'a[href]') return all.filter(n => n.tagName === 'A' && n.href != null);
    if (sel === 'span') return all.filter(n => n.tagName === 'SPAN');
    return [];
  };
  Object.defineProperty(Node.prototype, 'textContent', {
    get() {
      return this.childNodes.map(c => c.nodeType === 3 ? c.nodeValue : c.textContent).join('');
    },
    set(v) { this.childNodes = [{ nodeType: 3, nodeValue: String(v) }]; }
  });

  function text(s) { return { nodeType: 3, nodeValue: String(s) }; }
  function el(tag, props) {
    const n = new Node(tag);
    Object.keys(props || {}).forEach(k => {
      if (k === 'text') n.appendChild(text(props[k]));
      else if (k === 'href') { n.href = props[k]; n.attrs.href = props[k]; }
      else n[k] = props[k];
    });
    return n;
  }

  const body = new Node('body'), head = new Node('head');
  const document = {
    readyState: 'complete',
    head, body,
    createElement: (t) => new Node(t),
    getElementById: (id) => body.walk([]).concat(head.walk([])).find(n => n.id === id) || null,
    querySelectorAll: (sel) => body.querySelectorAll(sel),
    addEventListener: () => {}
  };
  return { document, el, text, Node };
}

function loadSitemap() {
  const ctx = { window: {}, console, JSON, Object, Array, String, RegExp, Date, Math };
  ctx.globalThis = ctx; ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'sitemap.js'), 'utf8'), ctx, { filename: 'sitemap.js' });
  return ctx.window.SITEMAP;
}

/* Build a page as the browser has it at the moment upbar.js runs: the page's
   own header, plus the drawer nav.js has already appended. */
function run(file, opts) {
  opts = opts || {};
  const dom = makeDom();
  const { document, el } = dom;

  if (opts.ownBackLink !== false) {
    const header = el('header');
    const a = el('a', { href: opts.ownHref || 'Hub.dc.html', text: opts.ownText || 'Mission Control' });
    header.appendChild(a);
    document.body.appendChild(header);
    dom.own = a;
  }

  /* nav.js's drawer. The Workshop is a live page and belongs in the list. */
  const drawer = el('div', { id: 'hbnav' });
  const scroll = el('div');
  const workshop = el('a', { href: 'Hub.dc.html', text: 'The Workshop' });
  scroll.appendChild(workshop);
  drawer.appendChild(scroll);
  document.body.appendChild(drawer);
  dom.workshop = workshop;

  if (opts.longBodyLink) {
    const p = el('a', { href: 'Hub.dc.html',
      text: 'the Workshop is where the v1 plan and its retired sprints still live' });
    document.body.appendChild(p);
    dom.longLink = p;
  }

  const S = loadSitemap();
  const win = { SITEMAP: Object.assign(Object.create(S), { here: () => file }) };
  const ctx = { window: win, document, console, JSON, Object, Array, String, RegExp, Date, Math };
  ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'upbar.js'), 'utf8'), ctx, { filename: 'upbar.js' });
  return dom;
}

/* ── The drawer is not this page's back control ────────────────────────── */
group('The drawer keeps its own links');

[['Day Budget.html', 'Plan.html'],
 ['Health.html', 'Today.dc.html'],
 ['Conditions.html', 'Standing.html']].forEach(([file, parent]) => {
  const d = run(file);
  ok(d.workshop.getAttribute('href') === 'Hub.dc.html',
     'on ' + file + ' the drawer still reaches the Workshop');
  ok(d.workshop.textContent.trim() === 'The Workshop',
     'on ' + file + ' the drawer entry is still called the Workshop');
  ok(d.own.getAttribute('href') === parent,
     'on ' + file + " the page's own back link goes to " + parent);
});

/* ── And the drawer no longer masks a missing back link ────────────────── */
group('A page with no back link of its own still gets one');

const none = run('Hub.dc.html', { ownBackLink: false });
ok(none.document.getElementById('hb-up') !== null,
   "the Workshop's own page, declared back:'none', gets a link injected");
ok(none.document.getElementById('hb-up').getAttribute('href') === 'Plan.html',
   'and it points at its declared parent');

/* ── What the length guard was always for ──────────────────────────────── */
group('A sentence that mentions the Workshop is not a back control');

const body = run('Day Budget.html', { longBodyLink: true });
ok(body.longLink.getAttribute('href') === 'Hub.dc.html',
   'a long body link is left alone');
ok(body.own.getAttribute('href') === 'Plan.html',
   'while the short header one is still corrected');

/* ── A correct back link is left exactly as written ────────────────────── */
group('A page that was already right is not touched');

const fine = run('Day Budget.html', { ownHref: 'Plan.html', ownText: '← The Plan' });
ok(fine.own.getAttribute('data-upbar') === null,
   'a back link that never pointed at the Workshop is not rewritten');

console.log(failed ? '\n' + failed + ' FAILED' : '\nall green');
process.exit(failed ? 1 : 0);
