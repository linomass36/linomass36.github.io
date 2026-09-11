/* ─────────────────────────────────────────────────────────────
   wait-gate.test.js — the wait's rules cannot be argued with at 02:00.

   Run with `node tools/wait-gate.test.js` from the repo root. Also run by
   the deploy.

   WHAT SHIPPED BROKEN. Nothing yet — this file is the reason. The Wait
   panel exists because a rule agreed once gets re-read by someone with a
   worse case for it, and the thing that makes it hold is that the page
   computes the answer rather than remembering it. So the computation is
   what has to be nailed down: if `phase()` ever returns "one bump" on a
   Tuesday, the page is not a gate, it is decoration with a countdown.

   Every assertion here DRIVES THE CLOCK. Per CLAUDE.md: a test that reads
   Date.now() to decide whether the window is open passes until the window
   opens and then blocks every deploy for a weekend — which is both an
   outage and, given what this page is for, the exact wrong weekend.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);

function load(file) {
  const ctx = { window: {}, console, JSON, Object, Array, String, Number, RegExp,
                Date, Math, Intl, isFinite, localStorage: undefined };
  ctx.globalThis = ctx; ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
  return ctx.window;
}

const W = load('wait.js').Wait;
const at = (y, m, d, h, mi) => new Date(y, m - 1, d, h, mi || 0, 0, 0).getTime();
/* The gates are local by contract — "Saturday night" is a Saturday night
   where the phone is — so those assertions use at(). Anything asserting HER
   clock has to be an absolute instant instead, or this file passes in UTC
   and fails on a runner set to New York. */
const utc = (y, m, d, h, mi) => Date.UTC(y, m - 1, d, h, mi || 0, 0, 0);

/* The wait this page was built for: the ask went out on the Thursday
   evening, so the agreed window is the Saturday night and the Sunday. */
const SENT = at(2026, 9, 10, 18, 31);
const askOnly = { sent: SENT, bumped: null, replied: null, closed: null };

/* ── 1. the dates come out of the send date ───────────────────────────── */
group('Every date is derived from the one stored fact');

ok(W.gates({ sent: null }) === null, 'no send date, no gates — nothing is guessed');

const g = W.gates(askOnly);
ok(g.bumpOpens.getDay() === 6, 'the bump window opens on a Saturday');
ok(g.bumpOpens.getHours() === 18, 'in the evening, not the morning the plan gives away');
ok(g.bumpOpens.getDate() === 12 && g.bumpOpens.getMonth() === 8,
   'which for a Thursday ask is Sat 12 Sep, the same weekend');
ok(g.bumpCloses.getDay() === 0 && g.bumpCloses.getDate() === 13,
   'and closes at the end of the Sunday');
ok(g.bumpCloses.getHours() === 23 && g.bumpCloses.getMinutes() === 59,
   'at the end of it, not at noon');

/* ── 2. a Saturday ask does not get bumped the same night ─────────────── */
group('The window is a weekend clear of the ask, not the next one on the calendar');

const satAsk = W.gates({ sent: at(2026, 9, 12, 20, 0) });
ok(satAsk.bumpOpens.getDate() === 19,
   'an ask sent Saturday evening waits for the FOLLOWING Saturday' +
   ' — got ' + W.on(satAsk.bumpOpens));

const satMorning = W.gates({ sent: at(2026, 9, 12, 9, 0) });
ok(satMorning.bumpOpens.getDate() === 19,
   'and so does one sent that morning — nine hours is not a wait');

/* ── 3. what today permits, hour by hour ──────────────────────────────── */
group('One phase at a time, and only one of them allows sending');

const phaseAt = (s, ts) => W.phase(s, ts);

ok(phaseAt(askOnly, at(2026, 9, 10, 23, 0)).id === 'hold', 'the night it went out: hold');
ok(phaseAt(askOnly, at(2026, 9, 11, 7, 0)).id === 'hold',
   'the Friday morning it was not answered overnight: hold');
ok(phaseAt(askOnly, at(2026, 9, 12, 11, 0)).id === 'hold',
   'Saturday morning: still hold, which is the hour this page is for');
ok(phaseAt(askOnly, at(2026, 9, 12, 17, 59)).id === 'hold', 'one minute early is early');

ok(phaseAt(askOnly, at(2026, 9, 12, 18, 0)).id === 'bump', 'Saturday 18:00: the window opens');
ok(phaseAt(askOnly, at(2026, 9, 13, 22, 0)).id === 'bump', 'Sunday night: still open');
ok(phaseAt(askOnly, at(2026, 9, 14, 0, 30)).id === 'done',
   'Monday 00:30 — the hour the exception gets invented — is closed');

const allows = ['none', 'hold', 'bump', 'done', 'called', 'replied']
  .filter((id) => {
    const probe = [
      [{ sent: null }, at(2026, 9, 12, 19, 0)],
      [askOnly, at(2026, 9, 11, 9, 0)],
      [askOnly, at(2026, 9, 12, 19, 0)],
      [askOnly, at(2026, 9, 15, 9, 0)],
      [askOnly, at(2026, 9, 20, 9, 0)],
      [{ sent: SENT, replied: at(2026, 9, 15, 9, 0) }, at(2026, 9, 15, 10, 0)]
    ];
    return probe.some(([s, t]) => { const p = W.phase(s, t); return p.id === id && p.allows; });
  });
ok(allows.length === 1 && allows[0] === 'bump',
   'exactly one phase allows a message to go out' +
   (allows.length === 1 ? '' : ' — got ' + JSON.stringify(allows)));

/* ── 4. the bump is spent once ────────────────────────────────────────── */
group('The bump is one, not one per weekend');

const bumped = { sent: SENT, bumped: at(2026, 9, 12, 19, 30), replied: null };
ok(W.phase(bumped, at(2026, 9, 13, 21, 0)).id === 'done',
   'a bump already sent closes the window early — the Sunday is not a second go');
ok(/bump went Saturday 12 Sep/.test(W.phase(bumped, at(2026, 9, 13, 21, 0)).line),
   'and the page says when it went, rather than that one went');

/* ── 5. a week later is a no, and the no has a floor ──────────────────── */
group('Silence resolves, and resolving it does not produce another message');

ok(W.phase(askOnly, at(2026, 9, 17, 12, 0)).id === 'done',
   'six days of nothing is still "done asking", not yet a verdict');
ok(W.phase(askOnly, at(2026, 9, 18, 12, 0)).id === 'called',
   'a week after the ask, it is a no');

/* The week runs from the LAST message, so using the bump moves the verdict.
   A week counted from the ask would call it two days after a bump nobody
   had had a chance to answer. */
ok(W.gates(bumped).callIt.getTime() > W.gates(askOnly).callIt.getTime(),
   'the week is counted from the last message sent, not from the first');
ok(W.phase(bumped, at(2026, 9, 18, 12, 0)).id === 'done',
   'so a bump on the 12th is not called on the 18th');

const called = W.phase(askOnly, at(2026, 9, 25, 12, 0));
ok(/guess that’s a no/.test(called.line), 'the verdict names the text it is refusing to send');
ok(/unless something real changes/.test(called.line), 'and the floor is conditional, not eternal');
ok(W.gates(askOnly).floor.getTime() - W.gates(askOnly).callIt.getTime() >= 80 * 86400000,
   'the floor is months rather than a fortnight');

/* ── 6. a reply beats the clock ───────────────────────────────────────── */
group('A reply ends the wait whatever the calendar says');

[at(2026, 9, 12, 19, 0), at(2026, 9, 25, 12, 0), at(2026, 11, 1, 12, 0)].forEach((t) => {
  const p = W.phase({ sent: SENT, replied: at(2026, 9, 12, 8, 0) }, t);
  ok(p.id === 'replied' && !p.allows, 'replied outranks the phase at ' + W.on(new Date(t)));
});
ok(/impulse/.test(W.phase({ sent: SENT, replied: SENT + 1000 }, SENT + 2000).line),
   'and says the thing that is actually hard about a late reply');

/* ── 7. her clock, or nothing ─────────────────────────────────────────── */
group('The Warsaw conversion is real or it says so');

const h = W.hers(at(2026, 9, 10, 18, 31));
if (h === null) {
  ok(true, 'this runtime cannot resolve ' + W.ZONE + ' — hers() returns null, ' +
           'which is the contract: not counted, never assumed');
} else {
  ok(h.hour >= 0 && h.hour <= 23, 'her hour is an hour of the day — got ' + h.hh + ':' + h.mm);
  ok(typeof h.awake === 'boolean', 'and says whether she is plausibly awake for it');
  ok(W.hers(utc(2026, 9, 11, 1, 0)).awake === false, '03:00 her time is not silence, it is night');
  ok(W.hers(utc(2026, 9, 11, 12, 0)).awake === true, '14:00 her time is');

  /* Phoenix does not observe DST and Warsaw does, so the gap is 9 hours in
     September and 8 in December. A page that hardcoded nine would be wrong
     from late October — which is inside the floor this page computes. */
  const sep = offsetFrom('America/Phoenix', utc(2026, 9, 11, 12, 0));
  const dec = offsetFrom('America/Phoenix', utc(2026, 12, 11, 12, 0));
  ok(sep === 9, 'in September she is 9 hours ahead of Phoenix — got ' + sep);
  ok(dec === 8, 'in December she is 8, and the page reads it rather than storing it — got ' + dec);
}

function offsetFrom(zone, ts) {
  const parts = (z) => {
    const o = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: z, hour12: false, year: 'numeric',
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(ts)).forEach((p) => { if (p.type !== 'literal') o[p.type] = p.value; });
    return Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour % 24, +o.minute);
  };
  return Math.round((parts(W.ZONE) - parts(zone)) / 3600000);
}

/* ── 8. the count that answers "has she had a chance" ─────────────────── */
group('Elapsed time is counted in her waking hours, not in yours');

const wh = W.wakingHours(SENT, at(2026, 9, 11, 7, 0));
if (wh === null) {
  ok(true, 'no Warsaw zone on this runtime — not counted');
} else {
  /* Sent 20:31 her time; by 16:00 her time next day she has been awake for
     eight hours of that day plus the two before bed. Waking up to nothing
     is a handful of hours, which is the entire point of printing it. */
  ok(wh <= 12, 'an overnight silence is a handful of her hours, not a day — got ' + wh);
  ok(W.wakingHours(SENT, SENT) === 0, 'no time has passed at the moment of sending');
  ok(W.wakingHours(SENT, SENT - 1000) === 0, 'and none before it');
  ok(W.wakingHours(null, at(2026, 9, 11, 7, 0)) === null, 'nothing sent, nothing counted');

  const night = W.wakingHours(utc(2026, 9, 10, 21, 30), utc(2026, 9, 11, 3, 0));
  ok(night === 0, 'a stretch entirely inside her night counts zero — got ' + night);

  const week = W.wakingHours(SENT, at(2026, 9, 17, 18, 31));
  ok(week > 90 && week < 110, 'a week is about a hundred of them — got ' + week);
}

/* ── 9. the store is the one the backup and sync already know ─────────── */
group('The store rides the plumbing that already exists');

ok(/^ct_[a-z_]+_v1$/.test(W.KEY), 'the key is ct_<thing>_v1 — got ' + W.KEY);
ok(W.KEY.indexOf('__local') !== 0 && W.KEY.indexOf('__sync') !== 0,
   'so backup.js carries it and sync.js pushes it, with nothing to register');

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
