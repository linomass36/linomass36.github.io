/* ─────────────────────────────────────────────────────────────
   season-gate.test.js — the season's arithmetic cannot be argued with.

   Run with `node tools/season-gate.test.js` from the repo root. Also run by
   the deploy.

   WHAT SHIPPED BROKEN. Nothing yet — this file is the reason, the same way
   wait-gate.test.js is. Season.html is only worth having if it computes its
   answers rather than remembering them: if `phase()` ever reports a season
   still live thirty days past its end, the page has quietly folded the
   Standing forever on the strength of a date typed in September, and the
   review it exists to force never happens.

   Every assertion here DRIVES THE CLOCK. Per CLAUDE.md: a test that reads
   Date.now() to decide whether a check-in has arrived passes until it
   arrives and then blocks every deploy from that day on.

   THE FOUR THINGS THIS NAILS DOWN
     1. every date derives from `started` — nothing is remembered twice
     2. past the end with no review is ABANDONED, not live
     3. an unlogged day is never a miss
     4. the night refuses to shave sleep to make the arithmetic close
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);

/* A localStorage that behaves like the real one, so read/save round-trip. */
function store(seed) {
  const map = Object.assign({}, seed || {});
  return {
    getItem: (k) => (k in map ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
    removeItem: (k) => { delete map[k]; },
    _map: map
  };
}

function load(seed) {
  const ls = store(seed);
  const ctx = { console, JSON, Object, Array, String, Number, Math, Date, isNaN,
                parseInt, parseFloat, localStorage: ls };
  ctx.globalThis = ctx; ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'day.js'), 'utf8'), ctx, { filename: 'day.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'season.js'), 'utf8'), ctx, { filename: 'season.js' });
  return { S: ctx.Season, ls };
}

/* The season this file is written against: declared on Wednesday 16 September
   2026, ninety days, a check-in every twenty-one. Local, because "day one" is
   a day where the phone is. */
const at = (y, m, d, h, mi) => new Date(y, m - 1, d, h, mi || 0, 0, 0).getTime();
const START = at(2026, 9, 16, 21, 40);
const seeded = (extra) => ({
  ct_season_v1: JSON.stringify(Object.assign({ started: START, days: 90, checkinEvery: 21,
                                               shiftStart: 8 * 60 }, extra || {}))
});

/* ── 1. every date comes out of the start date ────────────────────────── */
group('Every date is derived from the day it started');
{
  const { S } = load(seeded());
  const s = S.read();

  ok(S.day(s, at(2026, 9, 16, 22, 10)) === 1, 'the evening it was declared is day 1, not day 0');
  ok(S.day(s, at(2026, 9, 17, 6, 40)) === 2, 'the next morning is day 2');
  ok(S.day(s, at(2026, 10, 6, 19, 0)) === 21, '6 October is day 21');
  ok(S.endDay(s) === '2026-12-14', 'ninety days from 16 September ends 14 December');

  ok(S.checkins(s).join(',') === '21,42,63,84',
     'the check-ins are 21, 42, 63 and 84 — computed, never stored');
  ok(S.nextCheckin(s, at(2026, 9, 25, 9, 0)) === 21, 'on day 10 the next check-in is 21');
  ok(S.nextCheckin(s, at(2026, 10, 7, 9, 0)) === 42, 'the day after one passes, it is the next');
}

/* ── 2. the phase that stops the fold lasting forever ─────────────────── */
group('Past the end with no review is abandoned, not live');
{
  const { S } = load(seeded());
  const s = S.read();

  ok(S.phase(s, at(2026, 9, 20, 9, 0)) === 'running', 'day 5 is running');
  ok(S.phase(s, at(2026, 10, 6, 19, 0)) === 'checkin', 'day 21 is a check-in');
  ok(S.live(s, at(2026, 10, 6, 19, 0)) === true, 'a check-in day is still live');

  ok(S.phase(s, at(2026, 12, 15, 7, 10)) === 'abandoned',
     'day 91 with no review is abandoned — the surface must come back on its own');
  ok(S.live(s, at(2026, 12, 15, 7, 10)) === false, 'and abandoned is not live');
  ok(S.phase(s, at(2027, 3, 1, 7, 10)) === 'abandoned',
     'still abandoned months later — a stored flag would still be saying "live"');

  const ended = load(seeded({ ended: at(2026, 12, 14, 20, 0) })).S;
  ok(ended.phase(ended.read(), at(2026, 12, 20, 9, 0)) === 'ended',
     'a season closed on purpose reads as ended, not abandoned');

  const none = load({}).S;
  ok(none.phase(none.read(), at(2026, 9, 20, 9, 0)) === 'none',
     'no start date, no season — nothing is guessed');
  ok(none.day(none.read(), at(2026, 9, 20, 9, 0)) === null, 'and no day number either');
}

/* ── 3. renegotiation, and the record that survives it ────────────────── */
group('The rules shut at 21:00, and every change is on the record');
{
  const { S } = load(seeded());
  const s = S.read();

  ok(S.canEdit(s, at(2026, 9, 25, 14, 0)) === true, 'an ordinary afternoon can edit');
  ok(S.canEdit(s, at(2026, 9, 25, 22, 45)) === false, '22:45 on day 10 cannot');
  ok(S.canEdit(s, at(2026, 10, 6, 22, 45)) === true,
     'but 22:45 on a check-in day can — that is the day the season may change');

  S.amend('dose lowered', at(2026, 9, 22, 23, 10));
  S.amend('cadence changed', at(2026, 10, 6, 19, 30));
  const after = S.read();
  ok(after.amendments.length === 2, 'both changes are recorded');
  ok(S.offWindow(after).length === 1,
     'one of them was off-window — that is what the check-in opens with');
  ok(after.amendments[0].day === 7, 'and each carries the day it happened on');
}

/* ── 4. restarting costs a visible row ────────────────────────────────── */
group('Restarting a season archives the old one');
{
  const { S } = load(seeded());
  S.start(at(2026, 10, 1, 9, 0));
  const s = S.read();
  ok(s.archive.length === 1, 'the abandoned season is kept, not overwritten');
  ok(s.archive[0].started === START, 'with the date it actually ran from');
  ok(S.day(s, at(2026, 10, 1, 9, 0)) === 1, 'and the new one is on day 1');
}

/* ── 5. an unlogged day is never a miss ───────────────────────────────── */
group('Silence is not evidence of a miss');
{
  const seed = seeded();
  seed.ct_lifelog_v1 = JSON.stringify({ days: { '2026-09-18': { note: 'closed' } } });
  const { S } = load(seed);
  const s = S.read();
  const now = at(2026, 9, 20, 9, 0);

  ok(S.resolved('train', s, '2026-09-17', now) === 'untold',
     'a past day that was never closed stays untold — the board was told nothing');
  ok(S.resolved('train', s, '2026-09-18', now) === 'missed',
     'a past day that WAS closed, with no tick, is a real miss');
  ok(S.resolved('train', s, '2026-09-20', now) === 'untold',
     'and today is untold whatever the hour — nothing turns red inside its own day');

  const w = S.week(s, ['2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20'], now);
  ok(w.train.missed === 1 && w.train.notClosed === 3,
     'the week counts three not-closed against one real miss, and never sums them');
}

/* ── 6. the night refuses to shave sleep ──────────────────────────────── */
group('The night is computed backwards, and does not round up on its own');
{
  const { S } = load(seeded());
  const s = S.read();
  const n = S.night(s, at(2026, 9, 23, 19, 0));

  ok(S.morningMins() === 90, 'the morning chain is ninety minutes');
  ok(S.hhmm(n.leave) === '07:35', 'leave is the shift minus the commute');
  ok(S.hhmm(n.wake) === '06:05', 'wake is leave minus the morning');
  ok(S.hhmm(n.lights) === '22:05', 'lights out is wake minus eight hours');
  ok(S.hhmm(n.phone) === '21:20', 'and the phone goes down forty-five minutes before that');
  ok(n.late === false, '19:00 is not late');

  const slipped = S.night(s, at(2026, 9, 23, 23, 30));
  ok(slipped.late === true, '23:30 is late, and says so');
  ok(slipped.slip === 130, 'by two hours and ten, reported rather than absorbed');
  ok(slipped.bedNow === 6 * 60 + 35,
     'bed now is six thirty-five of sleep — the real cost, not a schedule that fits');

  /* The window crosses midnight, which is where the first version broke:
     23:30 reported itself on time and 01:00 reported a negative slip. */
  const past = S.night(s, at(2026, 9, 24, 1, 0));
  ok(past.late === true, '01:00 is still inside the night, not a fresh morning');
  ok(past.slip === 220, 'and the slip wraps past midnight rather than going negative');

  /* The third state. At 05:53 the window is technically still open, and the
     first version said "bed now is 12m" — true, and useless. */
  const spent = S.night(s, at(2026, 9, 24, 5, 53));
  ok(spent.late === true, '05:53 is still inside the night by the clock');
  ok(spent.gone === true, 'but the night is GONE — twelve minutes is not a bedtime');
  ok(spent.left === 12, 'and what is left is reported instead of offered as sleep');

  const stillReal = S.night(s, at(2026, 9, 24, 3, 0));
  ok(stillReal.late === true && stillReal.gone === false,
     '03:00 is late but not gone — three hours is still worth going to bed for');

  /* The 06:00 case: the phone hour has trivially "passed" and saying so would
     be nonsense. */
  const morning = S.night(s, at(2026, 9, 24, 6, 30));
  ok(morning.late === false, '06:30 is not "late for the phone" — that would be nonsense');

  /* A later shift moves every one of them, because none is stored. */
  const late = load(seeded({ shiftStart: 14 * 60 })).S;
  const ln = late.night(late.read(), at(2026, 9, 23, 19, 0));
  ok(late.hhmm(ln.wake) === '12:05', 'a 14:00 shift wakes at 12:05 — nothing is hardcoded');
}

/* ── 7. the next block is always answerable ───────────────────────────── */
group('There is always a next block, including on a day that went badly');
{
  const { S } = load(seeded());
  const n = S.next(S.read(), at(2026, 9, 23, 6, 45));
  ok(!!n.ask, 'a morning with nothing ticked still names one thing');
  ok(n.id === 'prayer_am', 'and it is the first thing in the order, not the easiest');
}

/* ── 8. the lapse log never leaves the device ─────────────────────────── */
group('The lap log is device-only, and the count says which device');
{
  const { S, ls } = load(seeded());
  S.lapHit(at(2026, 9, 19, 23, 40));
  S.lapBack(at(2026, 9, 19, 23, 51));
  S.lapHit(at(2026, 9, 24, 21, 10));
  S.lapBack(at(2026, 9, 24, 21, 25));

  ok(ls._map[S.LAP_KEY] != null, 'the bouts are stored');
  ok(S.LAP_KEY.indexOf('__local') === 0,
     'under a __local key — sync.js pushes everything else to Firestore in plaintext');

  /* THE ASSERTION THAT MATTERS. A future refactor that "tidies" this store
     into a ct_ key would upload a record of every lapse to the cloud and put
     it in every downloaded backup, silently, and nothing else would fail. */
  const syncable = Object.keys(ls._map).filter(k => k.indexOf('__local') !== 0 &&
                                                    k.indexOf('__sync') !== 0);
  syncable.forEach((k) => {
    const v = ls._map[k];
    ok(v.indexOf('"bouts"') < 0, 'no bout list under the syncable key ' + k);
    ok(!/"at"\s*:\s*\d{10,}/.test(v) || k !== S.KEY || JSON.parse(v).roll != null,
       'nothing timestamped per-bout escapes into ' + k);
  });

  const roll = JSON.parse(ls._map[S.KEY]).roll;
  ok(roll && roll.n === 2, 'the syncable rollup carries a count');
  ok(roll && roll.days === 2, 'and how many days it spanned');
  ok(!('bouts' in (roll || {})), 'and nothing else — a tally is not a record');

  ok(S.lapLatency() === 13, 'the median gap is thirteen minutes, not the mean');
  ok(S.lapCount() === 2, 'and both bouts are counted');
}

/* ── 9. a recalled bout is not a timed one ────────────────────────────── */
group('A bout logged the next morning is marked, not guessed at');
{
  const { S } = load(seeded());
  S.lapHit(at(2026, 9, 19, 23, 40));
  S.lapBack(at(2026, 9, 19, 23, 50));
  S.lapHit(at(2026, 9, 20, 22, 0), true);     // recalled the next day
  S.lapBack(at(2026, 9, 21, 8, 0));

  ok(S.lapCount() === 2, 'both are counted as bouts');
  ok(S.lapLatency() === 10,
     'but the recalled one is kept out of the median rather than reporting a ten-hour reset');
  ok(S.lapOpen() === null, 'and nothing is left open');
}

/* ── 9b. a mis-tap can be taken back ──────────────────────────────────────
   WHAT SHIPPED BROKEN: two bouts were recorded that never happened, and
   lapHit only ever pushed — there was no undo at any level of the UI. The
   count the check-in reads, the median reset and the syncable rollup all
   carried the mis-tap permanently, and the only way out was editing
   localStorage by hand. A log you cannot correct is not a more honest log; it
   is a wrong one, and a number you know to be wrong is one you stop reading. */
group('A bout recorded by accident can be taken back');
{
  const { S, ls } = load(seeded());
  S.lapHit(at(2026, 9, 19, 23, 40));
  S.lapBack(at(2026, 9, 19, 23, 50));
  S.lapHit(at(2026, 9, 24, 21, 10));          // the mis-tap
  S.lapHit(at(2026, 9, 24, 21, 11));          // and the second one

  ok(S.lapCount() === 3, 'three logged, two of them by accident');
  const gone = S.lapUndo();
  ok(gone && gone.at === at(2026, 9, 24, 21, 11), 'the undo returns the one it removed');
  S.lapUndo();
  ok(S.lapCount() === 1, 'and both mis-taps are gone');

  /* The rollup is what syncs, so it cannot be left claiming three. */
  ok(JSON.parse(ls._map[S.KEY]).roll.n === 1,
     'the syncable rollup is recomputed, not left disagreeing with the log');
  ok(S.lapOpen() === null, 'and removing an unclosed bout closes nothing behind it');
  ok(S.lapLatency() === 10, 'the median is read from what is left');

  /* It takes back the LAST one. It is not a delete tool, and an undo on an
     empty log is a no-op rather than a throw. */
  S.lapUndo();
  ok(S.lapCount() === 0 && S.lapUndo() === null, 'undoing an empty log does nothing');
}

/* ── 9c. the counter has to name its unit ─────────────────────────────────
   WHAT SHIPPED BROKEN: nothing anywhere said what a bout was. The word was
   on both surfaces, in the Guide, and inside the figure the check-in reads.
   A count whose unit is undefined is a shape, not a measurement. */
group('What counts as a bout is his to write, and it never leaves the device');
{
  const { S, ls } = load(seeded());
  ok(S.lapIs() === null, 'undefined until he says — the hub does not guess it for him');

  const SECRET = 'opening the app and ranking women I will never meet';
  S.lapDefine(SECRET);
  ok(S.lapIs() === SECRET, 'and then it is his words, kept verbatim');

  /* THE ASSERTION THAT MATTERS, and it matters more than the bout timestamps
     do: a sentence naming the behaviour is more revealing than a list of the
     times it happened. sync.js pushes every key that is not __local/__sync to
     Firestore in plaintext, so a refactor that "tidied" this into ct_season_v1
     would upload it, put it in every downloaded backup, and fail nothing. */
  Object.keys(ls._map).forEach((k) => {
    if (k.indexOf('__local') === 0 || k.indexOf('__sync') === 0) return;
    ok(ls._map[k].indexOf(SECRET) < 0, 'the definition is not in the syncable key ' + k);
  });
  ok(ls._map[S.LAP_KEY].indexOf(SECRET) >= 0, 'it is in the local one, beside the bouts');

  S.lapDefine('   ');
  ok(S.lapIs() === null, 'clearing it with blank space clears it rather than storing blanks');
  S.lapDefine(SECRET);
  S.lapHit(at(2026, 9, 19, 23, 40));
  S.lapUndo();
  ok(S.lapIs() === SECRET, 'and an undo takes back a bout, not the definition');
}

/* ── 9d. the derail button answers with a body ────────────────────────────
   WHAT SHIPPED BROKEN: pressed at night in a bad moment, it said "Next
   block: Anatomy block · 60 minutes" — after the phone was away and the
   evening prayer was ticked, so the day was already shut. It answered a
   struggle with a study block, which is the opposite of the protocol printed
   on the same page, and it read next(), which does not know the day is over. */
group('Derailing is answered with the body first, and never with the list');
{
  const seed = () => seeded({ sabbathDay: null });

  /* The reported case: 23:00, both night rows ticked. */
  {
    const { S } = load(seed());
    const night = at(2026, 9, 20, 23, 0);
    S.tick('phone', true, night);
    S.tick('prayer_pm', true, night);
    const d = S.derail(S.read(), night);
    ok(d.closed === true, 'phone away and the evening prayer ticked is a day that is shut');
    ok(d.owed === null, 'so nothing is owed — there is no honest next block at 23:00');
    ok(!/anatomy|Anatomy/.test(d.text), 'and it does not name a study block');
    ok(/bed/i.test(d.text), 'it names the body and then bed');
  }

  /* Mid-afternoon, plenty open. The interrupt still comes first, and what
     follows it is the SMALLEST thing open — an hour of anatomy is not a door
     you can get through in a bad minute. */
  {
    const { S } = load(seed());
    const noon = at(2026, 9, 21, 15, 0);
    const d = S.derail(S.read(), noon);
    ok(d.closed === false, 'the afternoon is not a shut day');
    ok(d.text.indexOf(d.move) === 0, 'the physical interrupt is the first thing said');
    ok(/outside/i.test(d.move), 'and in daylight it is out of the room, not a list');
    ok(d.owed && d.owed.mins === 10,
       'what follows is the smallest thing open (' + (d.owed && d.owed.mins) + 'm), not the next in order');
    ok(d.text.indexOf(d.move) < d.text.indexOf(String(d.owed.mins)),
       'and it is offered AFTER the interrupt, never instead of it');
  }

  /* Everything ticked but the night not yet answered: still open, nothing
     owed, and it says so rather than inventing something to do. */
  {
    const { S } = load(seed());
    const ev = at(2026, 9, 21, 20, 0);
    S.ROWS.forEach((r) => { if (r.mins > 0) S.tick(r.id, true, ev); });
    const d = S.derail(S.read(), ev);
    ok(d.owed === null && d.closed === false, 'a full day with the night still open owes nothing');
    ok(/Nothing is owed/.test(d.text), 'and it says so rather than inventing a block');
  }

  /* Both surfaces raise this alert. Two pages formatting the same object is
     how they come to disagree, so the words are built in one place. */
  {
    const { S } = load(seed());
    const d = S.derail(S.read(), at(2026, 9, 21, 15, 0));
    ok(typeof d.text === 'string' && d.text.length > 0,
       'the text is built in season.js, not twice in two pages');
  }
}

/* ── 10. the Anki projection refuses to guess ─────────────────────────── */
group('The backlog horizon comes from your own revlog, or not at all');
{
  const thin = seeded();
  thin.ct_anki_v1 = JSON.stringify({ dueTotal: 210, history: { cards: [80, 90, 100] } });
  const A = load(thin).S.anki();
  ok(A.due === 210, 'the queue is read, not derived');
  ok(A.rate === null && A.days === null,
     'three days of history is not a rate — "not enough history" beats an invented date');

  const full = seeded();
  full.ct_anki_v1 = JSON.stringify({
    dueTotal: 210,
    history: { cards: [0, 120, 100, 0, 118, 130, 110, 118, 125, 0, 118, 118, 120, 118] }
  });
  const B = load(full).S.anki();
  ok(B.basis === 11, 'zero days are excluded — they are days off, not a slower rate');
  ok(B.rate === 118, 'the median reviewed day is 118 cards');
  ok(B.days === 2, 'so 210 due is two days, rounded up');

  const none = load(seeded()).S.anki();
  ok(none === null, 'no reading at all returns null rather than a zero');
}

/* ── 11. pressed at 22:14, meant tomorrow ─────────────────────────────── */
group('A season declared at night begins in the morning');
{
  const { S } = load({});
  const night = at(2026, 9, 16, 22, 14);
  S.start(night);
  let s = S.read();

  ok(S.day(s, at(2026, 9, 16, 22, 30)) === 1, 'pressed tonight, it is day 1 tonight');
  ok(S.state('manuscript', s, null, at(2026, 9, 16, 22, 30)) === 'na',
     'but the 06:05 manuscript block is NOT ASKED — the start time made it impossible');
  ok(S.state('prayer_pm', s, null, at(2026, 9, 16, 22, 30)) === 'na',
     'and so is the night block whose hour had already gone');

  /* Moving it is a correction, not a restart: an hour-long season in the
     archive would make that list a record of typos. */
  ok(S.canReschedule(s, at(2026, 9, 16, 22, 30)) === true, 'day one can still be moved');
  S.reschedule(S.tomorrow9(night), at(2026, 9, 16, 22, 30));
  s = S.read();
  ok(s.archive.length === 0, 'nothing is archived — it never ran');
  ok(s.amendments.length === 1, 'and the move is on the record anyway');
  ok(S.phase(s, at(2026, 9, 16, 23, 0)) === 'pending',
     'tonight the season is PENDING — declared, not begun');
  ok(S.day(s, at(2026, 9, 17, 9, 30)) === 1, 'and day 1 is tomorrow');
  ok(S.endDay(s) === '2026-12-15', 'with the end date moved with it');

  /* Past day one it is a restart again, and costs a row. */
  ok(S.canReschedule(s, at(2026, 9, 25, 9, 0)) === false,
     'on day 9 moving the start is no longer a typo');

  /* The page leads with the correction only when the start genuinely ate the
     day, so the threshold is asserted rather than eyeballed. */
  const ate = load({}).S;
  ate.start(at(2026, 9, 16, 22, 14));
  let na = 0;
  ate.ROWS.forEach((r) => { if (ate.state(r.id, ate.read(), null, at(2026, 9, 16, 22, 30)) === 'na') na++; });
  ok(na >= 3, 'a 22:14 start leaves at least three blocks it was never going to get (' + na + ')');

  const early = load({}).S;
  early.start(at(2026, 9, 17, 6, 30));
  let naEarly = 0;
  early.ROWS.forEach((r) => { if (early.state(r.id, early.read(), null, at(2026, 9, 17, 7, 0)) === 'na') naEarly++; });
  ok(naEarly === 0, 'a 06:30 start eats nothing, so the page never asks the question');

  const fresh = load({}).S;
  fresh.start(at(2026, 9, 17, 6, 30));
  ok(fresh.state('manuscript', fresh.read(), null, at(2026, 9, 17, 7, 0)) !== 'na',
     'a season started in the morning asks for the morning');
}

/* ── 12. the calendar decides when you get up ─────────────────────────── */
group('The night anchors on the first commitment, not on a stored shift');
{
  const seed = seeded();
  /* The reported day: a 07:00 hike before a 13:30 shift. The shift is not
     what decides the alarm, and a card answering 13:30 would be confidently
     useless. */
  seed.ct_week_v1 = JSON.stringify({
    days: { '2026-09-24': { blocks: [
      { title: 'Scribe shift', kind: 'work', from: '13:30', to: '19:30', allDay: false } ] } },
    own: { '2026-09-24': [
      { title: 'Hike', kind: 'own', from: '07:00', to: '10:30', allDay: false } ] }
  });
  const { S } = load(seed);
  const s = S.read();

  const n = S.night(s, at(2026, 9, 23, 23, 15));
  ok(n.anchor.source === 'calendar', 'the anchor comes from the week, not the stored shift');
  ok(n.anchor.title === 'Hike' && n.anchor.mins === 7 * 60,
     'and it is the EARLIEST commitment — the hike, not the shift behind it');
  ok(S.hhmm(n.wake) === '05:05', 'which puts the alarm at 05:05');
  ok(n.tight === true, 'and reports that the morning chain does not fit');
  ok(S.hhmm(n.wakeTrimmed) === '05:50',
     'naming what dropping the manuscript actually buys, rather than deciding it');

  /* Already past the hike: the next wake is governed by the NEXT day. */
  const after = S.night(s, at(2026, 9, 24, 21, 0));
  ok(after.anchor.source === 'default',
     'with nothing on the following day it falls back to the stored shift, and says so');

  /* An all-day event is not a time you have to be up for. */
  const allday = seeded();
  allday.ct_week_v1 = JSON.stringify({
    days: { '2026-09-24': { blocks: [
      { title: 'Birthday', kind: 'other', from: null, to: null, allDay: true } ] } }, own: {}
  });
  const A = load(allday).S;
  ok(A.night(A.read(), at(2026, 9, 23, 23, 15)).anchor.source === 'default',
     'an all-day block sets no alarm and is ignored');

  /* No calendar at all still works — every existing assertion depends on it. */
  const bare = load(seeded()).S;
  ok(bare.night(bare.read(), at(2026, 9, 23, 19, 0)).anchor.source === 'default',
     'and with no week stored the stored shift is still the answer');
}

/* ── 13. the day's own shape decides what is asked ────────────────────── */
group('A day the calendar has eaten does not ask for what it spent');
{
  const seed = seeded({ sabbathDay: 0 });
  /* A scribe shift then clinical shadowing, and the week dealt no session. */
  seed.ct_week_v1 = JSON.stringify({ days: { '2026-09-24': {
    session: null, free: 1.5, committed: 8, blocks: [
      { title: 'Scribe shift', kind: 'work', from: '13:30', to: '19:30', allDay: false },
      { title: 'Clinical shadowing', kind: 'work', from: '20:00', to: '22:00', allDay: false } ] } } });
  const { S } = load(seed);
  const s = S.read();
  const now = at(2026, 9, 24, 12, 0);

  ok(S.state('train', s, null, now) === 'na',
     'training is the WEEK’s call — no session dealt, none asked');
  ok(S.state('anatomy', s, null, now) === 'na',
     'and an hour of anatomy is not asked on an evening that ends at 22:00');
  ok(S.state('arrival', s, null, now) !== 'na',
     'but the arrival rule is never evicted — it costs no slot and decides the night');
  ok(S.state('prayer_am', s, null, now) === 'untold',
     'the morning is untouched by any of it');
  ok(S.eveningRoom(s, now) === 0, 'the evening room is measured, not assumed');

  /* A tick beats the plan: the week was wrong about that afternoon. */
  S.tick('train', true, now);
  ok(S.state('train', S.read(), null, now) === 'done',
     'and if you trained anyway, the tick is the fact and the plan was wrong');

  /* A day the week DID deal a session to asks for it. */
  const good = seeded({ sabbathDay: 0 });
  good.ct_week_v1 = JSON.stringify({ days: { '2026-09-25': {
    session: 'Strength A', free: 6, committed: 3, blocks: [
      { title: 'Scribe shift', kind: 'work', from: '08:00', to: '11:00', allDay: false } ] } } });
  const G = load(good).S;
  ok(G.state('train', G.read(), null, at(2026, 9, 25, 12, 0)) === 'untold',
     'a day with a session dealt asks for it');
  ok(G.state('anatomy', G.read(), null, at(2026, 9, 25, 12, 0)) === 'untold',
     'and an evening that is actually free still asks for anatomy');
}

/* ── 14. the sabbath holds, it does not un-ask ────────────────────────── */
group('The sabbath is held, not skipped');
{
  const { S } = load(seeded({ sabbathDay: 0 }));   // Sunday
  const sun = at(2026, 9, 27, 10, 0);
  ok(S.isSabbath(S.read(), sun) === true, 'Sunday is the declared sabbath');
  ok(S.state('train', S.read(), null, sun) === 'held', 'training is held');
  ok(S.state('anatomy', S.read(), null, sun) === 'held', 'so is the study');
  ok(S.state('prayer_am', S.read(), null, sun) === 'untold',
     'prayer is NOT held — it is the one thing the day is for');

  const mon = at(2026, 9, 28, 10, 0);
  ok(S.isSabbath(S.read(), mon) === false, 'and Monday is not');

  const none = load(seeded()).S;
  ok(none.isSabbath(none.read(), at(2026, 9, 27, 10, 0)) === false,
     'with no sabbath declared nothing is held — it is not assumed for you');
}

/* ── 15. the week counts, and the claim it is for ─────────────────────── */
group('Counts over seven days, and the reading refuses to guess');
{
  const seed = seeded({ sabbathDay: 0 });
  seed.ct_lifelog_v1 = JSON.stringify({ days: {
    '2026-09-21': {}, '2026-09-22': {}, '2026-09-23': {}, '2026-09-24': {} } });
  const { S } = load(seed);
  const now = at(2026, 9, 25, 12, 0);

  const days = S.lastDays(7, now);
  ok(days.length === 7 && days[6] === '2026-09-25',
     'seven day keys ending today, derived rather than assembled by the page');

  S.tick('manuscript', true, at(2026, 9, 22, 7, 0));
  S.tick('manuscript', true, at(2026, 9, 23, 7, 0));
  const wk = S.week(S.read(), days, now);
  ok(wk.manuscript.logged === 2, 'two logged');
  ok(wk.manuscript.missed === 2,
     'two real misses — the days the Life Log says were closed and nothing was ticked');
  /* Seven days ending Friday the 25th spans Sunday the 20th, and the sabbath
     is declared. It used to land here as a third not-closed day: isSabbath
     read the weekday off `now`, so every past day was asked "is it the
     sabbath at this moment" and told no. The day held by his own rule showed
     up in the week grid as one more blank. It is held, and counted as held. */
  ok(wk.manuscript.notClosed === 2,
     'two never closed, counted apart and never summed into the misses');
  ok(wk.manuscript.held === 1,
     'and the sabbath inside the window is held — derived from the DAY, not the clock');
  ok(wk.manuscript.logged + wk.manuscript.missed +
     wk.manuscript.held + wk.manuscript.notClosed === 7,
     'and the four buckets account for every day exactly once');
}

/* ── 16. the day-close reading ────────────────────────────────────────── */
group('The claim is read from the record, or not at all');
{
  const { S } = load(seeded());
  const thin = S.heavyRead(S.read(), S.lastDays(7, at(2026, 9, 25, 12, 0)));
  ok(thin.enough === false && thin.n === 0,
     'nothing logged is not a reading, and it says how many it needs');

  /* Eight days: four with both prayers kept and light, four without. */
  const st = S.read();
  st.ticks = {};
  const keys = S.lastDays(8, at(2026, 9, 25, 12, 0));
  keys.forEach((k, i) => {
    st.ticks[k] = (i % 2 === 0)
      ? { prayer_am: 1, prayer_pm: 1, heavy: 1 }
      : { heavy: 3 };
  });
  S.save(st);
  const r = S.heavyRead(S.read(), keys);
  ok(r.enough === true && r.n === 8, 'eight logged days is a reading');
  ok(r.keptN === 4 && r.missN === 4, 'split by whether both prayers were kept');
  ok(r.kept === 1 && r.miss === 3, 'and reported as medians, not means');
  ok(S.median([]) === null, 'an empty set has no median rather than a zero');
}

/* ── 17. the evening never asks for more than it has ──────────────────── */
group('What the evening asks for fits in the evening');
{
  /* Reported from a screenshot: home at 20:00, phone down at 21:20, and the
     board asking for the shower, an hour of anatomy AND Spanish. Eighty
     minutes of room, ninety-five minutes of asks. */
  const seed = seeded();
  seed.ct_week_v1 = JSON.stringify({ days: { '2026-09-17': {
    session: null, free: 2, committed: 9, blocks: [
      { title: 'Hike', kind: 'own', from: '07:00', to: '10:30', allDay: false },
      { title: 'Scribe shift + commute', kind: 'work', from: '13:30', to: '20:00', allDay: false }
    ] } } });
  const { S } = load(seed);
  const s = S.read();
  const evening = at(2026, 9, 17, 20, 5);

  const room = S.eveningRoom(s, evening);
  ok(room === 80, 'eighty minutes between getting home and the phone hour');

  const after = S.ROWS.filter((r) => r.grp === 'after');
  const asked = after.filter((r) => S.state(r.id, s, null, evening) !== 'na');
  const total = asked.reduce((t, r) => t + r.mins, 0);
  ok(total <= room,
     'and what it asks for fits inside that (' + total + ' of ' + room + ')');

  ok(S.state('arrival', s, null, evening) !== 'na',
     'the shower is still asked — it is never evicted');
  ok(S.state('anatomy', s, null, evening) !== 'na',
     'and the one block that fits behind it is asked');
  ok(S.state('spanish', s, null, evening) === 'na',
     'the one that does not fit is not');
}

/* ── 18. the fallback says which day it could not answer for ──────────── */
group('A default night says it is a default, and for which day');
{
  const seed = seeded();
  /* Today is in the week. Tomorrow is not. */
  seed.ct_week_v1 = JSON.stringify({ days: { '2026-09-17': { session: null, blocks: [
    { title: 'Hike', kind: 'own', from: '07:00', to: '10:30', allDay: false },
    { title: 'Scribe shift', kind: 'work', from: '13:30', to: '19:30', allDay: false } ] } } });
  const { S } = load(seed);
  const s = S.read();

  /* Before the hike, it is today's and it is named. */
  const early = S.night(s, at(2026, 9, 17, 6, 0)).anchor;
  ok(early.source === 'calendar' && early.when === 'today' && early.title === 'Hike',
     'before the first commitment the anchor is today’s, and named');

  /* After it — the state in the reported screenshot — the next wake belongs
     to tomorrow, and tomorrow is empty. Falling back is right; doing it
     silently is what made a filled-in calendar look ignored. */
  const later = S.night(s, at(2026, 9, 17, 8, 5)).anchor;
  ok(later.source === 'default', 'once it has passed, an empty tomorrow falls back');
  ok(later.when === 'tomorrow',
     'and the fallback says WHICH day it could not answer for');
  ok(later.forDay === '2026-09-18', 'naming the date, so it can be checked');

  /* Put tomorrow in and the fallback goes away. */
  const both = seeded();
  both.ct_week_v1 = JSON.stringify({ days: {
    '2026-09-17': { session: null, blocks: [
      { title: 'Hike', kind: 'own', from: '07:00', to: '10:30', allDay: false } ] },
    '2026-09-18': { session: null, blocks: [
      { title: 'Scribe shift', kind: 'work', from: '09:00', to: '17:00', allDay: false } ] } } });
  const B = load(both).S;
  const bn = B.night(B.read(), at(2026, 9, 17, 8, 5));
  ok(bn.anchor.source === 'calendar' && bn.anchor.when === 'tomorrow',
     'with tomorrow entered it anchors on tomorrow, from the calendar');
  ok(B.hhmm(bn.wake) === '07:05', 'and the alarm moves to match it');
}

/* ── 19. the board says where you are in the day ──────────────────────── */
group('The day has a now, and it is the group holding the next thing owed');
{
  /* The reported day: the season began that morning at 07:50, after the
     manuscript window, so the manuscript is not-asked and the morning is
     already behind him by lunchtime. Seeding `started` on the day before
     would leave the manuscript owed and the morning live — which is correct
     for THAT day and not the one being described. */
  const seed = { ct_season_v1: JSON.stringify({
    started: at(2026, 9, 17, 7, 50), days: 90, checkinEvery: 21, shiftStart: 8 * 60,
    ticks: { '2026-09-17': { prayer_am: 1 } }, amendments: [], archive: [] }) };
  seed.ct_week_v1 = JSON.stringify({ days: { '2026-09-17': { session: null, blocks: [
    { title: 'Hike', kind: 'own', from: '07:00', to: '10:30', allDay: false },
    { title: 'Scribe shift', kind: 'work', from: '13:30', to: '19:30', allDay: false } ] } } });
  const { S } = load(seed);
  const s = S.read();
  const noon = at(2026, 9, 17, 12, 33);

  /* Reported at 12:33, getting ready for a 13:30 shift: every block still on
     screen, with nothing saying which of them was for now. */
  ok(S.groupNow(s, noon) === 'day',
     'at 12:33 the live group is the one holding the next thing owed — Anki');
  ok(S.groupWhen('morning', s, noon) === 'past', 'the morning is behind');
  ok(S.groupWhen('day', s, noon) === 'now', 'work is now');
  ok(S.groupWhen('after', s, noon) === 'ahead', 'and the evening is ahead, not owed');
  ok(S.groupWhen('night', s, noon) === 'ahead', 'so is the night');

  /* Tick the thing and the day moves on by itself. */
  S.tick('anki', true, noon);
  ok(S.groupNow(S.read(), noon) === 'after',
     'ticking it moves the live group forward — no second clock decides this');
}

/* ── 19b. the board says what its own colours mean ────────────────────────
   WHAT SHIPPED BROKEN: the Standing card drew six states with three glyphs —
   a tick, a dash, a middle dot — and named none of them. On a declared
   sabbath four rows went gold with a dot in the box and the only sentence
   explaining it printed below the ninth row, off the bottom of a phone.
   Reported as "this weird brown thing that I don't understand", which is the
   right reading of a colour with no key. */
group('Every state has a word, and held says WHICH hold');
{
  const seed = seeded({ sabbathDay: 0 });          // sabbath on Sunday
  seed.ct_week_v1 = JSON.stringify({ days: {
    '2026-09-20': { session: 'Lower' },
    '2026-09-21': { session: null, committed: 8, blocks: [
      { title: 'Scribe shift', kind: 'work', from: '09:00', to: '17:00', allDay: false } ] } } });
  const { S } = load(seed);
  const sun = at(2026, 9, 20, 9, 0);
  const mon = at(2026, 9, 21, 9, 0);

  /* The reported screen: gold box, dot in it, nothing saying why. */
  ok(S.state('manuscript', S.read(), null, sun) === 'held', 'the sabbath holds the manuscript');
  ok(S.tag('manuscript', S.read(), null, sun) === 'sabbath',
     'and the row says SABBATH, not a middle dot and a colour');
  ok(S.tag('prayer_am', S.read(), null, sun) === '',
     'a row that is simply not done yet claims nothing — silence has no badge');

  /* The other hold is a different fact about the day and gets a different
     word: a condition you declared stands until you clear it, the sabbath
     comes round every week. "Held" with no reason is what confused him. */
  ok(S.tag('train', S.read(), null, mon) === 'not asked',
     'a day the week dealt no session says NOT ASKED rather than going quiet');

  S.tick('prayer_am', true, mon);
  ok(S.tag('prayer_am', S.read(), null, mon) === 'done', 'a tick reads as done');
  const g = load(Object.assign(seeded(), {
    ct_anki_v1: JSON.stringify({ at: '2026-09-21T12:00:00', repsToday: 212 }) })).S;
  ok(g.tag('anki', g.read(), '2026-09-21', mon) === 'anki',
     'and a row a board answered names the board instead');
  ok(/not reported/.test(g.tag('train', g.read(), '2026-09-21', mon)),
     'a source that has said nothing says so, rather than looking the same as untouched');
}

/* ── 20. the rows the hub answers for itself ──────────────────────────────
   WHAT SHIPPED BROKEN: Anki, training, anatomy and Spanish were rendered
   `disabled` because a board was supposed to answer them, and no board was
   ever read — state() consulted the ticks and nothing else. Four of the nine
   rows could not be completed by any means at all. Reported on day two of a
   ninety-day season as "why can't I check off Anki?", with a suite this size
   fully green: every assertion here was written because the arithmetic was
   right about rows nobody could reach. */
group('A read-out reads, and silence leaves the row tappable');
{
  const day = '2026-09-18';
  const now = at(2026, 9, 18, 21, 0);
  const base = () => ({ ct_season_v1: JSON.stringify({
    started: at(2026, 9, 16, 21, 40), days: 90, checkinEvery: 21, shiftStart: 8 * 60 }) });

  /* Nothing on any feed. The row is not done — and, crucially, not claimed
     by anything either, so the page has something to let him tap. */
  {
    const { S } = load(base());
    ok(S.srcDone('anki', day) === null, 'a feed that has not run says nothing');
    ok(S.state('anki', S.read(), day, now) === 'untold', 'so the row is untold');
    ok(S.from('anki', S.read(), day, now) === null, 'and nobody has answered it');
  }

  /* The sync landed today's reading. The row completes itself. */
  {
    const seed = base();
    seed.ct_anki_v1 = JSON.stringify({ at: day + 'T18:04:00', repsToday: 212, dueTotal: 40 });
    const { S } = load(seed);
    ok(S.srcDone('anki', day) === true, 'reps on the day is the day answered');
    ok(S.state('anki', S.read(), day, now) === 'done', 'and the row reads done');
    ok(S.from('anki', S.read(), day, now) === 'anki', 'naming the board that said so');
  }

  /* A reading stamped YESTERDAY is yesterday's work. ct_anki_v1 holds one
     reading and is overwritten on every sync; facts.js states the same rule
     where it lands the same number, and the hub must not invent reps. */
  {
    const seed = base();
    seed.ct_anki_v1 = JSON.stringify({ at: '2026-09-17T18:04:00', repsToday: 212 });
    const { S } = load(seed);
    ok(S.srcDone('anki', day) === null, 'a stale reading answers for its own day, not this one');
    ok(S.srcDone('anki', '2026-09-17') === true, 'and it does answer for that one');
  }

  /* Zero reps is not a no. "The sync ran and you reviewed nothing" and "you
     did not do Anki" are different statements and only one is in the data —
     promoting silence to a no is how an unlogged day becomes a miss. */
  {
    const seed = base();
    seed.ct_anki_v1 = JSON.stringify({ at: day + 'T18:04:00', repsToday: 0 });
    const { S } = load(seed);
    ok(S.srcDone('anki', day) === null, 'zero reps is silence, never a recorded miss');
    ok(S.resolved('anki', S.read(), day, at(2026, 9, 20, 9, 0)) === 'untold',
       'and an unclosed day with a zero reading is still untold two days later');
  }

  /* The dated training week, which is what CTTraining settles. */
  {
    const seed = base();
    seed.ct_week_v1 = JSON.stringify({ days: { [day]: { session: 'Lower', done: true } } });
    const { S } = load(seed);
    ok(S.state('train', S.read(), day, now) === 'done', 'a session the week recorded is done');
    ok(S.from('train', S.read(), day, now) === 'grind', 'from the grind board');
  }
  {
    const seed = base();
    seed.ct_week_v1 = JSON.stringify({ days: { [day]: { session: 'Lower' } } });
    const { S } = load(seed);
    ok(S.srcDone('train', day) === null, 'a session dealt but not ticked is not a session done');
  }

  /* Anatomy is MINUTES, not a declared tier. Declaring the tier is planning
     the day; the block is what followed. */
  {
    const seed = base();
    seed.ct_anatomy_v1 = JSON.stringify({ days: { [day]: { tier: 'full', minRead: 0, minDraw: 0 } } });
    const { S } = load(seed);
    ok(S.srcDone('anatomy', day) === null, 'a tier declared with no minutes is not a block');
    seed.ct_anatomy_v1 = JSON.stringify({ days: { [day]: { tier: 'full', minRead: 35, minDraw: 25 } } });
    const T = load(seed).S;
    ok(T.srcDone('anatomy', day) === true, 'minutes read or drawn are the block');
  }

  /* Spanish has no source in this hub. It was wired to a Life Log field that
     does not exist, which is indistinguishable from being wired. */
  {
    const { S } = load(base());
    ok(S.rowOf('spanish').src === 'tap', 'Spanish is a tap — nothing in the hub measures it');
    ok(S.srcDone('spanish', day) === null, 'and it claims no source');
    S.tick('spanish', true, now);
    ok(S.state('spanish', S.read(), day, now) === 'done', 'so the tap is the only answer, and it works');
  }

  /* Your tick outranks the board, both ways round. */
  {
    const seed = base();
    seed.ct_anki_v1 = JSON.stringify({ at: day + 'T18:04:00', repsToday: 0 });
    const { S } = load(seed);
    S.tick('anki', true, now);
    ok(S.state('anki', S.read(), day, now) === 'done', 'a tick answers a row the feed left silent');
    ok(S.from('anki', S.read(), day, now) === 'you', 'and the row says who answered');
  }

  /* A source that AFFIRMS outranks anything derived from the plan. Held,
     sabbath and evicted are statements about what the day was expected to
     hold; a recorded session is a statement about what it held. */
  {
    const seed = base();
    seed.ct_season_v1 = JSON.stringify({ started: at(2026, 9, 16, 21, 40), days: 90,
                                         checkinEvery: 21, shiftStart: 8 * 60, sabbathDay: 0 });
    seed.ct_week_v1 = JSON.stringify({ days: { '2026-09-20': { session: 'Lower', done: true } } });
    const { S } = load(seed);
    const sun = at(2026, 9, 20, 19, 0);
    ok(S.state('train', S.read(), '2026-09-20', sun) === 'done',
       'if you trained on the sabbath, you trained — the hold was about what was owed');
    ok(S.state('anatomy', S.read(), '2026-09-20', sun) === 'held',
       'and the rest of the day is still held');
  }

  /* The next block cannot name something a board has already recorded. */
  {
    const seed = base();
    seed.ct_anki_v1 = JSON.stringify({ at: day + 'T12:10:00', repsToday: 212 });
    const { S } = load(seed);
    const s = S.read();
    S.tick('prayer_am', true, at(2026, 9, 18, 6, 0));
    S.tick('manuscript', true, at(2026, 9, 18, 6, 30));
    const n = S.next(S.read(), at(2026, 9, 18, 13, 0));
    ok(n.id !== 'anki', 'the next block is not the one the sync already answered');
  }
}

console.log('\n' + (failed ? failed + ' FAILED' : 'all passed'));
process.exit(failed ? 1 : 0);
