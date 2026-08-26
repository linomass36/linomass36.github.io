/* ─────────────────────────────────────────────────────────────────────────
   resurface.js — one thing a day, coming back.

   The Study Engine already does spaced repetition, and it is pointed at one
   narrow input: cards made from what you got wrong. Meanwhile every takeaway
   you were required to write before a paper counted as read, every weekly
   answer, every conversation logged against a person and every decision gate
   sits in a store that only opens if you go looking for it. For a
   surgeon-researcher the asset *is* what you can recall and connect, and
   none of it was ever coming back.

   So: one item a day on Today, drawn from everything you have written,
   weighted by how old it is and how long since you last saw it. One line,
   one tap to open where it came from, and two responses —

     again sooner   you want this more often; the interval shortens
     retire this    you are done with it; it never returns

   The responses are the point. Without them this is a quote of the day, and
   a quote of the day is something you stop reading inside a fortnight.

   The pick is fixed for the calendar day: opening Today five times shows the
   same item five times, because a strip that reshuffles on every reload is a
   feed, and a feed is the thing this is not.
   ───────────────────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  var KEY = 'ct_resurface_v1';
  var DAY = 86400000;

  function readJSON(k, fb) {
    try { var raw = localStorage.getItem(k); if (raw) { var v = JSON.parse(raw); if (v != null) return v; } }
    catch (e) {}
    return fb;
  }
  function isoDay(d) {
    /* The hub's day boundary lives in day.js: a day ends at 05:00, so work
       that runs past midnight belongs to the day it started. Falls back to the
       calendar date when that file has not loaded. */
    if (w.CTDay) return w.CTDay.key(d ? d.getTime() : undefined);
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }
  function daysBetween(iso, now) {
    var t = new Date(iso + 'T12:00:00').getTime();
    if (isNaN(t)) return 0;
    return Math.max(0, Math.round(((now || Date.now()) - t) / DAY));
  }
  function trim(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1).replace(/[\s,.;:—-]+$/, '') + '…' : s;
  }

  function state() {
    var s = readJSON(KEY, {});
    if (!s || typeof s !== 'object') s = {};
    if (!s.seen || typeof s.seen !== 'object') s.seen = {};
    if (!s.retired || typeof s.retired !== 'object') s.retired = {};
    return s;
  }
  function write(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  /* ── where the candidates come from ─────────────────────────────────────
     Five stores, each read and never written. Every candidate carries a
     stable id, because the whole mechanism — what you have seen, what you
     retired — hangs off that id surviving a reload. */

  function fromReading(out) {
    var st = readJSON('ct_reading_v1', {}) || {};
    var hist = st.history || {};
    var titles = {};
    (((w.READING_DATA || {}).shelves) || []).forEach(function (sh) {
      (sh.items || []).forEach(function (it) { if (it && it.id) titles[it.id] = it.title; });
    });
    var mine = readJSON('ct_reading_books_v1', []);
    if (Array.isArray(mine)) mine.forEach(function (b) { if (b && b.id) titles[b.id] = b.title; });

    Object.keys(hist).forEach(function (id) {
      var h = hist[id] || {};
      var take = String(h.takeaway || '').trim();
      if (!take) return;
      var when = String(h.finished || h.readAt || h.started || '').slice(0, 10);
      out.push({
        id: 'read:' + id, kind: 'a paper', kindColor: '#4A5B7A',
        source: titles[id] || 'something you read',
        text: take, day: when || isoDay(),
        href: 'Reading List.dc.html',
      });
    });
  }

  function fromWeekly(out) {
    var w2 = readJSON('ct_weekly_v1', {}) || {};
    var answers = w2.answers || {};
    var LABEL = { moved: 'what moved', stalled: 'what stalled', learned: 'what you learned',
                  cut: 'what you cut', one: 'the one thing' };
    Object.keys(answers).forEach(function (week) {
      var a = answers[week] || {};
      Object.keys(a).forEach(function (qid) {
        var t = String(a[qid] || '').trim();
        if (!t) return;
        out.push({
          id: 'wk:' + week + ':' + qid, kind: 'a Sunday', kindColor: '#993C1D',
          source: LABEL[qid] || 'the weekly review',
          text: t, day: week,
          href: 'Weekly Review.dc.html',
        });
      });
    });
  }

  function fromDossiers(out) {
    var d = readJSON('ct_dossier_v1', {}) || {};
    var names = {};
    var nodes = readJSON('nm_nodes_v2', []);
    if (Array.isArray(nodes)) nodes.forEach(function (n) {
      if (n) names[String(n.id || n.name)] = n.name || String(n.id);
    });
    Object.keys(d).forEach(function (key) {
      var log = (d[key] || {}).log;
      if (!Array.isArray(log)) return;
      log.forEach(function (row, i) {
        var note = String((row && row.note) || '').trim();
        if (!note || note === '—') return;
        out.push({
          id: 'dos:' + key + ':' + (row.ts || i), kind: 'a conversation', kindColor: '#185FA5',
          source: names[key] || key,
          text: note, day: isoDay(new Date(row.ts || Date.now())),
          href: 'Dossiers.dc.html?person=' + encodeURIComponent(key),
        });
      });
    });
  }

  function fromResearch(out) {
    var r = readJSON('ct_research_v1', {}) || {};
    var gates = r.gates || {};
    Object.keys(gates).forEach(function (gid) {
      var g = gates[gid] || {};
      if (!g.call) return;
      out.push({
        id: 'gate:' + gid, kind: 'a decision', kindColor: '#534AB7',
        source: 'gate ' + gid,
        text: 'You called it ' + g.call + '.', day: String(g.at || '').slice(0, 10) || isoDay(),
        href: 'Research Plan.dc.html',
      });
    });
  }

  function fromJournal(out) {
    var list = readJSON('ct_journal_v1', []);
    if (!Array.isArray(list)) return;
    list.forEach(function (e) {
      var body = String((e && e.body) || '').trim();
      if (!body || !e.id) return;
      out.push({
        id: 'jr:' + e.id, kind: 'the journal', kindColor: '#6E4B8A',
        source: e.title ? String(e.title) : 'an entry',
        text: body, day: String(e.date || '').slice(0, 10) || isoDay(),
        href: 'Journal.dc.html',
      });
    });
  }

  function candidates() {
    var out = [];
    [fromReading, fromWeekly, fromDossiers, fromResearch, fromJournal].forEach(function (fn) {
      try { fn(out); } catch (e) {}
    });
    return out;
  }

  /* ── the weighting ──────────────────────────────────────────────────────
     Older is heavier, and longer-unseen is heavier: something written a year
     ago and never shown outranks something from last week. Each showing
     damps it, so a single item cannot own the strip; "again sooner" undoes
     one showing's worth of damping, which is exactly what it should mean. */
  function score(c, seen, now) {
    var age = Math.max(1, daysBetween(c.day, now));
    var s = seen[c.id] || {};
    var shown = Math.max(0, (+s.n || 0) - (+s.boost || 0));
    var since = s.at ? Math.max(0, Math.round((now - s.at) / DAY)) : age;
    return (age * (since + 1)) / (shown + 1);
  }

  /* One item, fixed for the calendar day. Reopening Today does not reshuffle
     it: the same day gets the same item, which is what separates this from a
     feed. */
  function pick(now) {
    now = now || Date.now();
    var today = isoDay(new Date(now));
    var s = state();
    var all = candidates().filter(function (c) { return !s.retired[c.id]; });
    if (!all.length) return null;

    if (s.today && s.today.day === today) {
      var held = all.filter(function (c) { return c.id === s.today.id; })[0];
      if (held) return decorate(held, s, now);
    }

    var best = null, bestScore = -1;
    all.forEach(function (c) {
      var v = score(c, s.seen, now);
      if (v > bestScore || (v === bestScore && best && c.id < best.id)) { best = c; bestScore = v; }
    });
    if (!best) return null;

    s.today = { day: today, id: best.id };
    var was = s.seen[best.id] || {};
    s.seen[best.id] = { n: (+was.n || 0) + 1, at: now, boost: +was.boost || 0 };
    write(s);
    return decorate(best, s, now);
  }

  function decorate(c, s, now) {
    var age = daysBetween(c.day, now);
    var ago = age < 1 ? 'today'
            : age < 7 ? age + ' day' + (age === 1 ? '' : 's') + ' ago'
            : age < 60 ? Math.round(age / 7) + ' week' + (Math.round(age / 7) === 1 ? '' : 's') + ' ago'
            : age < 400 ? Math.round(age / 30) + ' months ago'
            : Math.round(age / 365) + ' year' + (Math.round(age / 365) === 1 ? '' : 's') + ' ago';
    var n = (s.seen[c.id] || {}).n || 1;
    return {
      id: c.id, kind: c.kind, kindColor: c.kindColor, source: c.source,
      text: trim(c.text, 240), full: c.text, href: c.href,
      ago: ago, ageDays: age,
      head: c.kind + ' · ' + c.source + ' · ' + ago,
      seenText: n > 1 ? 'shown ' + n + ' times' : 'first time back',
    };
  }

  // Wanted more often: undo one showing's worth of damping, and let it come
  // round again tomorrow rather than being held for the rest of today.
  function again(id) {
    var s = state();
    var was = s.seen[id] || { n: 0 };
    s.seen[id] = { n: +was.n || 0, at: 0, boost: (+was.boost || 0) + 1 };
    if (s.today && s.today.id === id) s.today = null;
    write(s);
  }

  function retire(id) {
    var s = state();
    s.retired[id] = 1;
    if (s.today && s.today.id === id) s.today = null;
    write(s);
  }

  function stats() {
    var s = state();
    var all = candidates();
    return { total: all.length, retired: Object.keys(s.retired).length,
             seen: Object.keys(s.seen).length };
  }

  w.Resurface = { pick: pick, again: again, retire: retire, stats: stats,
                  candidates: candidates, KEY: KEY };
})(window);
