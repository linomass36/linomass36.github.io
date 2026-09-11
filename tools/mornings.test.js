/* ─────────────────────────────────────────────────────────────
   mornings.test.js — the wall counts the same wait the Wait page does.

   Run with `node tools/mornings.test.js` from the repo root. Also run by the
   deploy.

   WHAT THIS IS GUARDING. Nothing has shipped broken here yet, and the whole
   point of the file is that the obvious version of this feature would have.
   The overlay wants five things — day 1, a seven-day stretch, whether she
   replied, whether the silence is up, and the eight steps — and four of
   those five are facts ct_wait_v1 ALREADY holds. Write them down a second
   time and this repo's oldest failure happens again on a new page: two
   surfaces answering the same question, drifting, and the drift only found
   by pressing a button that should have been disabled.

   The sharpest case is the bump. Wait counts its week from the LAST message
   sent, so using the bump moves the deadline two days out. A wall with its
   own seven-day counter would have gone on offering "seven mornings, no
   reply" on the original date — inviting you to close a wait that, by the
   only clock that matters, still had two days to run.

   So: every date assertion below goes through Wait, and DRIVES THE CLOCK,
   per CLAUDE.md. A test that read Date.now() to decide whether the stretch
   was up would pass until the stretch was up and then fail forever.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* No document in the context, deliberately. Everything worth testing has to
   be reachable without a DOM — if a later edit moves a rule into a click
   handler, this file stops being able to see it, which is the warning. */
function load(files) {
  const ctx = { window: {}, console, JSON, Object, Array, String, Number, Boolean,
                RegExp, Date, Math, Intl, isFinite };
  ctx.globalThis = ctx; ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  files.forEach((f) => vm.runInContext(read(f), ctx, { filename: f }));
  return ctx.window;
}

const W = load(['wait.js', 'mornings.js']);
const M = W.Mornings, Wait = W.Wait;
const at = (y, m, d, h, mi) => new Date(y, m - 1, d, h, mi || 0, 0, 0).getTime();

const SENT = at(2026, 9, 10, 18, 31);                 /* the Thursday evening ask */
const ask = { sent: SENT, bumped: null, replied: null, closed: null };
const bumped = { sent: SENT, bumped: at(2026, 9, 12, 19, 30), replied: null, closed: null };

/* ── 1. it loads at all without a DOM ─────────────────────────────────── */
group('The rules are separable from the painting');

ok(!!M, 'mornings.js defines Mornings with no document present');
ok(typeof M.dayNumber === 'function' && typeof M.outcome === 'function',
   'and exposes the day count and the outcome as plain functions');

/* ── 2. day one is Wait's day one ─────────────────────────────────────── */
group('Day 1 is the day the ask went out, read from ct_wait_v1');

ok(M.dayNumber(ask, SENT) === 1, 'the day of the ask is day 1');
ok(M.dayNumber(ask, at(2026, 9, 14, 6, 0)) === 5, 'the following Monday is day 5');
ok(M.dayNumber(null, SENT) === null, 'no wait, no day number — nothing is invented');
ok(M.dayNumber({ sent: null }, SENT) === null, 'and a wait with no send date is the same answer');

/* Move the stored ask and the wall moves with it. This is the assertion that
   fails the moment somebody caches a start date in ct_mornings_v1. */
const later = { sent: at(2026, 9, 13, 9, 0) };
ok(M.dayNumber(later, at(2026, 9, 14, 6, 0)) === 2,
   'editing the send date on the Wait page renumbers the wall');

/* Day numbers are whole days apart, not hours: an ask at 23:50 and a morning
   ten minutes later is day 2, because it is a different morning. */
ok(M.dayNumber({ sent: at(2026, 9, 10, 23, 50) }, at(2026, 9, 11, 0, 5)) === 2,
   'a morning ten minutes after a late-night ask is the second day, not the first');

/* ── 3. the stretch is Wait's week, bump included ─────────────────────── */
group('The stretch is up when Wait says it is, not seven days after day 1');

ok(M.stretchOver(ask, at(2026, 9, 16, 12, 0)) === false, 'six days in: not yet');
ok(M.stretchOver(ask, at(2026, 9, 18, 12, 0)) === true, 'a week after the ask: up');

/* The one that matters. */
ok(M.stretchOver(bumped, at(2026, 9, 18, 12, 0)) === false,
   'a bump on the Saturday pushes the deadline out, and the wall follows it');
ok(M.stretchOver(bumped, at(2026, 9, 20, 12, 0)) === true,
   'and the wall calls it when Wait does, two days later');

ok(M.stretchOver(null, at(2026, 9, 18, 12, 0)) === false, 'no wait, nothing to call');
ok(M.stretchOver({ sent: SENT, replied: at(2026, 9, 11, 8, 0) }, at(2026, 9, 25, 12, 0)) === false,
   'a wait she answered never reaches the silent deadline at all');

/* ── 4. the outcome ───────────────────────────────────────────────────── */
group('One outcome at a time, and a reply outranks the calendar');

const none = { marks: [], steps: [], acked: null };
ok(M.outcome(ask, none, at(2026, 9, 12, 9, 0)) === null, 'mid-wait there is no outcome');
ok(M.outcome(ask, none, at(2026, 9, 25, 9, 0)) === null,
   'and the clock running out is not itself the outcome — it has to be acknowledged');

ok(M.outcome(ask, { marks: [], steps: [], acked: at(2026, 9, 18, 9, 0) },
             at(2026, 9, 18, 10, 0)) === 'no', 'acknowledging the silence gives the quiet screen');

/* Recorded on the Wait page, read here. There is no second reply flag. */
const answered = { sent: SENT, replied: at(2026, 9, 12, 8, 0) };
[at(2026, 9, 12, 9, 0), at(2026, 9, 25, 9, 0), at(2026, 11, 1, 9, 0)].forEach((t) => {
  ok(M.outcome(answered, none, t) === 'yes',
     'a reply stored by the Wait page shows here too, at ' + new Date(t).getDate() + ' ' +
     ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][new Date(t).getMonth()]);
});
ok(M.outcome(answered, { marks: [], steps: [], acked: at(2026, 9, 18, 9, 0) },
             at(2026, 9, 20, 9, 0)) === 'yes',
   'and a reply beats a silence that was acknowledged first');
ok(M.outcome(null, none, SENT) === null, 'no wait, no outcome');

/* ── 5. the wall ──────────────────────────────────────────────────────── */
group('Five to a group, and the fifth lies across the other four');

[0, 1, 2, 3].forEach((i) => ok(!M.isDiagonal(i), 'mark ' + (i + 1) + ' is an upright'));
ok(M.isDiagonal(4), 'the fifth is the diagonal');
ok(!M.isDiagonal(5) && !M.isDiagonal(8), 'the sixth starts a new group of uprights');
ok(M.isDiagonal(9) && M.isDiagonal(14), 'and every fifth after that is a diagonal');

/* A diagonal has to cross its group, so it starts left of the first upright
   and ends right of the fourth. Uprights stay inside their own lane. */
const num = (s) => s.match(/-?\d+(\.\d+)?/g).map(Number);
const up0 = num(M.strokePath(0)), up3 = num(M.strokePath(3)), diag = num(M.strokePath(4));
ok(diag[0] < up0[0], 'the diagonal begins to the left of the first upright');
ok(diag[diag.length - 2] > up3[2], 'and ends to the right of the fourth');
ok(diag[1] > diag[diag.length - 1], 'rising left to right, the way a hand draws it');

/* Same wall on every repaint. A tally that reshuffles records nothing. */
ok(M.strokePath(7) === M.strokePath(7), 'a stroke is the same stroke on every call');
ok(M.strokePath(7) !== M.strokePath(2), 'but no two marks are the same stroke');

/* ── 6. the words ─────────────────────────────────────────────────────── */
group('A line for every day, fixed to the day');

for (let n = 1; n <= 40; n++) {
  const a = M.words(n);
  if (!a || !a.l || !a.a) { ok(false, 'day ' + n + ' has a line and a thing to do'); break; }
  if (n === 40) ok(true, 'every day from 1 to 40 has a line and a thing to do');
}
ok(M.words(3).l === M.words(3).l && M.words(3).l !== M.words(4).l,
   'the line is fixed to the day number rather than shuffled on each read');
ok(M.words(null).l === M.words(1).l, 'a wall with no day yet shows day one, not nothing');

/* ── 7. the eight ─────────────────────────────────────────────────────── */
group('The same eight steps, whichever way it lands');

ok(M.STEPS.length === 8, 'there are eight');
ok(M.STEPS[0].urgent === true && /canopy/i.test(M.STEPS[0].w),
   'the first one is canopy and is marked urgent — it is the one with a clock on it');
ok(M.STEPS.filter((s) => s.urgent).length === 1, 'and it is the only urgent one');
ok(/phone downstairs/i.test(M.STEPS[7].w), 'the last one puts the phone downstairs');
ok(M.STEPS.filter((s) => !s.w).length === 0, 'every step says something');

/* There is one list, so the happy screen and the quiet screen cannot drift
   apart. If a second array ever appears, this stops being true. */
const src = read('mornings.js');
ok((src.match(/Lock in canopy/g) || []).length === 1,
   'the eight are written down exactly once in the file');

/* ── 8. the store, and what it is allowed to hold ─────────────────────── */
group('The store rides the plumbing, and holds only what nothing else does');

ok(/^ct_[a-z_]+_v1$/.test(M.KEY), 'the key is ct_<thing>_v1 — got ' + M.KEY);
ok(M.KEY.indexOf('__local') !== 0 && M.KEY.indexOf('__sync') !== 0,
   'so backup.js carries it and sync.js pushes it, with nothing to register');
ok(M.KEY !== Wait.KEY, 'and it is not the wait itself');

/* The fields it may keep. `sent`, `bumped` and `replied` belong to Wait, and
   a copy of any of them here is the bug this file exists for. */
const kept = Object.keys(M.read());
ok(kept.indexOf('marks') >= 0 && kept.indexOf('steps') >= 0 && kept.indexOf('acked') >= 0,
   'it keeps the marks, the eight ticks and the day the silence was accepted');
['sent', 'bumped', 'replied', 'start', 'day'].forEach((f) => {
  ok(kept.indexOf(f) < 0, 'it does NOT keep its own "' + f + '" — that is Wait\'s');
});

/* ── 8b. the deadline is a date, and it is Wait's date ────────────────── */
group('The deadline printed on the wall is the one Wait computed');

/* WHAT THIS CAUGHT. The panel first drew "day 7 of 7" beside a box labelled
   "unlocks on day 7" — and then sat there locked, because Wait counts its
   week from the LAST message and the bump had moved it. Two true numbers
   that contradicted each other on one screen. The fix was to stop printing
   a day-number deadline at all and print the date Wait.gates() returns. */
const src8 = read('mornings.js');
ok(M.STRETCH === undefined, 'there is no second seven-day constant to export');
ok(!/of \' \+ STRETCH|STRETCH/.test(src8), 'and none left in the file');
ok(/Wait\.gates\(/.test(src8), 'the panel asks Wait for the deadline');
ok(/callIt/.test(src8), 'and prints the date it gets back');

/* The two clocks have to agree about when the box unlocks. */
ok(Wait.gates(bumped).callIt.getTime() > Wait.gates(ask).callIt.getTime(),
   'using the bump moves that date out');
ok(M.stretchOver(bumped, Wait.gates(ask).callIt.getTime() + 1000) === false,
   'and the wall is still locked on the date the un-bumped wait would have ended');
ok(M.stretchOver(bumped, Wait.gates(bumped).callIt.getTime() + 1000) === true,
   'unlocking on the date it actually shows');

/* ── 8c. the panel is styled against pages that never heard of it ─────── */
group('The panel does not inherit the page it is injected into');

/* WHAT THIS CAUGHT, honestly: the display rules below, and not the
   appearance one. Both halves of a step are spans inside a flex row's child,
   so neither is a block by default, and the detail ran on from the step it
   belongs to — "Eat it watching a film or a seriesThe Marshals." Found by
   reading the computed styles off a built page, which is the only place it
   was visible; the stylesheet looked right.

   The appearance reset is a precaution rather than a fix — these controls
   are nearly transparent by design, which is the state where a UA has room
   to paint its own control face over the panel. Pinned because an overlay
   injected into thirty pages that never heard of it should not be relying on
   any of them for a default. */
ok(/appearance:none/.test(src8) && /-webkit-appearance:none/.test(src8),
   'the panel resets appearance, prefixed and not');
ok(/#hbm-wrap button[^{]*\{[^}]*appearance:none/.test(src8.replace(/',\s*'/g, '')),
   'and does it for every button inside the panel, not one by one');

/* Both halves of a step are spans in a flex row's child, so neither is a
   block by default — the detail ran on from the step it belongs to. */
const flat = src8.replace(/',\s*'/g, '');
ok(/\.hbm-step \.b \.w\{display:block/.test(flat), 'a step title is a block');
ok(/\.hbm-step \.b \.d\{display:block/.test(flat), 'and so is its detail line');

/* ── 9. the Guide heard about it ──────────────────────────────────────── */
group('The Guide knows this exists');

const guide = read('Guide.html').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
ok(/mornings/i.test(guide), 'the Guide mentions the mornings');
ok(/tally|wall/i.test(guide), 'and says what the wall is');
ok(/eight/i.test(guide), 'and that there are eight steps at the end of it');

/* ── 10. it actually ships ────────────────────────────────────────────── */
group('The deploy injects it, on both kinds of page');

const inject = read('.github/inject.py');
const shim = inject.slice(inject.indexOf('SHIM = ('), inject.indexOf('VERSION_FILE'));
const bundler = inject.slice(inject.indexOf('BUNDLER_HEAD = ('), inject.indexOf('def esc_json'));
[['wait.js', 'the dates'], ['mornings.js', 'the wall']].forEach(([f, what]) => {
  ok(shim.indexOf(f) >= 0, 'the shim injects ' + f + ' — ' + what + ' on a vanilla page');
  ok(bundler.indexOf(f) >= 0, 'and the bundler head injects it into the .dc.html exports');
});
ok(shim.indexOf('wait.js') < shim.indexOf('mornings.js'),
   'wait.js loads first, because mornings.js reads window.Wait');
ok(bundler.indexOf('wait.js') < bundler.indexOf('mornings.js'), 'same order inside the exports');

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
