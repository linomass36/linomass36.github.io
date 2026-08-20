/* ─────────────────────────────────────────────────────────────────────────
   archive.js — the hot half and the cold half.

   Everything this hub keeps went into one Firestore document, and a
   Firestore document tops out at 1 MiB. Measured against the shapes the
   pages actually write, the store grows about 444 KB a year on 218 KB of
   bounded data: it passes the 700 KB local-backup limit at roughly month 13
   and the 950 KB sync guard at roughly month 20, at which point syncing
   stops. On a system meant to run until thirty.

   The fix is not to prune. It is to stop asking one document to hold a
   decade:

     hot   the last 120 days, plus everything that is genuinely live —
           goes in the main document exactly as before
     cold  everything older, split by quarter — goes in its own document
           under hubData/{uid}/archive, where the 1 MiB limit applies per
           quarter instead of per lifetime

   **localStorage still holds all of it.** This file only decides what goes
   in which document; every page keeps reading the same key and seeing the
   same complete store, which is why none of them had to change. The one
   place that has to care is an incoming sync: the cloud's copy of a
   splittable key is only the hot half, so applying it verbatim would delete
   this device's cold half. `rejoin()` below is what prevents that, and it is
   the single most important function here.

   Nothing is ever deleted, and nothing is summarised. A quarter that moves
   to cold is byte-for-byte what it was.
   ───────────────────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  var HOT_DAYS = 120;

  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  // The oldest day that stays hot. Anything strictly before this is cold.
  function cutoff(now) {
    var d = new Date(now || Date.now());
    d.setDate(d.getDate() - HOT_DAYS);
    return iso(d);
  }

  // '2026-03-14' → '2026Q1'. One document per quarter: big enough that a
  // decade is forty documents, small enough that none of them can fill.
  function periodOf(day) {
    var y = String(day).slice(0, 4);
    var m = parseInt(String(day).slice(5, 7), 10) || 1;
    return y + 'Q' + (Math.floor((m - 1) / 3) + 1);
  }

  function dayOfMs(ms) {
    var d = new Date(ms);
    return isNaN(d) ? null : iso(d);
  }

  /* ── the splitters ──────────────────────────────────────────────────────
     Each one knows the shape of one store and answers two questions: which
     parts of it are dated, and what has to stay behind regardless. A store
     with no splitter is simply never split. */
  var SPLITTERS = {

    /* The day records and the study sessions are dated; the timer's active
       session, the syllabus, the targets and the budget are live state and
       stay hot whatever their age. */
    ct_lifelog_v1: {
      split: function (o, before) {
        var hot = {}, cold = {}, k;
        for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) hot[k] = o[k];
        hot.days = {}; hot.sessions = [];

        Object.keys(o.days || {}).forEach(function (day) {
          if (day < before) { (cold[periodOf(day)] = cold[periodOf(day)] || { days: {}, sessions: [] }).days[day] = o.days[day]; }
          else hot.days[day] = o.days[day];
        });
        (Array.isArray(o.sessions) ? o.sessions : []).forEach(function (s) {
          var day = (s && s.day) || (s && dayOfMs(s.start));
          if (day && day < before) { (cold[periodOf(day)] = cold[periodOf(day)] || { days: {}, sessions: [] }).sessions.push(s); }
          else hot.sessions.push(s);
        });
        return { hot: hot, cold: cold };
      },
      join: function (target, chunk) {
        if (!target.days) target.days = {};
        if (!Array.isArray(target.sessions)) target.sessions = [];
        Object.keys((chunk && chunk.days) || {}).forEach(function (d) {
          if (!(d in target.days)) target.days[d] = chunk.days[d];
        });
        var seen = {};
        target.sessions.forEach(function (s) { seen[sessionId(s)] = 1; });
        ((chunk && chunk.sessions) || []).forEach(function (s) {
          if (!seen[sessionId(s)]) { target.sessions.push(s); seen[sessionId(s)] = 1; }
        });
        return target;
      },
    },

    /* A flat list of entries, each carrying the day it belongs to. */
    ct_journal_v1: {
      isArray: true,
      split: function (list, before) {
        var hot = [], cold = {};
        (Array.isArray(list) ? list : []).forEach(function (e) {
          var day = (e && e.date) || (e && dayOfMs(e.created));
          if (day && day < before) (cold[periodOf(day)] = cold[periodOf(day)] || []).push(e);
          else hot.push(e);
        });
        return { hot: hot, cold: cold };
      },
      join: function (target, chunk) {
        if (!Array.isArray(target)) target = [];
        var seen = {};
        target.forEach(function (e) { if (e && e.id) seen[e.id] = 1; });
        (Array.isArray(chunk) ? chunk : []).forEach(function (e) {
          if (!e || (e.id && seen[e.id])) return;
          target.push(e); if (e.id) seen[e.id] = 1;
        });
        return target;
      },
    },

    /* The day rows are dated. The block state is the live closure log — the
       open loops, the retest dates, the scores — and every one of them is
       still in play however old the block is, so blocks never go cold. */
    ct_anatomy_v1: {
      split: function (o, before) {
        var hot = {}, cold = {}, k;
        for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) hot[k] = o[k];
        hot.days = {};
        Object.keys(o.days || {}).forEach(function (day) {
          if (day < before) (cold[periodOf(day)] = cold[periodOf(day)] || { days: {} }).days[day] = o.days[day];
          else hot.days[day] = o.days[day];
        });
        return { hot: hot, cold: cold };
      },
      join: function (target, chunk) {
        if (!target.days) target.days = {};
        Object.keys((chunk && chunk.days) || {}).forEach(function (d) {
          if (!(d in target.days)) target.days[d] = chunk.days[d];
        });
        return target;
      },
    },

    /* Only the map of which lift a day held is dated. The week, the ticked
       sessions and the benchmarks are the board's current state. */
    ct_grind_v1: {
      split: function (o, before) {
        var hot = {}, cold = {}, k;
        for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) hot[k] = o[k];
        hot.days = {};
        Object.keys(o.days || {}).forEach(function (day) {
          if (day < before) (cold[periodOf(day)] = cold[periodOf(day)] || { days: {} }).days[day] = o.days[day];
          else hot.days[day] = o.days[day];
        });
        return { hot: hot, cold: cold };
      },
      join: function (target, chunk) {
        if (!target.days) target.days = {};
        Object.keys((chunk && chunk.days) || {}).forEach(function (d) {
          if (!(d in target.days)) target.days[d] = chunk.days[d];
        });
        return target;
      },
    },
  };

  // A study session has no id of its own; its start and subject identify it.
  function sessionId(s) {
    if (!s) return 'x';
    return [s.type || '', s.subject || '', s.start || '', s.end || ''].join('|');
  }

  function splittable(key) { return !!SPLITTERS[key]; }

  function parse(json) {
    try { return JSON.parse(json); } catch (e) { return undefined; }
  }

  /* Split one key's JSON into the hot half and a map of cold chunks by
     quarter. Returns null when the key is not splittable, when its JSON will
     not parse, or when nothing is old enough to move — in every one of those
     cases the caller should push the value exactly as it is. */
  function split(key, json, now) {
    var S = SPLITTERS[key];
    if (!S) return null;
    var o = parse(json);
    if (o === undefined || o === null) return null;
    if (S.isArray ? !Array.isArray(o) : typeof o !== 'object') return null;

    var r = S.split(o, cutoff(now));
    var periods = Object.keys(r.cold);
    if (!periods.length) return null;

    var cold = {};
    periods.forEach(function (p) { cold[p] = JSON.stringify(r.cold[p]); });
    return { hot: JSON.stringify(r.hot), cold: cold };
  }

  /* Fold a cold chunk back into a full store. Additive and idempotent: a day
     or an entry the target already holds always wins, so re-applying an
     archive can never overwrite something newer. */
  function join(key, fullJson, chunkJson) {
    var S = SPLITTERS[key];
    if (!S) return fullJson;
    var target = parse(fullJson), chunk = parse(chunkJson);
    if (chunk === undefined || chunk === null) return fullJson;
    if (target === undefined || target === null) target = S.isArray ? [] : {};
    try { return JSON.stringify(S.join(target, chunk)); }
    catch (e) { return fullJson; }
  }

  /* ── the one that matters ───────────────────────────────────────────────
     An incoming sync carries only the hot half of a splittable key. Writing
     it to localStorage as-is would throw away every day this device holds
     from before the window — the whole archive, silently, on one sync.

     So: keep everything of ours that is older than the cutoff, take all of
     the cloud's. The cloud is authoritative for the window it covers; we are
     authoritative for what it no longer carries. */
  function rejoin(key, cloudJson, localJson, now) {
    var S = SPLITTERS[key];
    if (!S || localJson == null) return cloudJson;
    var incoming = parse(cloudJson), mine = parse(localJson);
    if (incoming === undefined || incoming === null) return cloudJson;
    if (mine === undefined || mine === null) return cloudJson;

    var before = cutoff(now);
    var oldOfMine = S.split(mine, before).cold;      // our cold half, by quarter
    var out = incoming;
    try {
      Object.keys(oldOfMine).forEach(function (p) { out = S.join(out, oldOfMine[p]); });
      return JSON.stringify(out);
    } catch (e) { return cloudJson; }
  }

  // How the archive documents are named: one per key per quarter.
  function docName(key, period) { return key + '__' + period; }
  function parseDocName(name) {
    var i = String(name).lastIndexOf('__');
    if (i < 0) return null;
    return { key: name.slice(0, i), period: name.slice(i + 2) };
  }

  w.Archive = {
    HOT_DAYS: HOT_DAYS,
    cutoff: cutoff,
    periodOf: periodOf,
    splittable: splittable,
    split: split,
    join: join,
    rejoin: rejoin,
    docName: docName,
    parseDocName: parseDocName,
    keys: function () { return Object.keys(SPLITTERS); },
  };
})(window);
