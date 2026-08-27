/* ─────────────────────────────────────────────────────────────
   board.test.js — every page you are meant to open every day is on the
   board, and the board shows the systems that are fine.

   Run with `node tools/board.test.js` from the repo root. Also run by the
   deploy.

   Trends.html and Week.html shipped, deployed, and were reachable only
   from a thirty-item drawer: the Standing's board had eleven tiles and
   neither page was one of them. The Grind tile still opened the fixed
   nine-week board rather than the elastic week that replaced it. From the
   front door the two new pages did not exist.

   The board also listed only what was OWED, which had two consequences
   nobody asked for. The Plan — the thing the other eleven serve — never
   appeared at all, because a plan on track owes nothing. And there was no
   state in which the board looked calm: it could show alarms or nothing.

   So two checks, and they are about reachability rather than layout:
   every live page a tile should open is opened by one, and the board
   reports every system rather than only the failing ones.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function board(stores) {
  const store = Object.assign({}, stores || {});
  const ctx = {
    console, JSON, Object, Array, String, RegExp, Date, Math, isNaN, parseInt, parseFloat,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; }
    },
    document: { createElement: () => ({}), readyState: 'complete', addEventListener: () => {} }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  ['plan-v2-data.js', 'plan-v2.js', 'systems.js'].forEach(f =>
    vm.runInContext(read(f), ctx, { filename: f }));
  return ctx.Systems.all();
}

const tiles = board();
const href = (id) => (tiles.find(t => t.id === id) || {}).href;

group('Every daily page is one tap from the front door');

[['Trends.html', 'trends', 'the correlation matrix'],
 ['Week.html', 'week', 'the elastic week'],
 ['Recall.html', 'recall', 'the three queues'],
 ['Plan.html', 'plan', 'the plan']].forEach(([page, id, what]) => {
  ok(tiles.some(t => t.href === page),
     what + ' (' + page + ') is opened by a board tile');
});

ok(href('week') === 'Week.html',
   "the week tile opens the elastic week, not the fixed grid");

/* Two tiles, one destination, one question — "what do I owe my memory
   today?" was asked twice and answered in two places. */
const toRecall = tiles.filter(t => t.href === 'Recall.html');
ok(toRecall.length === 1,
   'exactly one tile opens Recall, not ' + toRecall.length);

group('Every declared page a tile opens actually exists');

tiles.forEach(t => {
  ok(fs.existsSync(path.join(ROOT, t.href)),
     t.name + ' opens ' + t.href + ', which exists');
});

group('The board can look calm');

ok(tiles.length >= 12, 'every system reports a tile (' + tiles.length + ')');
ok(tiles.some(t => t.id === 'plan'),
   'the plan is on the board even with nothing owed on it');

/* A board that only ever lists alarms cannot say "you are fine". With
   empty stores most systems are untouched rather than failing, and the
   tones have to be able to say so. */
const tones = {};
tiles.forEach(t => { tones[t.tone || 'none'] = (tones[t.tone || 'none'] || 0) + 1; });
ok(Object.keys(tones).length > 1,
   'tiles carry more than one tone — ' +
   Object.keys(tones).map(k => k + ':' + tones[k]).join(' '));

group('The Standing renders all of them, not just the owed ones');

const src = read('Standing.html');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok(!/id="board"/.test(code),
   'the eleven-bar strip is gone — it restated the tiles beneath it');
ok(/is-wide/.test(code), 'the plan is pinned across the top');
ok(/grid-template-columns:\s*repeat\(2/.test(src),
   'the grid is two columns, so the board is a glance rather than a scroll');
ok(!/\$\('#owed-sec'\)\.hidden = !showOwed/.test(code),
   'the board no longer hides itself when nothing is owed');

console.log(failed ? '\n' + failed + ' FAILED' : '\nall green');
process.exit(failed ? 1 : 0);
