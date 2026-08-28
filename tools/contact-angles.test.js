/* ─────────────────────────────────────────────────────────────
   contact-angles.test.js — the suggestion rotates, and every angle it
   offers is built from something the map actually holds.

   Run with `node tools/contact-angles.test.js` from the repo root. Also run
   by the deploy.

   The card used to carry one line per tier — "Send one specific thing you
   read this month" for every mentor, every time — which reads as wallpaper
   by the third day. It now offers a rotation.

   The rule that keeps a rotation honest is that it may only assemble, never
   invent. An angle appears when the field it needs is present: `ops` is the
   person's own opportunity list, `met` is how you know them, `notes` is what
   you wrote about them, `role` is their job. A card with none of those falls
   back to a plain line rather than producing a specific-sounding one, because
   a suggestion that references a paper you did not read, or a conversation
   that did not happen, is worse than no suggestion — you would send it.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function contact(people) {
  const store = { nm_nodes_v2: JSON.stringify(people) };
  const ctx = {
    console, JSON, Object, Array, String, RegExp, Date, Math, isNaN, parseInt, parseFloat,
    encodeURIComponent,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; }
    },
    document: { createElement: () => ({}) }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  ['plan-v2-data.js', 'plan-v2.js', 'contact.js'].forEach(f =>
    vm.runInContext(read(f), ctx, { filename: f }));
  return ctx.CTContact;
}

const RICH = {
  id: 'p', name: 'Prof. Polkowski', role: 'Breast cancer surgeon', city: 'Lublin, PL',
  type: 'mentor', strength: 'warm', reach: 3, lastDays: 120, owed: true,
  met: 'Knows you personally through your mother.',
  notes: 'High willingness, high reach — but very busy.',
  ops: ['Ask for a rec letter for CT electives', 'Shadow invitation — a day in his OR']
};
const BARE = { id: 'q', name: 'Ada Byron', type: 'peer', strength: 'cold', lastDays: 400 };

group('A rotation, not one line');

const rich = contact([RICH]).pick();
ok(rich.angles.length >= 6, 'a fully-filled card offers several angles (' + rich.angles.length + ')');
const labels = rich.angles.map(a => a.angle);
ok(new Set(labels).size >= 5, 'and they are different kinds of thing, not one repeated');
ok(rich.angles.every(a => a.text && a.from), 'every angle says what it is and where it came from');

group('Each angle is assembled from a field that exists');

RICH.ops.forEach(op => {
  ok(rich.angles.some(a => a.text.indexOf(op) >= 0),
     'their own opening is offered verbatim: "' + op.slice(0, 34) + '…"');
});
ok(rich.angles.some(a => a.text.indexOf('breast cancer surgeon') >= 0),
   "their role is used, and read back in words ('a breast cancer surgeon')");
ok(rich.angles.some(a => a.from.indexOf('met') >= 0),
   'how you met them is one of the angles');

group('A bare card does not get a specific-sounding suggestion');

const bare = contact([BARE]).pick();
ok(bare.angles.length >= 1, 'there is still something to say');
ok(!bare.angles.some(a => /reading|ops list|your notes|"/.test(a.from)),
   'but nothing is sourced from a field this person does not have');
ok(bare.angles.every(a => !/“/.test(a.text)),
   'and nothing is quoted, because there is nothing to quote');

group('The owed reply leads when one is owed');

ok(rich.angles[0].angle.indexOf('reply') >= 0,
   'an owed reply is the first thing offered');
ok(!bare.angles.some(a => a.angle.indexOf('reply') >= 0),
   'and is not offered when nothing is owed');

group('The page can rotate it');

const src = read('Standing.html');
ok(/function rotate\(/.test(src), 'the Standing can step through them');
ok(/tapTimer/.test(src) && /rotate\(person, -1\)/.test(src),
   'tap goes forward and double-tap goes back');
ok(/ct_reach_angle_v1/.test(src), 'and where you are in the rotation is remembered');

console.log(failed ? '\n' + failed + ' FAILED' : '\nall green');
process.exit(failed ? 1 : 0);
