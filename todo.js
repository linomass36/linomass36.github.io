/* ─────────────────────────────────────────────────────────────────────────
   todo.js — the day's own list, which the hub did not have.

   Every list in this hub belonged to a system. The plan owns its moves, the
   grind board owns its sessions, the reading list owns its shelf — and all
   of them answer "what does the PLAN want of you", which is not the same
   question as "what do you have to do today". Ring the bank, collect the
   parcel, email the supervisor back: none of it belongs to a system here,
   none of it survived to the next morning, and so all of it lived in a notes
   app the hub could not see.

   The nearest thing was the week's three priorities in ct_weekly_v1, and it
   was broken in both directions — see the WEEK KEY note below, and
   tools/todo.test.js, which now pins it.

   ── what this deliberately is NOT ────────────────────────────────────────
   A task manager. There are no projects, no tags, no due dates and no
   priorities, because every one of those is a way of writing something down
   today that indicts you in a fortnight. The store holds one day's list at a
   time and the only question it can answer is "what did I say I would do
   today, and did I".

   ── the carry, which is the whole design ─────────────────────────────────
   An unfinished item is not a debt. The failure mode this file exists to
   avoid is the one every to-do app has: you miss four days, and on the fifth
   the app hands you forty-one things and you close it for good.

   So nothing rolls over by itself. `carry()` looks at the most recent
   EARLIER day that still has open items and offers AT MOST THREE, naming
   how many it is not offering. Taking the offer copies those three onto
   today and resolves the rest as dropped; declining drops all of them. The
   originals are never edited — a day on which you wrote six things and did
   two is a fact about that day, and the hub keeps facts. `carried` and
   `dropped` are marks on the original, not deletions.

   Three is not a guess. anatomy-core.js caps overdue retests at three during
   re-entry and Standing.html asks for exactly one thing on a floor day; this
   is the same posture at the same size, applied to the one list the user
   writes themselves.

   ── the week key, and why this file states it ────────────────────────────
   `ct_weekly_v1.priorities` is keyed by Monday, and two conventions for
   computing that key were live at once: systems.js monday() reads calendar
   fields off a NOON Date, while Today.dc.html and capture.js took a MIDNIGHT
   Monday and ran it through isoDay() — which routes via CTDay.key() and the
   hub's 05:00 boundary, so midnight Monday came back as the Sunday before
   it. systems.js already carries the comment explaining this trap; it was
   fixed there for `reviews` and never for `priorities`. The consequence was
   that priorities set in the Weekly Review never rendered on Today, and
   priorities captured with `+` never reached the Weekly Review, where the
   only tick control lives. Both are fixed with this file, and todo.test.js
   asserts the two agree rather than trusting anyone to remember.

   This file keys by DAY, not week, and uses day.js directly — a day ends at
   05:00, so something written at one in the morning belongs to the evening
   it came from, which is when you were still awake and thinking of it.

   Stored under ct_todo_v1. sync.js pushes every ct_* key, so a line typed on
   a phone is on the desktop before the phone is back in a pocket, and
   backup.js enumerates rather than listing, so this store is in the backup
   the first time it is written.
   ───────────────────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  var KEY = 'ct_todo_v1';

  /* How many an offer may contain. Not a setting: a number you can raise is a
     number that becomes forty-one. */
  var CARRY_MAX = 3;

  /* How far back an offer will look. Beyond this the list was not a list you
     were keeping, and dredging it up is the discouragement this file exists
     to prevent. */
  var CARRY_LOOKBACK_DAYS = 14;

  function readRaw() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY));
      if (v && typeof v === 'object') return v;
    } catch (e) {}
    return {};
  }

  function read() {
    var d = readRaw();
    if (!d.days || typeof d.days !== 'object') d.days = {};
    /* Which days have already been asked about, so an offer declined at
       breakfast does not reappear at lunch. Keyed by the day doing the
       asking, not the day being offered. */
    if (!d.asked || typeof d.asked !== 'object') d.asked = {};
    return d;
  }

  function write(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { return false; }
  }

  function mut(fn) { var d = read(); fn(d); write(d); return d; }

  /* The hub's day boundary lives in day.js: a day ends at 05:00, so work that
     runs past midnight belongs to the day it started. Falls back to the
     calendar date when that file has not loaded — every other store in this
     hub carries the same fallback for the same reason. */
  function today() {
    if (w.CTDay) return w.CTDay.today();
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  function uid() { return 't' + Date.now() + Math.floor(Math.random() * 999); }

  function daysBetween(a, b) {
    var x = new Date(a + 'T12:00:00'), y = new Date(b + 'T12:00:00');
    if (isNaN(x) || isNaN(y)) return 0;
    return Math.round((y - x) / 86400000);
  }

  function itemsOn(d, day) {
    var list = d.days[day];
    return Array.isArray(list) ? list : [];
  }

  /* An item is OPEN when it is neither done nor already resolved by a carry.
     `carried` and `dropped` are how a past day stops asking without losing
     what was written on it. */
  function isOpen(it) { return !!it && !it.done && !it.carried && !it.dropped; }

  // ── reading ──────────────────────────────────────────────────────────────

  function list(day) { return itemsOn(read(), day || today()).slice(); }

  function counts(day) {
    var items = itemsOn(read(), day || today());
    var open = 0, done = 0;
    items.forEach(function (it) {
      if (it && it.done) done++;
      else if (isOpen(it)) open++;
    });
    return { open: open, done: done, total: open + done };
  }

  // ── writing ──────────────────────────────────────────────────────────────

  function add(text, day) {
    var t = String(text == null ? '' : text).trim();
    if (!t) return null;
    var k = day || today();
    var it = { id: uid(), text: t, done: 0, at: Date.now() };
    mut(function (d) {
      if (!Array.isArray(d.days[k])) d.days[k] = [];
      d.days[k].push(it);
    });
    return it;
  }

  function toggle(id, day) {
    var k = day || today();
    mut(function (d) {
      itemsOn(d, k).forEach(function (it) {
        if (it && it.id === id) it.done = it.done ? 0 : 1;
      });
    });
  }

  function remove(id, day) {
    var k = day || today();
    mut(function (d) {
      if (!Array.isArray(d.days[k])) return;
      d.days[k] = d.days[k].filter(function (it) { return !it || it.id !== id; });
    });
  }

  // ── the carry ────────────────────────────────────────────────────────────

  /* The most recent EARLIER day that still has open items, within the
     lookback. Returns null when there is nothing to offer, which is the
     common case and must cost nothing to render.

     `open` is the true count and `offer` is what will actually be taken, so
     the page can say "three of seven" rather than quietly losing four. */
  function carry(day) {
    var k = day || today();
    var d = read();
    if (d.asked[k]) return null;
    var prior = Object.keys(d.days).filter(function (x) {
      if (x >= k) return false;
      var gap = daysBetween(x, k);
      return gap > 0 && gap <= CARRY_LOOKBACK_DAYS;
    }).sort();
    for (var i = prior.length - 1; i >= 0; i--) {
      var open = itemsOn(d, prior[i]).filter(isOpen);
      if (open.length) {
        return {
          from: prior[i],
          days: daysBetween(prior[i], k),
          open: open.length,
          offer: open.slice(0, CARRY_MAX).map(function (it) { return { id: it.id, text: it.text }; }),
          dropping: Math.max(0, open.length - CARRY_MAX)
        };
      }
    }
    return null;
  }

  /* Take the offer. Up to three come across as new items on today carrying
     `from`, so the page can say where they came from; everything else open on
     that day is marked dropped. Either way the source day stops being open,
     which is what stops the same pile being offered tomorrow.

     Returns what actually happened rather than nothing, because the caller
     has to be able to say "3 brought over, 4 dropped" out loud. */
  function carryOver(day) {
    var k = day || today();
    var c = carry(k);
    if (!c) return { carried: 0, dropped: 0, from: null };
    var take = {};
    c.offer.forEach(function (o) { take[o.id] = true; });
    var carried = 0, dropped = 0;
    mut(function (d) {
      if (!Array.isArray(d.days[k])) d.days[k] = [];
      itemsOn(d, c.from).forEach(function (it) {
        if (!isOpen(it)) return;
        if (take[it.id]) {
          it.carried = 1;
          d.days[k].push({ id: uid(), text: it.text, done: 0, at: Date.now(), from: c.from });
          carried++;
        } else {
          it.dropped = 1;
          dropped++;
        }
      });
      d.asked[k] = 1;
    });
    return { carried: carried, dropped: dropped, from: c.from };
  }

  /* Decline. Everything open on that day is dropped — which is a decision,
     recorded as one, not a silent expiry. */
  function dismiss(day) {
    var k = day || today();
    var c = carry(k);
    if (!c) { mut(function (d) { d.asked[k] = 1; }); return { dropped: 0, from: null }; }
    var dropped = 0;
    mut(function (d) {
      itemsOn(d, c.from).forEach(function (it) { if (isOpen(it)) { it.dropped = 1; dropped++; } });
      d.asked[k] = 1;
    });
    return { dropped: dropped, from: c.from };
  }

  w.CTTodo = {
    KEY: KEY, CARRY_MAX: CARRY_MAX, CARRY_LOOKBACK_DAYS: CARRY_LOOKBACK_DAYS,
    today: today, list: list, counts: counts,
    add: add, toggle: toggle, remove: remove,
    carry: carry, carryOver: carryOver, dismiss: dismiss
  };
})(typeof window !== 'undefined' ? window : this);
