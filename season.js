/* ─────────────────────────────────────────────────────────────────────────
   season.js — a bounded season, derived from the day it started.

   WHY THIS EXISTS. The same reason wait.js exists, one level up. A posture
   agreed calmly in September is re-litigated at 23:00 in October by someone
   with a worse case for it, and the failure mode is not forgetting the rules.
   It is arriving at a bad Tuesday with a plausible reason why tonight is the
   exception. So the season is not prose here, it is arithmetic: the page can
   say what day it is, whether the rules may be changed today, and what the
   night costs, because all of it is computed from the one fact worth storing.

   WHAT A SEASON IS. Three declared facts and nothing else:

     started   the timestamp everything derives from
     days      the edge, so it is not "forever" or "until I feel lonely"
     rules     at least one, or there is nothing to keep

   Miss any and it is not a season. No start date and nothing computes; no
   length and it is a mood; no rules and it is a date in a diary. `ended` is a
   fourth timestamp, null while it runs.

   LIVE IS DERIVED, NEVER STORED. A stored "season is on" flag cannot notice
   that its own end date went past — and that is the realistic failure, not a
   blow-up. Day 90 passes on a Monday you were busy, no review happens, and a
   surface that changes itself "while a season is live" changes forever on the
   strength of a date typed months ago. started + days against today catches
   it: past the end with no review is not live and not ended, it is ABANDONED,
   which is its own phase and reads as one.

   A LAPSE NEVER ENDS A SEASON. Nothing here reads any lapse record, by
   design. And changing `started` does not extend a season — Season.html
   archives the old one first, because "restart the season" is otherwise the
   loophole that eats every bad fortnight.

   Stored under ct_season_v1. sync.js carries every ct_* key, so a season
   declared on the laptop is standing on the phone.
   ───────────────────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';
  /* Linked by Season.html AND injected into every page by the deploy, the
     same way wait.js is, because the Standing will want to read a day number
     on a page that never heard of this file. Loading twice is harmless but
     inlines the file twice behind the vault, so the second run bows out. */
  if (w.Season) return;

  var KEY = 'ct_season_v1';

  var DEFAULT_DAYS = 90;
  var DEFAULT_CHECKIN = 21;

  /* The night, computed backwards from one stored fact. See night() below. */
  var DEFAULT_SHIFT = 8 * 60;      // 08:00
  var COMMUTE = 25;
  var SLEEP = 8 * 60;
  var WIND = 45;                   // phone down to lights out

  /* The morning chain. These minutes are the SAME numbers the day's order
     carries, declared once here, because two figures for one block is how a
     06:05 alarm quietly becomes a 05:40 one. */
  var CHAIN = [
    ['Prayer', 10],
    ['Shower', 15],
    ['Manuscript', 45],
    ['Breakfast', 20]
  ];

  function readJSON(k, fb) {
    try { var r = localStorage.getItem(k); if (r) { var v = JSON.parse(r); if (v != null) return v; } }
    catch (e) {}
    return fb;
  }
  function writeJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }

  function read() {
    var s = readJSON(KEY, null);
    if (!s || typeof s !== 'object') s = {};
    if (s.days == null) s.days = DEFAULT_DAYS;
    if (s.checkinEvery == null) s.checkinEvery = DEFAULT_CHECKIN;
    if (s.shiftStart == null) s.shiftStart = DEFAULT_SHIFT;
    if (!Array.isArray(s.amendments)) s.amendments = [];
    if (!Array.isArray(s.archive)) s.archive = [];
    return s;
  }
  function save(s) { return writeJSON(KEY, s); }

  /* Which day a moment belongs to. day.js owns the 05:00 boundary; a season
     started at 22:00 on Tuesday should still say "day 1" at 01:00 that night,
     because that is the same day you declared it on. */
  function dayKey(ts) {
    if (w.CTDay) return w.CTDay.key(ts);
    var d = ts == null ? new Date() : new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }
  function between(a, b) {
    if (w.CTDay) return w.CTDay.between(a, b);
    return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
  }

  /* ── the derived calendar ───────────────────────────────────────────────
     Day 1 is the day it started, not the day after. `now` is accepted so the
     tests can drive the clock rather than read it — per CLAUDE.md, a test
     that asserts "the check-in has not arrived" against Date.now() passes
     until it arrives and then blocks every deploy forever. */
  function day(s, now) {
    s = s || read();
    if (!s.started) return null;
    return between(dayKey(s.started), dayKey(now)) + 1;
  }

  function endDay(s) {
    s = s || read();
    if (!s.started) return null;
    var k = dayKey(s.started);
    if (w.CTDay) return w.CTDay.shift(k, s.days - 1);
    var d = new Date(k + 'T12:00:00');
    d.setDate(d.getDate() + (s.days - 1));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  /* Every check-in date, derived. Day 21, 42, 63, 84 for a 90/21 season —
     never stored, so changing the cadence moves all of them at once. */
  function checkins(s) {
    s = s || read();
    if (!s.started) return [];
    var out = [], n = s.checkinEvery;
    while (n <= s.days) { out.push(n); n += s.checkinEvery; }
    return out;
  }
  function isCheckin(s, now) {
    var d = day(s, now);
    if (d == null) return false;
    return checkins(s).indexOf(d) >= 0;
  }
  function nextCheckin(s, now) {
    var d = day(s, now);
    if (d == null) return null;
    var list = checkins(s);
    for (var i = 0; i < list.length; i++) if (list[i] >= d) return list[i];
    return null;
  }

  /* pending · running · checkin · abandoned · ended */
  function phase(s, now) {
    s = s || read();
    if (!s.started) return 'none';
    if (s.ended) return 'ended';
    var d = day(s, now);
    if (d < 1) return 'pending';
    if (d > s.days) return 'abandoned';
    return isCheckin(s, now) ? 'checkin' : 'running';
  }
  function live(s, now) {
    var p = phase(s, now);
    return p === 'running' || p === 'checkin';
  }

  /* ── renegotiation ──────────────────────────────────────────────────────
     Not a lock. You own the store and you know where the JSON editor is, so
     a lock would buy ninety seconds and no memory of the attempt. What this
     buys instead is that every out-of-window change is stamped and read back
     at the check-in, which is the only thing that survives contact with the
     person who wants to change the rules at 23:00. */
  var SHUT_HOUR = 21;

  function canEdit(s, now) {
    var d = now == null ? new Date() : new Date(now);
    if (isCheckin(s, now)) return true;
    return d.getHours() < SHUT_HOUR;
  }

  function amend(what, now) {
    var s = read();
    s.amendments.push({
      at: (now == null ? Date.now() : now),
      day: day(s, now),
      onCheckin: isCheckin(s, now),
      what: String(what || '').slice(0, 300)
    });
    save(s);
    return s.amendments[s.amendments.length - 1];
  }

  /* Amendments made outside a check-in — what the check-in opens with. */
  function offWindow(s) {
    s = s || read();
    return s.amendments.filter(function (a) { return !a.onCheckin; });
  }

  /* ── starting, and the loophole it closes ───────────────────────────────
     Changing `started` does not extend a season. The old one is archived with
     its dates intact first, so "I'll just restart it" costs a visible row
     rather than nothing. */
  function start(atMs) {
    var s = read();
    if (s.started) {
      s.archive.push({ started: s.started, ended: Date.now(), days: s.days,
                       reason: 'restarted' });
    }
    s.started = (atMs == null ? Date.now() : atMs);
    s.ended = null;
    save(s);
    return s;
  }

  /* Tomorrow morning, which is when a season declared in the evening actually
     begins. The declaration is written tonight; the season is lived from the
     morning, and starting the clock at 22:00 spends a third of day one on a
     day that is already over. */
  function tomorrow9(now) {
    var d = now == null ? new Date() : new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  }

  /* MOVING THE START IS NOT RESTARTING IT, while the season has not really
     begun. start() archives the old season, which is right for "I fell off
     and I am going again" and absurd for "I pressed the button and meant
     tomorrow" — that would file a season that ran for an hour, and make the
     archive a list of typos rather than a record of attempts. So within day
     one it is a correction: the date moves, an amendment is stamped, nothing
     is archived. Past that it is a restart and it costs a row. */
  function canReschedule(s, now) {
    s = s || read();
    if (!s.started) return false;
    var d = day(s, now);
    return d != null && d <= 1;
  }
  function reschedule(atMs, now) {
    var s = read();
    if (!canReschedule(s, now)) return start(atMs);
    var was = s.started;
    s.started = atMs;
    s.amendments.push({
      at: (now == null ? Date.now() : now), day: 1, onCheckin: false,
      what: 'start moved from ' + dayKey(was) + ' to ' + dayKey(atMs) + ' before day one ran'
    });
    save(s);
    return s;
  }
  function end(atMs) {
    var s = read();
    s.ended = (atMs == null ? Date.now() : atMs);
    save(s);
    return s;
  }

  /* ── the night, computed backwards ──────────────────────────────────────
       leave  = shift  − commute
       wake   = leave  − the morning chain
       lights = wake   − sleep need
       phone  = lights − wind-down

     WHAT IT MUST NOT DO is shave sleep to make the arithmetic close. When the
     phone-down time has already passed it reports that and the real cost of
     each way out, rather than quietly producing a schedule that fits. Same
     rule as Money.convert() returning null on a missing rate: a number that
     is quietly wrong is worse than "not counted". A schedule that always fits
     is a schedule that lies, and getting up earlier for the manuscript only
     works if the bedtime is real. */
  function morningMins() {
    return CHAIN.reduce(function (a, c) { return a + c[1]; }, 0);
  }
  function wrap(x) { return ((x % 1440) + 1440) % 1440; }

  /* ── THE ANCHOR, READ FROM THE CALENDAR ─────────────────────────────────
     The night was computed from one stored `shiftStart`, which is wrong twice
     over: shifts vary, and the thing that actually decides when you get up is
     not the shift — it is the FIRST fixed commitment of the day, whatever it
     happens to be. A 07:00 hike before a 13:30 shift governs the alarm
     completely, and a card that answered 13:30 would be confidently useless.

     ct_week_v1 already holds both halves: `days[iso].blocks` are the ones
     pulled from Google, `own[iso]` the ones typed in on the Week. Neither is
     re-derived here — this reads the same store the Week writes, so an event
     added there moves the bedtime here without a second place to keep it.

     THE ANCHOR IS NAMED in what comes back, so the number can be argued with
     rather than taken on faith. "Wake 05:05" is a demand; "wake 05:05,
     because Hike is at 07:00" is an argument you can check. */
  var WEEK_KEY = 'ct_week_v1';

  function hhmmToMins(v) {
    if (!v || typeof v !== 'string') return NaN;
    var p = v.split(':');
    var h = parseInt(p[0], 10), m = parseInt(p[1], 10) || 0;
    return isNaN(h) ? NaN : h * 60 + m;
  }
  function blocksOn(key) {
    var wk = readJSON(WEEK_KEY, null);
    if (!wk || typeof wk !== 'object') return [];
    var out = [];
    var d = wk.days && wk.days[key];
    if (d && Array.isArray(d.blocks)) out = out.concat(d.blocks);
    if (wk.own && Array.isArray(wk.own[key])) out = out.concat(wk.own[key]);
    return out.filter(function (b) { return b && !b.allDay && b.from; });
  }
  function anchorOn(key) {
    var list = blocksOn(key).map(function (b) {
      return { mins: hhmmToMins(b.from), title: b.title || '(untitled)', kind: b.kind || 'other' };
    }).filter(function (b) { return !isNaN(b.mins); })
      .sort(function (a, b) { return a.mins - b.mins; });
    return list.length ? list[0] : null;
  }
  function nextDayKey(key) {
    if (w.CTDay) return w.CTDay.shift(key, 1);
    var d = new Date(key + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  /* Which day's anchor governs the NEXT time you have to be up. Before
     today's, you are already awake for it; after it, the one that matters is
     tomorrow's. The single stored shiftStart stays the fallback for a day the
     calendar says nothing about, and the result says which it used. */
  function anchor(s, now) {
    s = s || read();
    var d = now == null ? new Date() : new Date(now);
    var mins = d.getHours() * 60 + d.getMinutes();
    var todayKey = dayKey(now);
    var tomKey = nextDayKey(todayKey);
    var a = anchorOn(todayKey);
    if (a && mins < a.mins) {
      return { mins: a.mins, title: a.title, kind: a.kind, source: 'calendar',
               forDay: todayKey, when: 'today' };
    }
    var b = anchorOn(tomKey);
    if (b) {
      return { mins: b.mins, title: b.title, kind: b.kind, source: 'calendar',
               forDay: tomKey, when: 'tomorrow' };
    }
    /* THE CASE THAT LOOKED LIKE A BUG. Today's first commitment has already
       passed, so the next wake belongs to tomorrow — and tomorrow is not in
       the week. Falling back to the stored shift is right; printing four bare
       numbers as though they came from the calendar is not. Someone who has
       carefully entered today then sees an alarm that ignores it and
       reasonably concludes nothing is wired up. So the fallback says which
       day it could not answer for. */
    return { mins: (s.shiftStart == null) ? DEFAULT_SHIFT : s.shiftStart,
             title: null, kind: 'shift', source: 'default',
             forDay: (a && mins >= a.mins) ? tomKey : todayKey,
             when: (a && mins >= a.mins) ? 'tomorrow' : 'today' };
  }

  function night(s, now) {
    s = s || read();
    var anc = anchor(s, now);
    var start = anc.mins;
    var morning = morningMins();
    var leave = start - COMMUTE;
    var wake = leave - morning;
    var lights = wake - SLEEP;
    var phone = lights - WIND;
    var d = now == null ? new Date() : new Date(now);
    var mins = d.getHours() * 60 + d.getMinutes();
    var phoneW = wrap(phone), wakeW = wrap(wake);
    /* "Late" is the window from the phone hour to the alarm, and that window
       CROSSES MIDNIGHT — which a plain `mins > phone && mins < wake` does not,
       so 23:30 reported itself as on time and 01:00 reported a negative slip.
       At 06:30 the phone hour has trivially "passed" and saying so would be
       nonsense, which is the case the naive comparison was reaching for and
       the reason it looked right. */
    var late = (phoneW < wakeW)
      ? (mins >= phoneW && mins < wakeW)
      : (mins >= phoneW || mins < wakeW);

    /* THE THIRD STATE, and it is the one the first version got wrong. At 05:53
       the window is technically still open, so the card read "the phone was
       due eight hours ago, bed now is 12m" — true, and useless, because
       twelve minutes before the alarm nobody is deciding whether to go to bed.
       Advice that does not hold is the same failure as a schedule that always
       fits, so past a floor the honest line is that the night is spent and the
       wake time stands. */
    var GONE_FLOOR = 90;
    var left = wrap(wakeW - mins);
    var gone = late && left < GONE_FLOOR;

    /* A 07:00 anchor and a ninety-minute morning wants you up at 05:05, which
       is arithmetically true and not a thing anyone does before a hike. So the
       chain is reported as NOT FITTING rather than demanded: the manuscript is
       the only elastic block in it, and dropping it is named with its cost
       instead of being decided here. Same rule as everything else on this
       card — it does not shave to make the numbers close. */
    var TIGHT_FLOOR = 5 * 60 + 30;
    var manuscript = 0;
    CHAIN.forEach(function (c) { if (c[0] === 'Manuscript') manuscript = c[1]; });
    var tight = wakeW < TIGHT_FLOOR;
    return {
      anchor: anc, gone: gone, left: left, goneFloor: GONE_FLOOR,
      tight: tight, tightFloor: TIGHT_FLOOR, manuscript: manuscript,
      wakeTrimmed: wrap(wakeW + manuscript),
      shiftStart: start, commute: COMMUTE, morning: morning, chain: CHAIN.slice(),
      leave: wrap(leave), wake: wakeW, lights: wrap(lights), phone: phoneW,
      now: mins, late: late,
      slip: late ? wrap(mins - phoneW) : 0,
      /* If lights go out now, this is what is left before the alarm. */
      bedNow: wrap(wake - mins)
    };
  }

  function hhmm(x) {
    x = wrap(x);
    var h = Math.floor(x / 60), m = x % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  function hm(x) {
    var h = Math.floor(x / 60), m = x % 60;
    if (!h) return m + 'm';
    return h + 'h' + (m ? (m < 10 ? '0' : '') + m : '');
  }

  /* ── the day's order ────────────────────────────────────────────────────
     `src` names the board that can answer a row without being asked. Five
     things you tap; three the hub already measures and will therefore not
     ask you about twice — if the grind board recorded a session, there is
     one answer to that question, not two.

     WHAT SHIPPED BROKEN: those rows could not be completed at all. They were
     rendered `disabled` on the strength of that rule, and then nothing ever
     read the boards — `state()` consulted the ticks and nothing else. Anki,
     training, anatomy and Spanish were untappable AND unread, which is to say
     permanently untold. Reported on day two of a ninety-day season as "why
     can't I check off Anki?", and a board that cannot record the day is worse
     than no board, because the empty column reads as the truth about you.

     A read-out now reads. It is locked only while the source has actually
     ANSWERED; a source that has not run yet is silence, and silence is a row
     you can still tap. That is the same rule dayEats already states — the
     tick is the fact, the plan was wrong — extended from the calendar to the
     feeds.

     Spanish is a tap. It was given `src:'log'` against a Life Log field that
     does not exist: wired to nothing, and indistinguishable from wired. */
  var ROWS = [
    { id: 'prayer_am',  grp: 'morning', ask: 'Prayer',              mins: 10, src: 'tap' },
    { id: 'manuscript', grp: 'morning', ask: 'Manuscript block',    mins: 45, src: 'tap' },
    { id: 'anki',       grp: 'day',     ask: 'Anki',                mins: 25, src: 'anki' },
    { id: 'train',      grp: 'after',   ask: 'Training',            mins: 60, src: 'grind' },
    { id: 'arrival',    grp: 'after',   ask: 'Shower before couch · no trigger apps', mins: 20, src: 'tap' },
    { id: 'anatomy',    grp: 'after',   ask: 'Anatomy block',       mins: 60, src: 'anatomy' },
    { id: 'spanish',    grp: 'after',   ask: 'Spanish',             mins: 15, src: 'tap', secondary: true },
    { id: 'phone',      grp: 'night',   ask: 'Phone off',           mins: 0,  src: 'tap' },
    { id: 'prayer_pm',  grp: 'night',   ask: 'Prayer',              mins: 10, src: 'tap' }
  ];
  var GROUPS = { morning: 'Morning', day: 'At work', after: 'After the shift', night: 'Night' };

  function ticks(s, key) {
    s = s || read();
    var t = (s.ticks && typeof s.ticks === 'object') ? s.ticks : {};
    return t[key || dayKey()] || {};
  }
  function tick(id, onOff, now) {
    var s = read();
    var k = dayKey(now);
    if (!s.ticks || typeof s.ticks !== 'object') s.ticks = {};
    if (!s.ticks[k]) s.ticks[k] = {};
    if (onOff === false) delete s.ticks[k][id];
    else s.ticks[k][id] = 1;
    save(s);
    return s.ticks[k];
  }

  /* ── the four states, and the fourth is the point ───────────────────────
     done · floor · missed · untold, plus held.

     A row the board was not told about is UNTOLD, and untold never counts
     against the week. The same rule screen.js already states for the phone's
     buckets: a missing bucket is not a zero, because treating the blank as
     0.0 is the hub inventing data.

     And NOTHING TURNS RED INSIDE THE DAY IT IS OWED. Red is retrospective
     only, so the board cannot deliver a verdict at 21:00 on the evening you
     are least able to take one. That is not a decoration — a board that reads
     as an accusation at the weak hour is the thing that ends the fortnight.

     A held condition wins over all of it: conditions.js already decides what
     is held, and a day being held is a fact about what is owed, not a miss. */
  function heldIds() {
    var out = {};
    try {
      var C = w.Conditions;
      if (!C || typeof C.stopping !== 'function') return out;
      var stopping = C.stopping() || [];
      var ids = {};
      stopping.forEach(function (c) {
        (c.systems || []).forEach(function (sys) { ids[sys] = 1; });
      });
      if (ids.grind)   out.train = 1;
      if (ids.anatomy) out.anatomy = 1;
      if (ids.study)   { out.anki = 1; }
    } catch (e) {}
    return out;
  }

  /* ── NOT ASKED, which is different from not done ────────────────────────
     A season started at 22:14 spent day one on a day that was already over,
     and the card then asked for a 06:00 manuscript block — a thing the start
     time itself had made impossible. Grey says "you did not tell me"; this
     says "it was never yours to do", and the difference matters on exactly
     the day a person is deciding whether the thing is worth keeping.

     Same rule as the night refusing to offer a bedtime twelve minutes before
     the alarm: advice that cannot be taken is not advice. It only ever
     applies to the day the season began — every day after opens at the top. */
  function windowEnd(grp, s, now) {
    var n = night(s, now);
    if (grp === 'morning') return n.leave;
    if (grp === 'day')     return wrap(n.shiftStart + 9 * 60);
    if (grp === 'after')   return n.phone;
    return n.lights;
  }
  /* ── THE DAY'S SHAPE, READ FROM THE WEEK ────────────────────────────────
     Asked: "If nothing connects to the calendar then how did the season know
     when to train, do sabbath, etc. with my work and clinical shadowing?"

     It did not. The nine rows were the same nine rows every day of the week,
     which is a fair model of a life with one fixed shift and a fiction for
     anyone whose Tuesday is eaten by clinic. calendar.js's own header says
     this about the grind board's fixed `week|day` grid: a week where clinic
     eats Tuesday cannot be expressed.

     ct_week_v1 already holds the answer and nothing was reading it:

       session   which training session the week dealt to this day, or null
                 for a rest day. CTTraining owns that decision; asking for a
                 session on a day the plan gave none is the board and the
                 week disagreeing about the same afternoon.
       free      waking hours not already committed
       blocks    the commitments themselves, with their hours

     So a block is NOT ASKED when the day cannot hold it — the same state day
     one already used for hours the start time had spent. Not missed. Never
     yours to do. */
  function weekDay(key) {
    var wk = readJSON(WEEK_KEY, null);
    if (!wk || !wk.days) return null;
    return wk.days[key] || null;
  }

  /* One declared day a week where nothing accrues. His own rules put it
     highest — "mandatory, and never the catch-up day" — so it is HELD rather
     than not-asked: held is a fact about what is owed, and the numbers still
     render. Stored as a weekday index because that is the only input; which
     dates it lands on is derived.

     It answers for a DAY, not for the clock. Reading the weekday off `now`
     meant every past day was asked "is it the sabbath right now" and told no,
     so a kept sabbath resolved to a miss the following Monday — the one day
     of the week held by his own rule, counted against him for keeping it. */
  function isSabbath(s, now, dKey) {
    s = s || read();
    if (s.sabbathDay == null) return false;
    var d = dKey ? new Date(dKey + 'T12:00:00')
                 : (now == null ? new Date() : new Date(now));
    if (isNaN(d)) return false;
    return d.getDay() === s.sabbathDay;
  }
  var SABBATH_HOLDS = { train: 1, anatomy: 1, spanish: 1, anki: 1, manuscript: 1 };

  function dayPlan(s, now) {
    s = s || read();
    var key = dayKey(now);
    var wd = weekDay(key);
    var blocks = blocksOn(key).map(function (b) {
      return { title: b.title, kind: b.kind,
               from: hhmmToMins(b.from), to: hhmmToMins(b.to) };
    }).filter(function (b) { return !isNaN(b.from); })
      .sort(function (a, b) { return a.from - b.from; });
    var lastEnd = null;
    blocks.forEach(function (b) {
      if (!isNaN(b.to) && (lastEnd == null || b.to > lastEnd)) lastEnd = b.to;
    });
    return {
      key: key, source: wd ? 'week' : 'none',
      session: wd ? (wd.session || null) : null,
      free: wd ? wd.free : null, committed: wd ? wd.committed : null,
      blocks: blocks, lastEnd: lastEnd,
      sabbath: isSabbath(s, now, key)
    };
  }

  /* What the evening can actually hold, once the last commitment ends and
     before the phone goes down. Returns null when nothing is known, because
     an unknown evening is not a full one. */
  function eveningRoom(s, now) {
    var p = dayPlan(s, now);
    if (p.lastEnd == null) return null;
    var n = night(s, now);
    var ends = n.phone;
    if (ends <= p.lastEnd) return 0;
    return ends - p.lastEnd;
  }

  function notAsked(id, s, now) {
    s = s || read();
    if (!s.started) return false;
    if (dayKey(s.started) !== dayKey(now)) return false;   // only the first day
    var r = null;
    for (var i = 0; i < ROWS.length; i++) if (ROWS[i].id === id) r = ROWS[i];
    if (!r) return false;
    var st = new Date(s.started);
    var mins = st.getHours() * 60 + st.getMinutes();
    var end = windowEnd(r.grp, s, now);
    /* Windows that wrap past midnight are still open, not long closed. */
    return end > 5 * 60 && mins > end;
  }

  /* Which rows the day itself has eaten. Two sources, both already stored:
     the week's own session plan for training, and the last commitment of the
     day for everything meant to happen after it. */
  function dayEats(id, s, now) {
    s = s || read();
    var p = dayPlan(s, now);
    if (p.source === 'none') return false;          // nothing known, nothing claimed

    /* TRAINING IS THE WEEK'S CALL, not this file's. CTTraining deals the
       sessions round the committed hours; asking for one on a day it gave
       none is two surfaces disagreeing about the same afternoon. */
    if (id === 'train') return !p.session;

    /* The arrival rule is never evicted. It costs no slot — it is about HOW
       you come through the door, not a block competing for the evening — and
       on the days the calendar has eaten everything else it is the only thing
       left that decides how the night goes. */
    if (id === 'arrival') return false;

    var r = null;
    for (var i = 0; i < ROWS.length; i++) if (ROWS[i].id === id) r = ROWS[i];
    if (!r || r.grp !== 'after') return false;

    /* The evening, measured rather than assumed. Shadowing that runs to 22:00
       does not leave an hour of anatomy in the day, and a board that asks for
       it anyway is asking for something the calendar already spent. The rows
       are taken in order and the first that does not fit is where it stops. */
    var room = eveningRoom(s, now);
    if (room == null) return false;
    var used = 0;
    var after = ROWS.filter(function (x) { return x.grp === 'after'; });
    for (var j = 0; j < after.length; j++) {
      if (after[j].id === 'train' && !p.session) continue;
      /* The arrival rule cannot be EVICTED — it is how you come through the
         door, and on a day the calendar has eaten it is the only thing left
         that decides the night. But its minutes are still minutes. Exempting
         it from the eviction AND from the arithmetic had an eighty-minute
         evening cheerfully asking for ninety-five: the shower takes twenty
         whether or not it can be dropped, so it is counted first and the
         blocks behind it compete for what is actually left. */
      used += after[j].mins;
      if (after[j].id === 'arrival') continue;
      if (after[j].id === id) return used > room;
    }
    return false;
  }

  function rowOf(id) {
    for (var i = 0; i < ROWS.length; i++) if (ROWS[i].id === id) return ROWS[i];
    return null;
  }

  /* ── WHAT THE OTHER BOARDS ALREADY KNOW ─────────────────────────────────
     Returns true where the day's own record affirms the row, and null where
     it says nothing. Never false: "the board has no session for Tuesday" and
     "you did not train on Tuesday" are different statements, and only the
     first one is in the data. Promoting silence to a no is how an unlogged
     day becomes a miss, which is the thing this whole file is careful about.

     Each row is read from its OWNER, not re-derived here. CTFacts already
     joins the dated series — including the year of Anki rows the revlog
     backfilled, which is the only place a past day's reps exist — and
     CTTraining already settles the week-plan-versus-grind-board disagreement.
     Where a module is not on the page the store is read directly, under the
     same rule the module states.

     One honest seam: the feeds date themselves by the CALENDAR day, and the
     season's day boundary is CTDay's 05:00. Reviews done at half past midnight
     are therefore the source's idea of which day it was, not the season's.
     Taking the source's own dating is the lesser of the two lies — the
     alternative is the hub re-dating a reading it did not take. */
  function srcDone(id, dKey, ft) {
    var r = rowOf(id);
    if (!r || r.src === 'tap') return null;
    try {
      if (id === 'anki') {
        if (ft === undefined) ft = factsTable();
        var fr = ft && ft[dKey];
        if (fr && fr.ankiReps != null) return fr.ankiReps > 0 ? true : null;
        /* Without CTFacts only TODAY can be answered: ct_anki_v1 holds one
           reading and is overwritten on every sync, so a reading stamped
           yesterday says nothing at all about today. facts.js states the
           same rule where it lands the same number. */
        var a = readJSON('ct_anki_v1', null);
        if (!a || String(a.at || '').slice(0, 10) !== dKey) return null;
        var reps = a.repsToday != null ? a.repsToday : a.doneToday;
        if (reps == null) return null;
        return (parseInt(reps, 10) || 0) > 0 ? true : null;
      }
      if (id === 'train') {
        var T = w.CTTraining;
        if (T && typeof T.isDone === 'function') return T.isDone(dKey) ? true : null;
        var wk = readJSON(WEEK_KEY, null);
        var d = wk && wk.days && wk.days[dKey];
        return (d && d.done) ? true : null;
      }
      if (id === 'anatomy') {
        var an = readJSON('ct_anatomy_v1', null);
        var day = an && an.days && an.days[dKey];
        if (!day) return null;
        /* Minutes, not a declared tier. Declaring the day's tier is planning
           it; the block is the minutes that followed. anatomy-core counts
           these separately for exactly that reason. */
        var mins = (parseInt(day.minRead, 10) || 0) + (parseInt(day.minDraw, 10) || 0);
        return mins > 0 ? true : null;
      }
    } catch (e) {}
    return null;
  }

  function factsTable() {
    try {
      if (w.CTFacts && typeof w.CTFacts.all === 'function') return w.CTFacts.all() || null;
    } catch (e) {}
    return null;
  }

  /* Who answered. A tick with no author is a number without a source, which
     this repo has been bitten by three times — so the row says whether the
     board read it or you said it. */
  function from(id, s, dKey, now, ft) {
    s = s || read();
    dKey = dKey || dayKey(now);
    var t = ticks(s, dKey);
    if (t[id] === 1 || t[id] === 2) return 'you';
    if (srcDone(id, dKey, ft) === true) { var r = rowOf(id); return r ? r.src : null; }
    return null;
  }

  function state(id, s, dKey, now, ft) {
    s = s || read();
    dKey = dKey || dayKey(now);
    var t = ticks(s, dKey);
    /* YOUR TICK FIRST. If you trained on a day the week called rest, the week
       was wrong about your afternoon and the tick is the fact. */
    if (t[id] === 1) return 'done';
    if (t[id] === 2) return 'floor';
    /* Then a board that measured it. A source that affirms outranks anything
       derived from a PLAN — held, sabbath, not-asked and evicted are all
       statements about what the day was expected to hold, and a recorded
       session is a statement about what it held. */
    if (srcDone(id, dKey, ft) === true) return 'done';
    if (heldIds()[id] && dKey === dayKey(now)) return 'held';
    /* The sabbath is derived from the DAY, not from the clock: asking `now`
       which weekday it is answered for today on every day, so last Sunday
       resolved to a miss in the week grid — the one day of the week that is
       held by his own rule, counted against him for being kept. */
    if (isSabbath(s, now, dKey) && SABBATH_HOLDS[id]) return 'held';
    if (dKey === dayKey(now)) {
      if (notAsked(id, s, now)) return 'na';
      if (dayEats(id, s, now)) return 'na';
    }
    /* Today is still open, so an untouched row is untold rather than missed.
       A past day the board was never told about stays untold forever — it is
       not evidence of a miss, it is an absence of evidence. */
    return 'untold';
  }

  /* A past day resolves to missed ONLY where the day was closed — i.e. the
     Life Log has an entry for it. A day you never closed told the board
     nothing, and inventing a miss from silence is the bug this whole file is
     careful about. */
  function closed(dKey) {
    var l = readJSON('ct_lifelog_v1', null);
    return !!(l && l.days && l.days[dKey]);
  }
  function resolved(id, s, dKey, now, ft) {
    var st = state(id, s, dKey, now, ft);
    if (st !== 'untold') return st;
    if (dKey === dayKey(now)) return 'untold';
    return closed(dKey) ? 'missed' : 'untold';
  }

  /* The week, counted from the days rather than stored beside them.

     The joined table is read ONCE and handed down. A fortnight of nine rows
     asks a hundred and twenty-six questions, and CTFacts.all() unpacks a year
     of Anki rows every time it is called — which on a phone is the difference
     between a grid and a stall. */
  function week(s, days, now) {
    s = s || read();
    var out = {};
    var ft = factsTable();
    ROWS.forEach(function (r) {
      var logged = 0, open = 0, held = 0, missed = 0;
      days.forEach(function (k) {
        var st = resolved(r.id, s, k, now, ft);
        if (st === 'done' || st === 'floor') logged++;
        else if (st === 'held' || st === 'na') held++;
        else if (st === 'missed') missed++;
        else open++;
      });
      out[r.id] = { logged: logged, notClosed: open, held: held, missed: missed };
    });
    return out;
  }

  /* The last n day keys, ending today. */
  function lastDays(n, now) {
    var out = [], k = dayKey(now);
    for (var i = n - 1; i >= 0; i--) {
      out.push(w.CTDay ? w.CTDay.shift(k, -i) : k);
    }
    return out;
  }

  /* ── THE CLAIM, CHECKED ──────────────────────────────────────────────────
     "A day without her can be a good day" is the season's actual claim, and
     the day-close tap is the only thing that can test it. This is the read:
     the median heaviness on days the practices were kept against the days
     they were not.

     IT RETURNS NULL RATHER THAN A HINT. Under eight logged days there is no
     reading, and saying so beats a number computed from four evenings — the
     same rule as the Anki projection and Money.convert(). And what comes back
     is a correlation over days you logged, not a claim about cause: a lighter
     day is as likely to have produced the prayer as the other way round, and
     the page has to say so next to the figure rather than under it. */
  var MIN_HEAVY = 8;

  function median(xs) {
    if (!xs.length) return null;
    var a = xs.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  function heavyRead(s, days) {
    s = s || read();
    var kept = [], missed = [], n = 0;
    (days || []).forEach(function (k) {
      var t = ticks(s, k);
      if (t.heavy == null) return;
      n++;
      /* "Kept" is both prayers — the practice the claim is actually about,
         and the only one asked every single day including the sabbath. */
      (t.prayer_am && t.prayer_pm ? kept : missed).push(t.heavy);
    });
    if (n < MIN_HEAVY) return { n: n, enough: false, need: MIN_HEAVY };
    return {
      n: n, enough: true,
      keptN: kept.length, missN: missed.length,
      kept: median(kept), miss: median(missed)
    };
  }

  /* The next thing to do, always answerable — including on a day that has
     already gone badly, which is the only day it matters. */
  function next(s, now) {
    s = s || read();
    var n = night(s, now);
    var mins = n.now;
    /* Owed is exactly `untold`, and state() is the only thing that decides
       it. Re-testing held and not-asked here was a second opinion on the same
       question, and one that had never heard of the feeds: it went on naming
       Anki as the next block after the sync reported two hundred reps. */
    var ft = factsTable();
    var order = ROWS.filter(function (r) {
      return state(r.id, s, null, now, ft) === 'untold';
    });
    if (!order.length) return { ask: 'Nothing left. Sleep is the next block.', mins: 0 };
    /* After the shift, the morning's rows are gone rather than owed. */
    var evening = mins >= (n.shiftStart + 9 * 60) % 1440 || mins < 5 * 60;
    var pick = null;
    for (var i = 0; i < order.length; i++) {
      if (evening && (order[i].grp === 'morning' || order[i].grp === 'day')) continue;
      pick = order[i]; break;
    }
    if (!pick) pick = order[0];
    return { ask: pick.ask, mins: pick.mins, id: pick.id };
  }

  /* ── THE LAP ────────────────────────────────────────────────────────────
     Two taps: the round was lost, and the reset started. What this reports is
     the gap between them, because that is the skill the season is actually
     training — "did the reset happen inside the hour" beats "days clean",
     which makes every failure catastrophic and is therefore the number most
     worth faking.

     WHERE IT LIVES IS NOT NEGOTIABLE. sync.js pushes every localStorage key
     that is not __sync* or __local* to Firestore IN PLAINTEXT — the vault
     encrypts the published site, not your synced data — and backup.js
     excludes __local* by rule because a downloaded file goes to Downloads,
     into email, onto a stick. So the bouts live under __local and the ONLY
     thing that syncs is a count with a device stamp.

     Which costs something, and the cost is stated rather than discovered:
     this is the one store in the hub a backup will never restore, and a
     figure read on the laptop cannot see what the phone logged. So the count
     is always rendered with the device it came from, the same honesty as
     Money.convert() returning null rather than a total that is quietly short.

     BACKFILL IS FIRST-CLASS. At 23:40 the vault passphrase stands between you
     and logging the thing you are least willing to type, so a bout recorded
     the next morning is marked `recalled` and kept out of the latency median
     rather than being guessed at. The protocol's first three steps are
     physical anyway — stop, shower, one true line. The logging is bookkeeping. */
  var LAP_KEY = '__local_season_lap_v1';

  function lapRead() {
    var v = readJSON(LAP_KEY, null);
    if (!v || typeof v !== 'object') v = {};
    if (!Array.isArray(v.bouts)) v.bouts = [];
    return v;
  }
  function lapSave(v) { return writeJSON(LAP_KEY, v); }

  /* The syncable rollup: counts only, stamped with the device that saw them.
     No timestamps, no text — a week's tally is not a record of what happened. */
  function lapRoll() {
    var l = lapRead(), s = read();
    var by = {};
    l.bouts.forEach(function (b) {
      var k = dayKey(b.at);
      by[k] = (by[k] || 0) + 1;
    });
    s.roll = { n: l.bouts.length, days: Object.keys(by).length, at: Date.now() };
    save(s);
    return s.roll;
  }

  function lapHit(now, recalled) {
    var l = lapRead();
    l.bouts.push({ at: (now == null ? Date.now() : now), back: null,
                   recalled: !!recalled });
    lapSave(l);
    lapRoll();
    return l.bouts[l.bouts.length - 1];
  }
  function lapBack(now) {
    var l = lapRead();
    for (var i = l.bouts.length - 1; i >= 0; i--) {
      if (l.bouts[i].back == null) {
        l.bouts[i].back = (now == null ? Date.now() : now);
        lapSave(l);
        return l.bouts[i];
      }
    }
    return null;
  }
  /* ── TAKING BACK THE LAST ONE ───────────────────────────────────────────
     WHAT SHIPPED BROKEN: two bouts were recorded that never happened, and
     there was no way to remove them. lapHit only ever pushed. So the median
     reset time, the count the check-in reads and the syncable rollup were all
     carrying a mis-tap with no way out but editing localStorage by hand.

     A log you cannot correct is not more honest than one you can — it is just
     wrong, permanently, and a number you know to be wrong is one you stop
     reading. That is the failure this removes.

     It takes back the LAST bout only, and it is not a delete tool. A mis-tap
     is something you notice immediately; rewriting the middle of the log is
     not what this is for, and not offered. The rollup is recomputed, so the
     count that syncs cannot disagree with the log that stayed on the phone. */
  function lapUndo() {
    var l = lapRead();
    if (!l.bouts.length) return null;
    var gone = l.bouts.pop();
    lapSave(l);
    lapRoll();
    return gone;
  }

  function lapOpen() {
    var l = lapRead();
    for (var i = l.bouts.length - 1; i >= 0; i--) if (l.bouts[i].back == null) return l.bouts[i];
    return null;
  }

  /* Median rather than mean: one night you fell asleep before resetting should
     not move the number that says whether the skill is there. Recalled bouts
     carry no honest gap and are excluded rather than estimated. */
  function lapLatency() {
    var l = lapRead();
    var gaps = l.bouts.filter(function (b) { return b.back && !b.recalled; })
                      .map(function (b) { return Math.round((b.back - b.at) / 60000); })
                      .sort(function (a, b) { return a - b; });
    if (!gaps.length) return null;
    var m = Math.floor(gaps.length / 2);
    return gaps.length % 2 ? gaps[m] : Math.round((gaps[m - 1] + gaps[m]) / 2);
  }
  function lapCount(sinceMs) {
    var l = lapRead();
    if (sinceMs == null) return l.bouts.length;
    return l.bouts.filter(function (b) { return b.at >= sinceMs; }).length;
  }

  /* ── ANKI, PROJECTED FROM YOUR OWN REVLOG ───────────────────────────────
     Backlog anxiety produces the hero session: three hundred reps, bed at
     half past midnight, and a trigger the next day you have no resistance to.
     A horizon fixes that better than willpower does, and the data is already
     here — anki_sync.py backfills a year of daily rows into ct_anki_v1.history.

     THE MEDIAN, over days you actually reviewed. A mean is dragged to nothing
     by the fortnight you were away, and counting zero days would answer "how
     long at your current rate" with "never".

     AND IT RETURNS NULL RATHER THAN GUESSING. Under seven reviewed days there
     is no honest rate, so the page says "not enough history" instead of a
     date. The cap is NOT set here either: Anki serves the reviews, so the hub
     reports the deck limit and cannot enforce one — a cap the hub displays and
     Anki ignores is two numbers answering one question, which is the bug this
     whole repo keeps being written against. */
  var MIN_HISTORY = 7;

  function anki() {
    var a = readJSON('ct_anki_v1', null);
    if (!a || typeof a !== 'object') return null;
    var due = (a.dueTotal != null)
      ? Math.max(0, parseInt(a.dueTotal, 10) || 0)
      : Math.max(0, parseInt(a.due, 10) || 0) + Math.max(0, parseInt(a.backlog, 10) || 0);

    var h = a.history;
    var rate = null, basis = 0;
    if (h && Array.isArray(h.cards)) {
      var recent = h.cards.slice(-28).filter(function (n) { return n > 0; });
      basis = recent.length;
      if (basis >= MIN_HISTORY) {
        var sorted = recent.slice().sort(function (x, y) { return x - y; });
        var m = Math.floor(sorted.length / 2);
        rate = sorted.length % 2 ? sorted[m] : Math.round((sorted[m - 1] + sorted[m]) / 2);
      }
    }
    return {
      due: due, rate: rate, basis: basis,
      /* Null, not Infinity and not a guess. "Not counted" beats a wrong date. */
      days: (rate && rate > 0) ? Math.ceil(due / rate) : null,
      cap: (a.cap != null) ? parseInt(a.cap, 10) : null
    };
  }

  /* ── WHERE YOU ARE IN THE DAY ───────────────────────────────────────────
     The nine rows looked identical at 06:00, at lunchtime and at 21:00, so
     "after the shift" sitting on screen while you get ready for work reads as
     a demand rather than as later. Reported as "idk if it's working" — the
     states were right and the page gave no way to tell, which is the same
     failure as a correct number printed without saying where it came from.

     The current group is the one holding the next thing actually owed, so it
     is next() that decides rather than a second clock. Groups before it are
     behind you; groups after it are ahead. */
  var GROUP_ORDER = ['morning', 'day', 'after', 'night'];

  function groupNow(s, now) {
    s = s || read();
    var n = next(s, now);
    if (!n || !n.id) return null;
    for (var i = 0; i < ROWS.length; i++) if (ROWS[i].id === n.id) return ROWS[i].grp;
    return null;
  }
  /* 'past' · 'now' · 'ahead', for one group. */
  function groupWhen(grp, s, now) {
    var cur = groupNow(s, now);
    if (!cur) return 'ahead';
    var a = GROUP_ORDER.indexOf(grp), b = GROUP_ORDER.indexOf(cur);
    if (a < b) return 'past';
    if (a > b) return 'ahead';
    return 'now';
  }

  w.Season = {
    GROUP_ORDER: GROUP_ORDER, groupNow: groupNow, groupWhen: groupWhen,
    KEY: KEY, LAP_KEY: LAP_KEY, ROWS: ROWS, GROUPS: GROUPS, CHAIN: CHAIN,
    lapRead: lapRead, lapHit: lapHit, lapBack: lapBack, lapOpen: lapOpen,
    lapUndo: lapUndo,
    lapLatency: lapLatency, lapCount: lapCount, lapRoll: lapRoll,
    anki: anki, MIN_HISTORY: MIN_HISTORY,
    read: read, save: save,
    day: day, endDay: endDay, checkins: checkins, isCheckin: isCheckin,
    nextCheckin: nextCheckin, phase: phase, live: live,
    canEdit: canEdit, amend: amend, offWindow: offWindow,
    start: start, end: end, tomorrow9: tomorrow9,
    reschedule: reschedule, canReschedule: canReschedule, notAsked: notAsked,
    night: night, hhmm: hhmm, hm: hm, morningMins: morningMins,
    anchor: anchor, anchorOn: anchorOn, blocksOn: blocksOn,
    dayPlan: dayPlan, eveningRoom: eveningRoom, isSabbath: isSabbath,
    weekDay: weekDay, dayEats: dayEats,
    ticks: ticks, tick: tick, state: state, resolved: resolved, closed: closed,
    srcDone: srcDone, from: from, rowOf: rowOf,
    week: week, next: next, dayKey: dayKey,
    lastDays: lastDays, heavyRead: heavyRead, MIN_HEAVY: MIN_HEAVY, median: median
  };
})(typeof window !== 'undefined' ? window : this);
