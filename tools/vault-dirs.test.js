/* vault-dirs.test.js — the two allow-lists have to agree.

   verify_vault.py only inspects the build. vault.py is what actually deletes
   files. When `fonts` was added to the verifier and not to the vault, the
   verifier happily passed a build with no fonts in it: every page asked for
   ./fonts/*.woff2, got a 404, and fell back to a system serif. The site
   looked wrong and every check was green.

   A verifier that permits more than the builder ships cannot catch that, so
   this test compares the two lists directly. */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');

var fails = 0;
function ok(cond, what) {
  if (!cond) { console.error('  FAIL: ' + what); fails++; }
}

function setOf(file, name) {
  var src = fs.readFileSync(path.join(ROOT, '.github', file), 'utf8');
  var m = new RegExp(name + '\\s*=\\s*\\{([^}]*)\\}').exec(src);
  if (!m) { console.error('  FAIL: ' + name + ' not found in ' + file); fails++; return null; }
  var out = [];
  var re = /"([^"]+)"|'([^']+)'/g, hit;
  while ((hit = re.exec(m[1]))) out.push(hit[1] || hit[2]);
  return out.sort();
}

var built  = setOf('vault.py', 'PLAINTEXT_DIRS');
var passed = setOf('verify_vault.py', 'ALLOWED_DIRS');

if (built && passed) {
  ok(built.length > 0, 'vault.py ships at least one plaintext directory');
  ok(built.join(',') === passed.join(','),
     'vault.py PLAINTEXT_DIRS (' + built.join(', ') + ') matches ' +
     'verify_vault.py ALLOWED_DIRS (' + passed.join(', ') + ')');

  /* The directories the site actually asks for at runtime. If hub.css names
     a directory neither list carries, the build deletes it. */
  ['fonts', 'plates', 'icons'].forEach(function (d) {
    ok(built.indexOf(d) !== -1, d + '/ survives the vault pass');
  });
}

/* And the files those directories are supposed to hold are really there —
   a font referenced by hub.css but absent from the repository fails the
   same way a deleted one does. */
var css = fs.readFileSync(path.join(ROOT, 'hub.css'), 'utf8');
var re = /url\((['"]?)\.\/(fonts\/[^'")]+)\1\)/g, m;
var seen = 0;
while ((m = re.exec(css))) {
  seen++;
  ok(fs.existsSync(path.join(ROOT, m[2])), 'hub.css references ' + m[2] + ' and it exists');
}
ok(seen > 0, 'hub.css self-hosts at least one font file');

/* plates/ ships in the clear, so it must never hold anything of yours. The
   catalogue in plates.js is the list of what belongs there. */
var plates = path.join(ROOT, 'plates');
if (fs.existsSync(plates)) {
  var js = fs.readFileSync(path.join(ROOT, 'plates.js'), 'utf8');
  var cat = js.slice(js.indexOf('var CATALOGUE'), js.indexOf('var EXTS'));
  fs.readdirSync(plates).forEach(function (f) {
    if (!/\.(jpe?g|png|webp)$/i.test(f)) return;
    var base = f.replace(/\.[^.]+$/, '');
    ok(cat.indexOf("'" + base + "'") !== -1,
       'plates/' + f + ' is a catalogued painting (this directory is NOT encrypted)');
  });
}

/* Every catalogued picture declares which of the three groups it belongs to.
   The Guide renders the list group by group, and the grouping used to be
   worked out from the file name against a hardcoded list of the Polish ones —
   so every painting added after that list was written landed silently in
   "American". An entry with no group, or a group the Guide does not render,
   is now a build failure rather than a quiet miscategorisation. */
const GROUPS = ['anatomy', 'polish', 'american'];
{
  const vm = require('vm');
  const doc = { readyState: 'complete', querySelectorAll: () => [],
                addEventListener: () => {}, createElement: () => ({}) };
  const ctx = { window: {}, document: doc, Image: function () {},
                fetch: () => Promise.reject(new Error('no network in tests')),
                Promise, Object, Array, String, Math, Number, console, setTimeout };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'plates.js'), 'utf8'), ctx,
                  { filename: 'plates.js' });
  const cat = ctx.window.Plates.catalogue;

  Object.keys(cat).forEach(function (k) {
    const g = cat[k].group;
    ok(GROUPS.indexOf(g) !== -1, k + ' declares one of ' + GROUPS.join('/') + ' (got ' + g + ')');
    ok(!!cat[k].who && !!cat[k].title && !!cat[k].year,
       k + ' has an artist, a title and a year to caption it with');
  });

  /* And the catalogue and the directory agree in both directions — a
     catalogued picture with no file shows as "not yet" forever. */
  const onDisk = fs.existsSync(plates)
    ? fs.readdirSync(plates).filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
        .map((f) => f.replace(/\.[^.]+$/, ''))
    : [];
  Object.keys(cat).forEach(function (k) {
    ok(onDisk.indexOf(k) !== -1, 'catalogued picture ' + k + ' has a file in plates/');
  });
}

if (fails) { console.error('vault-dirs: ' + fails + ' failure(s)'); process.exit(1); }
console.log('vault-dirs: ok');
