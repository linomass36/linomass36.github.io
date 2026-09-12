/* ─────────────────────────────────────────────────────────────────────────
   training.js — the join between the week that was PLANNED and the board
   that RECORDS it.

   Two pages have always described the same six sessions and never met:

     Week.html   reads the calendar, sees that Tuesday's clinic ate the
                 afternoon, and lays Strength A on Wednesday instead. It
                 stores by DATE — ct_week_v1.days['2026-09-09'] — because a
                 session done on the 9th is a fact about the 9th.

     Grind.dc.html  runs the block. It stores by WEEK AND SLOT —
                 ct_grind_v1.sessions['1|mon'] — because that is what the
                 programme is written in, and it is what the week's progress,
                 the advance button and the Trends column all count.

   Neither key can be derived from the other without knowing two things: which
   SLOT a session label names, and which DATE that slot landed on this week.
   This file knows both, so the two stores stop being two truths:

     · marking a session done anywhere writes BOTH — and the Life Log's gym
       tick for that date, which is what the day's totals read;
     · the board can ask what the calendar did with its week, so Wednesday
       shows Strength A when that is where the week put it.

   IT OWNS NO DATA OF ITS OWN. Every write lands in a store that already
   existed, in the shape that store already had, so every other page —
   facts.js, systems.js, Today, the backup — keeps reading what it read.
   ───────────────────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  var WKEY = 'ct_week_v1';       // the dated week, written by Week.html
  var GKEY = 'ct_grind_v1';      // the board's record
  var LKEY = 'ct_lifelog_v1';    // the day's log, where the gym tick lives

  /* The six sessions of the block, in the order it runs them, each with the
     slot id the board keys it under. The labels here are the SHORT ones the
     planner deals; the long titles live in grind-data.js and are read from
     there when it is loaded, so this list never has to be kept in step with
     the programme's wording. */
  var SLOTS = [
    { slot: 'mon', label: 'Strength A' },
    { slot: 'tue', label: 'Engine' },
    { slot: 'wed', label: 'Strength B' },
    { slot: 'thu', label: 'Intervals' },
    { slot: 'fri', label: 'Strength C + shadow' },
    { slot: 'sat', label: 'Long easy' }
  ];
  var REST = { slot: 'sun', label: 'Recovery' };
  var DAYN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  function G() { return w.GRIND_DATA || null; }

  /* The programme's own title for a slot — "Strength A — squat, hinge, pull"
     — when grind-data.js is on the page. The short label otherwise. */
  function title(slot) {
    var g = G();
    var s = (g && g.GYM && g.GYM[slot]) || (slot === 'sun' && g && g.RECOVERY) || null;
    if (s && s.t) return s.t;
    return label(slot);
  }
  function label(slot) {
    for (var i = 0; i < SLOTS.length; i++) if (SLOTS[i].slot === slot) return SLOTS[i].label;
    return slot === REST.slot ? REST.label : slot;
  }
  function slots() { return SLOTS.map(function (s) { return { slot: s.slot, label: s.label, title: title(s.slot) }; }); }
  /* What the planner deals. Six labels, in block order. */
  function sessions() { return SLOTS.map(function (s) { return s.label; }); }

  /* ── which slot is this? ───────────────────────────────────────────────
     The planner writes "Intervals" and the programme calls the same session
     "Non-impact work capacity", so a string compare joins nothing. Match the
     slot id first, then the session by what it unmistakably is. Order
     matters: "Long easy engine" contains "engine", so it must be read as the
     Saturday session before the Tuesday one. */
  var NAMES = [
    ['mon', /strength a/],
    ['wed', /strength b/],
    ['fri', /strength c|shadow/],
    ['thu', /interval|work capacity/],
    ['sat', /long easy|walk ?run/],
    ['sun', /recovery/],
    ['tue', /engine|standing endurance/]
  ];
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function slotOf(name) {
    var n = norm(name);
    if (!n) return null;
    for (var i = 0; i < SLOTS.length; i++) if (SLOTS[i].slot === n) return n;
    if (n === REST.slot) return REST.slot;
    for (var j = 0; j < NAMES.length; j++) if (NAMES[j][1].test(n)) return NAMES[j][0];
    return null;
  }

  /* ── dates ─────────────────────────────────────────────────────────────
     ISO day strings throughout, parsed as UTC so a week is exactly seven
     times 86,400,000 ms. Parsing them as local midnight would make the week
     containing a daylight-saving change 167 or 169 hours long, and the floor
     below would then put the Monday either side of it in the wrong week. */
  function ms(iso) {
    var t = Date.parse(String(iso) + 'T00:00:00Z');
    return isNaN(t) ? null : t;
  }
  function isoOf(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  }
  function today() {
    if (w.CTDay && typeof w.CTDay.today === 'function') {
      try { var t = w.CTDay.today(); if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t; } catch (e) {}
    }
    return isoOf(new Date());
  }

  /* Which week of the block a date falls in, 1..4 — or null if it falls
     outside it. The board advances by hand, deliberately: "the week moves
     when the work does, not when the date does". So this is used to FILE a
     dated fact, and the board's own week is the fallback for a date the
     block does not cover. */
  function blockWeek(iso) {
    var g = G();
    var B = g && g.BLOCK;
    if (!B || !B.start) return null;
    var s = ms(B.start), t = ms(iso);
    if (s == null || t == null) return null;
    var n = Math.floor((t - s) / 604800000) + 1;
    var max = (g.weeks || B.weeks || 4);
    return (n >= 1 && n <= max) ? n : null;
  }

  /* ── the stores ────────────────────────────────────────────────────── */
  function read(key) {
    try { var d = JSON.parse(w.localStorage.getItem(key)); return (d && typeof d === 'object') ? d : null; }
    catch (e) { return null; }
  }
  function save(key, d) {
    try { w.localStorage.setItem(key, JSON.stringify(d)); return true; } catch (e) { return false; }
  }
  function weekStore() { var d = read(WKEY) || {}; if (!d.days || typeof d.days !== 'object') d.days = {}; return d; }
  function grindStore() {
    var d = read(GKEY) || {};
    ['sessions', 'runs', 'checks', 'open', 'days'].forEach(function (k) {
      if (!d[k] || typeof d[k] !== 'object') d[k] = {};
    });
    d.week = Math.max(1, Math.min((G() && G().weeks) || 4, parseInt(d.week, 10) || 1));
    return d;
  }

  /* What the week laid on a date: the slot, and everything the planner
     recorded about the day. `slot` is stored from now on; a week pulled
     before this file existed only has the label, so read that too. */
  function day(iso) {
    var store = weekStore();
    var d = store.days[iso];
    var mine = own(iso);
    if (!d && !mine.length) return null;
    d = d || {};
    var slot = slotOf(d.slot || d.session);
    /* A block you added after the week was last planned is time that has
       gone, whether or not the planner has been run again since. `ownHours`
       is what the planner already took off; anything added after it is the
       difference. */
    var mineH = mine.reduce(function (t, b) { return t + (+b.hours || 0); }, 0);
    var extra = Math.max(0, mineH - (+d.ownHours || 0));
    return { iso: iso, slot: slot, label: d.session || (slot ? label(slot) : null),
             done: !!d.done,
             committed: Math.round(((+d.committed || 0) + extra) * 10) / 10,
             free: Math.max(0, Math.round(((+d.free || 0) - extra) * 10) / 10),
             blocks: blocksFor(iso), planned: !!store.days[iso] };
  }
  function slotFor(iso) { var p = day(iso); return p ? p.slot : null; }

  /* ── which day is the rest day ──────────────────────────────────────────
     ONE OWNER, because two pages ask. The board reads the stored week
     through week() below; Week.html reads the plan it has just computed. If
     each worked it out for itself they would disagree the first time they
     were looking at different states of the same week, which is this repo's
     oldest failure.

     `days` is every day of the week in date order, each with free hours, the
     slot it carries, and its date under `iso` or `key`. Returns the date of
     the rest day, or null when some day already carries the rest slot —
     a week whose Sunday kept its recovery already has exactly one.

     Least free first: the rest day is the day your calendar took hardest.
     The list is in date order and the sort is stable, so an equal-free tie
     goes to the earlier date and the answer does not move between reads.

     A day the planner never SAW is marked `planned: false` and cannot be the
     rest day — it falls back to the weekday grid, which gives it a session
     of its own. A freshly computed plan has seen every day it lists and so
     does not set the flag at all. */
  function restDay(days) {
    var list = days || [];
    if (list.some(function (d) { return (d.slot || null) === REST.slot; })) return null;
    var clear = list.filter(function (d) { return d.planned !== false && !d.slot; })
                    .sort(function (a, b) { return (+a.free || 0) - (+b.free || 0); })[0];
    return clear ? (clear.iso || clear.key || null) : null;
  }

  /* ── done, in one place ────────────────────────────────────────────────
     True if EITHER store carries it, because either page may have been the
     one you ticked on. Both are written on every change below, so they only
     disagree across an old record — and an old record saying you trained is
     not something to throw away. */
  function isDone(iso, slot) {
    var p = day(iso);
    if (p && p.done) return true;
    slot = slot || (p && p.slot) || null;
    if (!slot) return false;
    var g = grindStore();
    var wk = blockWeek(iso) || g.week;
    return !!g.sessions[wk + '|' + slot];
  }

  /* The Life Log's gym tick for a DATE. The board used to stamp today
     whichever day you were looking at, so a Wednesday session ticked on
     Thursday logged the gym on Thursday. It takes the date now. */
  function mirrorLog(iso, what, on) {
    var ll = read(LKEY) || {};
    if (!ll.days || typeof ll.days !== 'object') ll.days = {};
    if (!ll.days[iso]) ll.days[iso] = {};
    var dy = ll.days[iso];
    if (on) { dy.gym = { on: true, src: 'grind', what: what }; }
    else if (dy.gym && dy.gym.src === 'grind') { dy.gym = {}; }
    else return false;
    return save(LKEY, ll);
  }

  /* THE ONE WRITER. Every "mark done" on either page comes through here, so
     the two stores cannot drift again. Returns what it filed. */
  function setDone(iso, on, opts) {
    opts = opts || {};
    on = !!on;
    var slot = opts.slot || slotFor(iso) || null;
    var wk = blockWeek(iso) || grindStore().week;
    var name = opts.label || (slot ? label(slot) : null);
    var full = slot ? title(slot) : name;

    /* The dated week — the store the correlations read as `trained`. A date
       the planner never placed still gets a record, because a session done
       off-plan is still a session done. */
    var W = weekStore();
    if (!W.days[iso]) W.days[iso] = {};
    W.days[iso].done = on;
    if (slot) {
      W.days[iso].slot = slot;
      if (!W.days[iso].session) W.days[iso].session = name;
    }
    save(WKEY, W);

    /* The board — its own key, untouched in shape, so its week progress,
       its advance button and every tile that counts it keep working. */
    if (slot) {
      var g = grindStore();
      var k = wk + '|' + slot;
      if (on) { g.sessions[k] = true; g.days[iso] = full; }
      else { delete g.sessions[k]; if (g.days[iso] === full) delete g.days[iso]; }
      save(GKEY, g);
      mirrorLog(iso, full, on);
    }
    return { iso: iso, slot: slot, week: wk, label: name, title: full, done: on };
  }

  /* ── your own blocks ───────────────────────────────────────────────────
     A calendar the hub can only READ cannot hold a date on Friday, and the
     planner was filling every hour it could not see a reason not to. So a
     block you add here is a first-class commitment: the week plans round it,
     the board draws it, and the training moves for it exactly as it moves
     for a shift. It is not written to Google — the token this site asks for
     is read-only, deliberately — so it lives beside the pulled week under
     `own`, which saveWeek never touches. A re-pull cannot delete your
     Friday.

     `kind` is what it is FOR, and it is on the block because "there is no
     room for anything spontaneous" and "there is no room for anything" are
     different complaints with different answers. */
  function ownAll() { var s = weekStore(); return (s.own && typeof s.own === 'object') ? s.own : {}; }
  function own(iso) { return (ownAll()[iso] || []).slice(); }
  function ownId() {
    return 'own-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 46656).toString(36);
  }
  function hours(from, to) {
    var a = mins(from), b = mins(to);
    if (a == null || b == null) return 0;
    return Math.max(0, (b - a) / 60);
  }
  function mins(t) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(t == null ? '' : t).trim());
    return m ? (+m[1]) * 60 + (+m[2]) : null;
  }
  function addOwn(iso, b) {
    b = b || {};
    var from = pad(b.from), to = pad(b.to);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return null;
    if (mins(from) == null || mins(to) == null || mins(to) <= mins(from)) return null;
    var s = weekStore();
    if (!s.own || typeof s.own !== 'object') s.own = {};
    if (!Array.isArray(s.own[iso])) s.own[iso] = [];
    var block = { id: ownId(), title: String(b.title || '').trim() || 'Yours',
                  from: from, to: to, hours: hours(from, to), allDay: false,
                  kind: b.kind || 'own', own: true };
    s.own[iso].push(block);
    s.own[iso].sort(function (x, y) { return mins(x.from) - mins(y.from); });
    save(WKEY, s);
    return block;
  }
  function dropOwn(iso, id) {
    var s = weekStore();
    if (!s.own || !Array.isArray(s.own[iso])) return false;
    var before = s.own[iso].length;
    s.own[iso] = s.own[iso].filter(function (b) { return b.id !== id; });
    var gone = s.own[iso].length !== before;
    if (!s.own[iso].length) delete s.own[iso];
    if (gone) save(WKEY, s);
    return gone;
  }
  /* "9:5" is a time; "09:05" is the same time written so it sorts. */
  function pad(t) {
    var m = /^(\d{1,2}):?(\d{2})?$/.exec(String(t == null ? '' : t).trim());
    if (!m) return String(t == null ? '' : t).trim();
    return (+m[1]) + ':' + String(m[2] == null ? 0 : +m[2]).padStart(2, '0');
  }

  /* Everything on a day, in one list: what the calendar carries and what you
     put there yourself. Every page that draws a day reads this, so a block
     you added is not a second-class citizen on any of them. */
  function blocksFor(iso) {
    var d = weekStore().days[iso] || {};
    var all = (d.blocks || []).concat(own(iso));
    return all.sort(function (a, b) {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return (mins(a.from) || 0) - (mins(b.from) || 0);
    });
  }

  /* The week's blocks as planner input, so the training is laid round them.
     Rebuilt from the store rather than re-fetched: the hours are already
     known, and re-planning after adding a Friday should not need Google. */
  function eventsFromStore(r) {
    var store = weekStore(), out = [];
    for (var i = 0; i < 7; i++) {
      var dt = new Date(r.start);
      dt.setDate(dt.getDate() + i);
      var iso = isoOf(dt);
      blocksFor(iso).forEach(function (b) {
        out.push({ title: b.title, day: iso, kind: b.kind || 'other',
                   allDay: !!b.allDay, uid: b.id || (iso + '|' + b.title + '|' + b.from),
                   hours: b.allDay ? 4 : (+b.hours || hours(b.from, b.to)),
                   start: new Date(iso + 'T' + (b.allDay ? '00:00' : pad(b.from || '0:00')) + ':00'),
                   end: new Date(iso + 'T' + (b.allDay ? '23:59' : pad(b.to || '0:00')) + ':00'),
                   own: !!b.own });
      });
    }
    return out;
  }

  /* ── the week in view ──────────────────────────────────────────────────
     The seven dated days of the week the planner is working on, each with
     the session the CALENDAR put there rather than the one the weekday grid
     assumes. This is what lets the board swap days around: Wednesday is not
     Strength B because it is a Wednesday, it is whatever the week could fit.

     Returns null when no week has been pulled — the board then falls back to
     its own timetable, which is the honest thing to show when nothing is
     known about the week. */
  function week(range) {
    var C = w.CTCalendar;
    var store = weekStore();
    var r = range || null;
    /* THE WEEK YOU ARE STANDING IN, first. Week.html's planning range is next
       week on a Sunday — that is the ritual, and it is right for a page whose
       job is to lay out the week ahead. The board's job is today, so on a
       Sunday it would otherwise show a week that has not started and mark the
       wrong Sunday as today. Take the current week when one has been pulled,
       and only then the one being planned. */
    if (!r && C) {
      var cur = typeof C.weekRange === 'function' ? C.weekRange() : null;
      if (cur && has(store, cur)) r = cur;
      else if (typeof C.planningRange === 'function') r = C.planningRange();
    }
    if (!r) return null;
    var days = [], found = 0;
    for (var i = 0; i < 7; i++) {
      var dt = new Date(r.start);
      dt.setDate(dt.getDate() + i);
      var iso = isoOf(dt);
      var p = day(iso);
      if (p) found++;
      var def = SLOTS[i] ? SLOTS[i].slot : REST.slot;   // what the grid would say
      var slot = (p && p.slot) || null;
      days.push({
        iso: iso, date: dt, name: DAYN[i], weekday: DAYN[i].toLowerCase(),
        slot: slot, defaultSlot: def, moved: !!(slot && slot !== def),
        label: slot ? label(slot) : null, title: slot ? title(slot) : null,
        done: isDone(iso, slot),
        committed: p ? p.committed : 0, free: p ? p.free : 0,
        blocks: p ? p.blocks : [],
        own: own(iso),
        planned: !!(p && p.planned)
      });
    }
    if (!found) return null;

    /* ── the rest day, derived ──────────────────────────────────────────
       THE RECOVERY SESSION USED TO VANISH. The planner deals the block's six
       TRAINING sessions. The seventh thing in the programme — Sunday's
       recovery walk, REST above — was never in that deal. So when the week
       put Long easy on a Sunday with free hours and left Thursday clear,
       Thursday came back with nothing on it at all: no title, no tick, no
       recovery block, and the recovery session simply absent from the week.
       The board went as far as computing "Mark the recovery day done" for
       that day and then hid the button, because it had no slot to write.

       So the day the planner LEFT CLEAR is the rest day. Least free first,
       because the rest day is the day your calendar took hardest; `days` is
       in date order and the sort is stable, so an equal-free tie goes to the
       earlier date and the answer does not move between reads.

       Derived, not stored: re-plan the week and the clear day moves, and a
       stored rest day could not notice — CLAUDE.md's rule about a stored
       conclusion that cannot disagree with its own inputs.

       Only a day the planner SAW is eligible. A day it never saw falls back
       to the weekday grid, which gives it a session of its own. And nothing
       is done at all if some day already carries the rest slot, so a week
       whose Sunday kept its recovery keeps exactly one rest day. */
    var restIso = restDay(days);
    days.forEach(function (d) {
      if (d.iso !== restIso) return;
      d.slot = REST.slot;
      d.moved = d.defaultSlot !== REST.slot;
      d.label = label(REST.slot);
      d.title = title(REST.slot);
      d.done = isDone(d.iso, REST.slot);
      d.rest = true;
    });

    /* `placed`, `moved` and `done` are about THE SIX. The board prints them
       as "N of 6 sessions placed", so counting the rest day among them would
       make that sentence read 7 of 6. */
    var training = days.filter(function (d) { return d.slot && d.slot !== REST.slot; });
    return { start: r.start, end: r.end, days: days,
             blockWeek: blockWeek(days[0].iso),
             moved: training.filter(function (d) { return d.moved; }).length,
             placed: training.length,
             done: training.filter(function (d) { return d.done; }).length };
  }

  /* Does the store carry any day of this range? */
  function has(store, r) {
    var mine = ownAll();
    for (var i = 0; i < 7; i++) {
      var d = new Date(r.start);
      d.setDate(d.getDate() + i);
      var k = isoOf(d);
      if (store.days[k] || (mine[k] && mine[k].length)) return true;
    }
    return false;
  }

  /* ── converge what is already there ────────────────────────────────────
     Two stores that have been filled in separately for weeks do not agree,
     and neither is wrong — each records something the other never saw. So on
     load, take the union: anything either store calls done is done in both.
     It only ever ADDS, so it cannot resurrect something you have just
     cleared (a clear goes through setDone, which clears both). */
  function reconcile(range) {
    var wk = week(range);
    if (!wk) return 0;
    var n = 0;
    wk.days.forEach(function (d) {
      if (!d.slot || !d.done) return;
      var p = day(d.iso);
      var g = grindStore();
      var gk = (blockWeek(d.iso) || g.week) + '|' + d.slot;
      if ((p && p.done) && g.sessions[gk]) return;      // already agreed
      setDone(d.iso, true, { slot: d.slot, label: d.label });
      n++;
    });
    return n;
  }

  w.CTTraining = {
    SLOTS: SLOTS, REST: REST,
    slots: slots, sessions: sessions, slotOf: slotOf, label: label, title: title,
    blockWeek: blockWeek, today: today, iso: isoOf,
    day: day, slotFor: slotFor, isDone: isDone, setDone: setDone,
    week: week, reconcile: reconcile, restDay: restDay,
    own: own, addOwn: addOwn, dropOwn: dropOwn, blocksFor: blocksFor,
    eventsFromStore: eventsFromStore,
    KEYS: { week: WKEY, grind: GKEY, log: LKEY }
  };
})(typeof window !== 'undefined' ? window : this);
