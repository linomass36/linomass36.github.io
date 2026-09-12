/* ─────────────────────────────────────────────────────────────────────────
   vault-inline.test.js — the attribute pass, kept out of inlined scripts.

   Run with `node tools/vault-inline.test.js` from the repo root. Also run by
   the deploy.

   WHAT SHIPPED BROKEN. The Grind board was an empty page with a red line
   across it — `Grind.renderVals(): Can't find variable: sc` — on the live
   site, on both a phone and a Mac, and on no development copy.

   The chain: a page behind the vault has its scripts INLINED
   (vault.inline_assets), and a .dc.html page declares its data files inside
   <helmet>, which sits inside <x-dc>. So grind-data.js's 585 lines became
   part of the TEMPLATE. support.js then runs encodeCamelAttrs over the
   template to protect camelCase attribute names — React needs `onClick`, and
   the HTML parser would lowercase it — and its regex is
   `(\s)([a-z]+[A-Z][A-Za-z0-9]*)(\s*=)`: whitespace, a camelCase word, an
   equals sign. In markup that is an attribute. In JavaScript it is an
   assignment or a comparison, and

       const sid = sessionId === false ? null : (sessionId || id);

   shipped as `const sid = sc-camel-session-id === false ? ...`. That parses
   — as `sc` minus `camel` minus `session` minus `id` — and throws the
   moment it runs. grind-data's build() is called by dayShape(), which
   renderVals() calls on every render, so the whole board fell to the
   runtime's empty-props fallback.

   Nine pages carried the same mangling. Grind was the one whose mangled
   identifier sat on a path renderVals takes, so it was the one that showed.

   Why no local build caught it: an unsealed build inlines nothing, so the
   template holds a <script src> tag with no JavaScript in it to damage. The
   bug lives in the vault stage, which is the stage a development copy skips.
   This test therefore REPLAYS that stage rather than serving a page.

   It exercises the shipped functions — they are lifted out of support.js by
   name — so it cannot pass against a copy of the code that has drifted.
   ───────────────────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ── lift the real code out of support.js ──────────────────────────────── */
const support = read('support.js');

/* The whole region that declares the pass, not a list of its internals: the
   contract this test holds support.js to is `encodeCamelAttrs`, and how that
   is built is the bundle's business. Naming the helpers here would make the
   test crash rather than fail when the fix is written a different way. */
function varLine(name) {
  const m = new RegExp('^[ \\t]*var ' + name + ' = .*$', 'm').exec(support);
  if (!m) throw new Error('support.js: `var ' + name + '` not found — did the bundle change shape?');
  return m[0];
}
function region(fromDecl, toDecl) {
  const a = support.indexOf(fromDecl), b = support.indexOf(toDecl);
  if (a < 0 || b < 0 || b <= a) {
    throw new Error('support.js: cannot find the region ' + fromDecl + ' .. ' + toDecl);
  }
  return support.slice(a, b);
}

const encodeCamelAttrs = new Function(
  [varLine('CAMEL_ATTR'),
   region('var ATTRS = ', 'function encodeCase('),
   'if (typeof encodeCamelAttrs !== "function") throw new Error("support.js: encodeCamelAttrs is gone");',
   'return encodeCamelAttrs;'].join('\n')
)();

/* ── port of vault.py's inlining, which is what puts JS in the template ── */
const SCRIPT_RE = /<script([^>]*?)\ssrc="(?!https?:|\/\/)([^"?]+)(\?[^"]*)?"([^>]*)>\s*<\/script>/gi;
const guard = (js) => js.split('</script').join('<\\/script').split('<!--').join('<\\!--');
function inlineAssets(html) {
  return html.replace(SCRIPT_RE, (whole, a1, ref, _q, a4) => {
    const p = path.join(ROOT, ref.replace(/^\.\//, ''));
    if (!fs.existsSync(p)) return whole;
    const keep = ((a1 || '') + (a4 || '')).split(/\s+/)
      .filter((a) => /^(type=|defer|async)/i.test(a)).join(' ');
    return '<script ' + keep + '>\n' + guard(fs.readFileSync(p, 'utf8')) + '\n</script>';
  });
}

/* ── port of support.js's parseDcText slice ────────────────────────────── */
function templateOf(src) {
  const close = src.lastIndexOf('</x-dc>');
  if (close === -1) return null;
  let open = null;
  const re = /<x-dc(?:\s[^>]*)?>/g;
  for (let m = re.exec(src); m && m.index < close; m = re.exec(src)) open = m;
  return open ? src.slice(open.index + open[0].length, close) : null;
}

/* The <script>/<style> BODY spans of a string — what must survive the pass. */
function rawBodies(s) {
  const out = [], re = /(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi;
  let m;
  while ((m = re.exec(s))) {
    const from = m.index + m[1].length;
    out.push([from, from + m[3].length]);
  }
  return out;
}

/* ── 1. the pass still does its actual job ─────────────────────────────── */
group('Attribute names are still encoded');

ok(/\ssc-camel-on-click=/.test(encodeCamelAttrs('<button onClick="{{ go }}">x</button>')),
   'onClick on an element is encoded');
ok(/\ssc-camel-on-change=/.test(encodeCamelAttrs('<input checked="{{ a }}" onChange="{{ b }}">')),
   'onChange beside a lowercase attribute is encoded');
ok(/<script\s+sc-camel-data-foo="1">/.test(encodeCamelAttrs('<script dataFoo="1">var a = 1;</script>')),
   'an attribute ON a script tag is still encoded — the open tag is markup');

/* ── 2. and stops at the edge of a raw-text element ────────────────────── */
group('Script and style bodies come through untouched');

const js = '<script >\nconst sid = sessionId === false ? null : (sessionId || id);\n</script>';
ok(encodeCamelAttrs(js) === js, 'grind-data’s `sessionId === false` survives verbatim');
ok(!/sc-camel/.test(encodeCamelAttrs(js)), 'and nothing in it is prefixed');

const css = '<style>\n.a { fontSize = 1 }\n</style>';
ok(encodeCamelAttrs(css) === css, 'a style body survives verbatim');

const mixed = '<div onClick="{{ go }}"><script >let userName = 1;</script></div>';
const encMixed = encodeCamelAttrs(mixed);
ok(/sc-camel-on-click=/.test(encMixed) && /let userName = 1;/.test(encMixed),
   'the attribute outside is encoded and the identifier inside is not');

/* A `>` inside an attribute value must not end the open tag early, or the
   body after it is treated as markup again. */
const trap = '<script type="a>b">let someName = 1;</script>';
ok(/let someName = 1;/.test(encodeCamelAttrs(trap)),
   'a `>` inside an attribute value does not expose the body');

/* Two scripts in a row: the text BETWEEN them is markup and must still be
   encoded, which a naive "skip to the last close tag" would miss. */
const two = '<script >let aB = 1;</script><i onClick="{{ x }}"></i><script >let cD = 2;</script>';
const encTwo = encodeCamelAttrs(two);
ok(/let aB = 1;/.test(encTwo) && /let cD = 2;/.test(encTwo) && /sc-camel-on-click=/.test(encTwo),
   'markup between two scripts is encoded, both bodies are not');

/* ── 3. every page, through the pipeline the deploy actually runs ──────── */
group('No .dc.html page ships a mangled identifier');

const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.dc.html')).sort();
ok(pages.length > 0, 'found ' + pages.length + ' .dc.html pages to check');

let dirty = 0;
for (const f of pages) {
  const tpl = templateOf(inlineAssets(read(f)));
  if (tpl == null) continue;
  const encoded = encodeCamelAttrs(tpl);
  const bodies = rawBodies(tpl);
  const hits = [];
  const re = /(\s)([a-z]+[A-Z][A-Za-z0-9]*)(\s*=)/g;
  let m;
  while ((m = re.exec(tpl))) {
    const inBody = bodies.some(([a, b]) => m.index >= a && m.index < b);
    if (inBody && encoded.indexOf('sc-camel-' + m[2].replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())) > -1) {
      hits.push(m[2]);
    }
  }
  if (hits.length) {
    dirty++;
    /* Network Map inlines three.js, so an unfixed pass mangles some four
       hundred identifiers on that page alone. Print enough to recognise the
       fault and say how many more there are. */
    const names = [...new Set(hits)];
    console.log('          ' + f + ': ' + names.slice(0, 8).join(', ') +
                (names.length > 8 ? ' … and ' + (names.length - 8) + ' more' : ''));
  }
}
ok(dirty === 0, 'no inlined script body is rewritten on any page (' + pages.length + ' checked)');

/* The specific line that broke, read from the file the board actually uses,
   so this keeps meaning something if build() is rewritten. */
group('The line that broke');
const grindTpl = templateOf(inlineAssets(read('Grind.dc.html')));
ok(grindTpl != null && /grind-data\.js/.test(grindTpl), 'grind-data.js is inlined into the Grind template');
ok(/const sid = sessionId === false/.test(read('grind-data.js')),
   'grind-data.js still has the line (if this fails, update the assertion below)');
ok(/const sid = sessionId === false/.test(encodeCamelAttrs(grindTpl)),
   'and it is still that line after the attribute pass');

console.log(failed ? '\n' + failed + ' FAILED\n' : '\nall green\n');
process.exit(failed ? 1 : 0);
