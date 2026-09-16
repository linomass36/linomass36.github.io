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
    var a = anchorOn(todayKey);
    if (a && mins < a.mins) {
      return { mins: a.mins, title: a.title, kind: a.kind, source: 'calendar', forDay: todayKey };
    }
    var b = anchorOn(nextDayKey(todayKey));
    if (b) {
      return { mins: b.mins, title: b.title, kind: b.kind, source: 'calendar',
               forDay: nextDayKey(todayKey) };
    }
    return { mins: (s.shiftStart == null) ? DEFAULT_SHIFT : s.shiftStart,
             title: null, kind: 'shift', source: 'default', forDay: null };
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
     `src` is the whole argument of the design. Five things you tap; four the
     hub already measures and will therefore not ask you about twice. A
     read-out cannot be ticked by hand — if the grind board says you did not
     train, there is one answer to that question, not two. */
  var ROWS = [
    { id: 'prayer_am',  grp: 'morning', ask: 'Prayer',              mins: 10, src: 'tap' },
    { id: 'manuscript', grp: 'morning', ask: 'Manuscript block',    mins: 45, src: 'tap' },
    { id: 'anki',       grp: 'day',     ask: 'Anki',                mins: 25, src: 'anki' },
    { id: 'train',      grp: 'after',   ask: 'Training',            mins: 60, src: 'grind' },
    { id: 'arrival',    grp: 'after',   ask: 'Shower before couch · no trigger apps', mins: 20, src: 'tap' },
    { id: 'anatomy',    grp: 'after',   ask: 'Anatomy block',       mins: 60, src: 'anatomy' },
    { id: 'spanish',    grp: 'after',   ask: 'Spanish',             mins: 15, src: 'log', secondary: true },
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

  function state(id, s, dKey, now) {
    s = s || read();
    dKey = dKey || dayKey(now);
    if (heldIds()[id] && dKey === dayKey(now)) return 'held';
    var t0 = ticks(s, dKey);
    if (!t0[id] && dKey === dayKey(now) && notAsked(id, s, now)) return 'na';
    var t = ticks(s, dKey);
    if (t[id] === 1) return 'done';
    if (t[id] === 2) return 'floor';
    /* Today is still open, so an untouched row is untold rather than missed.
       A past day the board was never told about stays untold forever — it is
       not evidence of a miss, it is an absence of evidence. */
    return dKey === dayKey(now) ? 'untold' : 'untold';
  }

  /* A past day resolves to missed ONLY where the day was closed — i.e. the
     Life Log has an entry for it. A day you never closed told the board
     nothing, and inventing a miss from silence is the bug this whole file is
     careful about. */
  function closed(dKey) {
    var l = readJSON('ct_lifelog_v1', null);
    return !!(l && l.days && l.days[dKey]);
  }
  function resolved(id, s, dKey, now) {
    var st = state(id, s, dKey, now);
    if (st !== 'untold') return st;
    if (dKey === dayKey(now)) return 'untold';
    return closed(dKey) ? 'missed' : 'untold';
  }

  /* The week, counted from the days rather than stored beside them. */
  function week(s, days, now) {
    s = s || read();
    var out = {};
    ROWS.forEach(function (r) {
      var logged = 0, open = 0, held = 0, missed = 0;
      days.forEach(function (k) {
        var st = resolved(r.id, s, k, now);
        if (st === 'done' || st === 'floor') logged++;
        else if (st === 'held' || st === 'na') held++;
        else if (st === 'missed') missed++;
        else open++;
      });
      out[r.id] = { logged: logged, notClosed: open, held: held, missed: missed };
    });
    return out;
  }

  /* The next thing to do, always answerable — including on a day that has
     already gone badly, which is the only day it matters. */
  function next(s, now) {
    s = s || read();
    var held = heldIds();
    var t = ticks(s, dayKey(now));
    var n = night(s, now);
    var mins = n.now;
    var order = ROWS.filter(function (r) {
      if (held[r.id]) return false;
      if (notAsked(r.id, s, now)) return false;
      return !t[r.id];
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

  w.Season = {
    KEY: KEY, LAP_KEY: LAP_KEY, ROWS: ROWS, GROUPS: GROUPS, CHAIN: CHAIN,
    lapRead: lapRead, lapHit: lapHit, lapBack: lapBack, lapOpen: lapOpen,
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
    ticks: ticks, tick: tick, state: state, resolved: resolved, closed: closed,
    week: week, next: next, dayKey: dayKey
  };
})(typeof window !== 'undefined' ? window : this);
