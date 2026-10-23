/* ─────────────────────────────────────────────────────────────────────────
   anki-bridge.js — the Year 2 Hub add-on in Anki, and this site, as one plan.

   The add-on (tools/anki-addon/year2_hub) builds each day's tasks from the
   year's calendar and runs the card plan. It publishes them to Firestore at
   bridge/{uid}/from/anki; this file reads them, and writes what happened here
   to bridge/{uid}/from/hub for the add-on to read. Each side writes only its
   own document, so neither can overwrite the other.

   WHAT THIS OWNS. Ask it, do not read its key:
     AnkiBridge.today(now)          the add-on's tasks for today with their
                                    ticks, the leftovers, the card plan — or
                                    null when nothing has arrived for today,
                                    and the Almanac falls back to the protocol
     AnkiBridge.dayTasks(date)      a day's tasks as Study Control's rows,
                                    for the past week and the grades chart
     AnkiBridge.tick(id, on)        a tick made here
     AnkiBridge.disagreements()     classes the two calendars date differently
     AnkiBridge.exportAll()         everything, both sides, for a download

   WHY THE ADD-ON'S LIST AND NOT THIS SITE'S. The site had its own protocol
   rows (study-control.js) and the add-on had a fuller list of the same days.
   Two checklists of one day is the failure CLAUDE.md lists four times: two
   pages answering the same question differently. So when the add-on has
   spoken for a day, its list is the list, and the protocol rows are only
   what shows before it has.

   TWO WRITERS. A tick, or a moved date, can change here and in Anki between
   syncs. Each carries the time it was made; the newer wins, un-ticking
   included. Same rule as feeds.js and the add-on's bridge.py.

   STORE. ct_ankibridge_v1 = { anki, days, ticks, moves, links, seen,
   pulledAt, pushedAt }. A ct_ key, so sync.js carries it between devices:
   the phone has the add-on's plan without ever reading Firestore itself.
   Nothing secret is kept here — the pairing code is made on demand and
   never stored.

   `now` is accepted everywhere so a test drives the clock (CLAUDE.md).
   ───────────────────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  var KEY = 'ct_ankibridge_v1';
  var KEEP_DAYS = 150;
  var CARRY = { read: 1, questions: 1, video: 1, recall: 1, cards: 1 };
  /* The add-on's subject keys, as Study Control names them. */
  var SUBJ = { anatomy: 'anatomy', physio: 'physiology', histo: 'histology', embryo: 'embryology', step: 'step', all: 'all' };
  var ORDER = ['anatomy', 'physio', 'histo', 'embryo', 'step', 'all'];

  function SC() { return w.StudyControl || null; }
  function iso(t) { return new Date(t == null ? Date.now() : t).toISOString().replace(/\.\d{3}Z$/, 'Z'); }
  function dayKey(now) {
    var S = SC();
    if (S) return S.today(now);
    var d = new Date(now == null ? Date.now() : now);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addDays(k, n) { var p = k.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2] + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function diff(a, b) { var p = a.split('-').map(Number), q = b.split('-').map(Number);
    return Math.round((new Date(p[0], p[1] - 1, p[2]) - new Date(q[0], q[1] - 1, q[2])) / 864e5); }

  function shape(d) {
    d = d || {};
    return { anki: d.anki || null, days: d.days || {}, ticks: d.ticks || {}, moves: d.moves || {},
             links: d.links || {}, seen: d.seen || {}, pulledAt: d.pulledAt || null, pushedAt: d.pushedAt || null };
  }
  function ls() { try { return w.localStorage || null; } catch (e) { return null; } }
  function read() { try { var L = ls(), r = L && L.getItem(KEY); return shape(r ? JSON.parse(r) : null); } catch (e) { return shape(); } }
  function write(s) { var L = ls(); if (!L) return false; try { L.setItem(KEY, JSON.stringify(shape(s))); return true; } catch (e) { return false; } }

  /* ── what the add-on said ── */
  function ingest(payload, now) {
    if (!payload || typeof payload !== 'object' || !payload.days) return false;
    var s = read();
    if (s.anki && s.anki.at && payload.at && payload.at <= s.anki.at) return false;   // already have this, or newer
    var keep = addDays(dayKey(now), -KEEP_DAYS);
    Object.keys(payload.days).forEach(function (d) { s.days[d] = payload.days[d]; });
    Object.keys(s.days).forEach(function (d) { if (d < keep) delete s.days[d]; });
    var a = Object.assign({}, payload); delete a.days;
    s.anki = a;
    s.pulledAt = iso(now);
    write(s);
    reconcile(now);
    return true;
  }

  /* The tick that counts: the newer of the add-on's and this site's. */
  function status(s, tid) {
    var a = s.anki && s.anki.checks ? s.anki.checks[tid] : null, l = s.ticks[tid];
    var at = a && a.t || '', lt = l && l.t || '';
    if (l && (lt > at || !a)) return l.v || null;
    return a ? (a.v || null) : null;
  }

  function tick(tid, on, now) {
    var s = read();
    s.ticks[tid] = { v: on ? 'done' : null, t: iso(now) };
    write(s);
    soon();
    return true;
  }

  function dayTasksRaw(s, d) {
    var ts = s.days[d];
    if (!ts || !ts.length) return null;
    return ts.map(function (t) {
      var v = status(s, t.id);
      return Object.assign({}, t, { subj: SUBJ[t.subject] || t.subject, done: v === 'done', skipped: v === 'skip' });
    });
  }
  /* A day's tasks as Study Control's rows: {id, subj, text, must, done}.
     Notes are not tasks; a dropped one is neither done nor offered. */
  function dayTasks(d) {
    var ts = dayTasksRaw(read(), d);
    if (!ts) return null;
    return ts.filter(function (t) { return t.kind !== 'note' && !t.skipped; })
      .map(function (t) { return { id: t.id, subj: t.subj, text: t.title, must: !!t.floor, done: t.done, kind: t.kind }; });
  }

  function eventDate(s, eid) {
    var e = (s.anki && s.anki.events || []).filter(function (x) { return x.id === eid; })[0];
    return e ? e.date : null;
  }

  /* Today as the add-on planned it. Leftovers follow the add-on's own rule
     (tasks.py, Calendar.leftovers): the last three days' unticked work that
     is still worth doing — reading for a test already sat is not. */
  function today(now) {
    var s = read(), T = dayKey(now), tasks = dayTasksRaw(s, T);
    if (!tasks) return null;
    var left = [], start = s.anki && s.anki.hub_start;
    for (var i = 3; i >= 1; i--) {
      var d = addDays(T, -i);
      if (start && d < start) continue;
      (dayTasksRaw(s, d) || []).forEach(function (t) {
        if (!CARRY[t.kind] || t.done || t.skipped) return;
        var ed = t.event ? eventDate(s, t.event) : null;
        if (ed && ed < T && (t.kind === 'read' || t.kind === 'questions')) return;
        left.push(Object.assign({ from: d }, t));
      });
    }
    var a = s.anki || {};
    return { date: T, tasks: tasks.filter(function (t) { return !t.skipped; }), leftovers: left,
             card: a.card && a.card.date === T ? a.card : null, anatomy: a.today === T ? a.anatomy : null,
             at: a.at || null, order: ORDER };
  }

  /* ── the two calendars ──
     Study Control has the term's classes; the add-on has its own calendar.
     An event is LINKED to its twin once both say the same subject, kind and
     date. After that a move on either side is a move on both: one made in
     Study Control goes out in `moves` with its time; one made in Anki
     arrives with `moved_at` and is applied here if it is the newer. Events
     that never matched are not guessed at: they are listed by
     disagreements() for a person to decide. */
  /* Same subject and kind, and titles that do not contradict. A date alone
     is not enough: the two calendars disagreed about histology after W3, so
     on 30 November Study Control had W6 (blood) where the add-on had class 7
     (circulatory). Matched on the date, moving one would have moved the
     other. Titles that share no word are two different classes; a generic
     title ("Entrance test", "Seminar") is no evidence either way. */
  var NOISE = { class: 1, classes: 1, histology: 1, anatomy: 1, physiology: 1, embryology: 1, seminar: 1, entrance: 1,
                test: 1, with: 1, quiz: 1, from: 1, spring: 1, winter: 1, confirm: 1, chapter: 1, before: 1, after: 1,
                system: 1, systems: 1, tissue: 1, tissues: 1, organs: 1, cells: 1 };
  function words(t) {
    var out = {};
    String(t || '').toLowerCase().split(/[^a-z]+/).forEach(function (x) { if (x.length >= 4 && !NOISE[x]) out[x] = 1; });
    return out;
  }
  function overlap(a, b) { var n = 0; Object.keys(a).forEach(function (k) { if (b[k]) n++; }); return n; }
  function titleFit(se, ae) {
    var a = words(se.title + ' ' + (se.note || '').slice(0, 0)), b = words(ae.label + ' ' + (ae.title || ''));
    if (!Object.keys(a).length || !Object.keys(b).length) return 0;          // no evidence
    var n = overlap(a, b);
    return n ? n : -1;                                                       // -1: they contradict
  }
  function linkable(se, ae) {
    return SUBJ[ae.subject] === se.subject && ae.kind === se.kind && titleFit(se, ae) >= 0;
  }
  function reconcile(now) {
    var S = SC();
    if (!S) return { moved: [], sent: [] };
    var s = read(), sc = S.read(), out = { moved: [], sent: [] };
    var aes = (s.anki && s.anki.events || []).filter(function (e) { return e.date && SUBJ[e.subject] && e.subject !== 'step' && e.subject !== 'all'; });
    /* A link whose classes no longer match — one deleted, or a title edited
       into a different class — is dropped rather than trusted. */
    var byId = {};
    (s.anki && s.anki.events || []).forEach(function (e) { byId[e.id] = e; });
    Object.keys(s.links).forEach(function (a) {
      var se = sc.events[s.links[a]], ae = byId[a];
      if (!se || !ae || !linkable(se, ae)) { delete s.seen[s.links[a]]; delete s.links[a]; }
    });
    var taken = {};
    Object.keys(s.links).forEach(function (a) { taken[s.links[a]] = 1; });
    aes.forEach(function (ae) {
      if (s.links[ae.id]) return;
      var hit = Object.keys(sc.events).filter(function (id) {
        var se = sc.events[id];
        return !taken[id] && se.date === ae.date && linkable(se, ae);
      })[0];
      if (hit) { s.links[ae.id] = hit; s.seen[hit] = ae.date; taken[hit] = 1; }
    });
    aes.forEach(function (ae) {
      var sid = s.links[ae.id], se = sid && sc.events[sid];
      if (!se) return;
      var mine = s.moves[ae.id];
      if (s.seen[sid] && se.date !== s.seen[sid]) {
        /* moved in Study Control since we last looked: tell the add-on */
        s.moves[ae.id] = { date: se.date, t: iso(now) };
        s.seen[sid] = se.date;
        out.sent.push(ae.id);
      } else if (ae.date !== se.date && ae.moved_at && ae.moved_at > (mine && mine.t || '')) {
        /* moved in Anki, and later than anything said here */
        S.moveEvent(sid, ae.date, now);
        s.seen[sid] = ae.date;
        out.moved.push(sid);
      }
    });
    write(s);
    if (out.sent.length) soon();
    return out;
  }

  /* Classes the two calendars date differently and that never linked:
     paired by subject and kind, nearest date within two weeks. Each comes
     with both dates; adopt() settles it one way or the other. */
  function disagreements() {
    var S = SC();
    var s = read();
    if (!S || !s.anki) return [];
    var sc = S.read(), linkedSite = {}, out = [];
    Object.keys(s.links).forEach(function (a) { linkedSite[s.links[a]] = 1; });
    var free = Object.keys(sc.events).filter(function (id) {
      var e = sc.events[id]; return !linkedSite[id] && !S.isSession(Object.assign({ id: id }, e));
    });
    (s.anki.events || []).filter(function (ae) {
      return ae.date && !s.links[ae.id] && SUBJ[ae.subject] && ae.subject !== 'step' && ae.subject !== 'all';
    }).sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (ae) {
      /* the class whose title matches best, then the nearest date */
      var best = null, bf = -1, bd = 99;
      free.forEach(function (id) {
        var se = sc.events[id];
        if (!linkable(se, ae)) return;
        var d = Math.abs(diff(se.date, ae.date)), f = titleFit(se, ae);
        if (d === 0 || d > 21) return;
        if (f > bf || (f === bf && d < bd)) { best = id; bf = f; bd = d; }
      });
      if (!best) return;
      free = free.filter(function (id) { return id !== best; });
      out.push({ anki: ae.id, site: best, subject: SUBJ[ae.subject], label: ae.label, ankiDate: ae.date,
                 siteDate: sc.events[best].date, siteTitle: sc.events[best].title, tbc: !!ae.tbc });
    });
    return out;
  }
  /* which: 'anki' moves Study Control's class to the add-on's date; 'site'
     sends Study Control's date to the add-on. Either way the two are linked
     from then on. */
  function adopt(ankiId, siteId, which, now) {
    var S = SC(); if (!S) return false;
    var s = read(), ae = (s.anki && s.anki.events || []).filter(function (e) { return e.id === ankiId; })[0];
    var se = S.read().events[siteId];
    if (!ae || !se) return false;
    if (which === 'anki') { S.moveEvent(siteId, ae.date, now); s.seen[siteId] = ae.date; }
    else { s.moves[ankiId] = { date: se.date, t: iso(now) }; s.seen[siteId] = se.date; }
    s.links[ankiId] = siteId;
    write(s);
    soon();
    return true;
  }

  /* ── Firestore ── the same guards as feeds.js: no Firebase, no user, or a
     refused read costs nothing but the sync. */
  var lastError = null;
  function fb() {
    try {
      if (!w.firebase || !firebase.apps || !firebase.apps.length) return null;
      var u = firebase.auth().currentUser;
      return u ? { u: u, db: firebase.firestore() } : null;
    } catch (e) { return null; }
  }
  function ref(f, side) { return f.db.collection('bridge').doc(f.u.uid).collection('from').doc(side); }
  function refused(e) {
    lastError = (e && e.code === 'permission-denied')
      ? 'The database refused: publish the bridge rule (the Guide, under the Anki add-on).'
      : 'Could not reach the database' + (e && e.message ? ': ' + e.message : '.');
  }

  /* What goes to the add-on. Merged with what is already there, newest per
     key, because the phone and the laptop both write this document and
     either may not have the other's latest tick yet. */
  function outbound(prev) {
    var s = read(), S = SC(), sc = S ? S.read() : null;
    var checks = Object.assign({}, prev && prev.checks || {}), moves = Object.assign({}, prev && prev.moves || {});
    Object.keys(s.ticks).forEach(function (k) { if (!checks[k] || (s.ticks[k].t || '') > (checks[k].t || '')) checks[k] = s.ticks[k]; });
    Object.keys(s.moves).forEach(function (k) { if (!moves[k] || (s.moves[k].t || '') > (moves[k].t || '')) moves[k] = s.moves[k]; });
    var results = S ? S.view(sc).results.map(function (r) {
      return { id: r.id, date: r.date, subject: r.subject, kind: r.kind, title: r.title || '', score: r.score, max: r.max,
               estimate: !!r.estimate, causes: r.causes || [], errorCards: !!r.errorCards, createdAt: r.createdAt || null };
    }) : [];
    return { v: 1, at: iso(), checks: checks, moves: moves, results: results, studyControl: sc };
  }

  function pull(onChange) {
    var f = fb(); if (!f) return Promise.resolve(false);
    return ref(f, 'anki').get().then(function (snap) {
      lastError = null;
      if (!snap || !snap.exists) return false;
      var d = snap.data(), p = null;
      try { p = JSON.parse(d.json); } catch (e) { return false; }
      return ingest(p);
    }).catch(function (e) { refused(e); return false; });
  }
  function push() {
    var f = fb(); if (!f) return Promise.resolve(false);
    var r = ref(f, 'hub');
    return r.get().then(function (snap) {
      var prev = null;
      try { prev = snap && snap.exists ? JSON.parse(snap.data().json) : null; } catch (e) {}
      var p = outbound(prev);
      return r.set({ at: p.at, json: JSON.stringify(p) });
    }).then(function () {
      lastError = null;
      var s = read(); s.pushedAt = iso(); write(s);
      return true;
    }).catch(function (e) { refused(e); return false; });
  }
  var timer = null;
  function soon() {
    if (timer) clearTimeout(timer);
    try { timer = setTimeout(function () { timer = null; push(); }, 1500); } catch (e) {}
  }
  /* onChange runs when anything here changed — a new day from Anki, or a
     class moved to the add-on's date — so a page holding the store in
     memory (Study Control does) reloads it before it writes again. */
  function sync(onChange) {
    return pull().then(function (changed) {
      var r = reconcile();
      if ((changed || r.moved.length) && typeof onChange === 'function') onChange();
      return push();
    });
  }
  function start(onChange) {
    /* The calendars are reconciled on every open, signed in or not: the
       add-on's plan reaches a device through sync.js too, and a stale link
       should not wait for the database to be checked. */
    try { var r = reconcile(); if (r.moved.length && typeof onChange === 'function') onChange(); } catch (e) {}
    try {
      if (!w.firebase || !firebase.auth) return;
      firebase.auth().onAuthStateChanged(function (u) { if (u) sync(onChange); });
    } catch (e) {}
  }

  /* The code the add-on is connected with: this browser's Firebase sign-in,
     which the add-on exchanges for its own access as the same user — so the
     database's rules apply to it exactly as to this page. Made on demand,
     shown once, never stored here. */
  function pairingCode() {
    var f = fb(), C = w.APP_CONFIG && w.APP_CONFIG.firebase;
    if (!f || !C || !f.u.refreshToken) return null;
    var doc = { v: 1, apiKey: C.apiKey, projectId: C.projectId, uid: f.u.uid, refreshToken: f.u.refreshToken,
                origin: w.location ? w.location.origin : '' };
    var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(doc)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return 'cthub1.' + b64;
  }

  function state() {
    var s = read();
    return { connected: !!s.anki, at: s.anki && s.anki.at, addon: s.anki && s.anki.addon, pulledAt: s.pulledAt,
             pushedAt: s.pushedAt, error: lastError, signedIn: !!fb() };
  }

  /* ── export ── everything on both sides that is about study. */
  function exportAll(now) {
    var S = SC(), s = read(), L = ls(), anki = null;
    try { anki = L && JSON.parse(L.getItem('ct_anki_v1')); } catch (e) {}
    var tasks = [];
    Object.keys(s.days).sort().forEach(function (d) {
      if (d > dayKey(now)) return;
      (dayTasksRaw(s, d) || []).forEach(function (t) {
        tasks.push({ date: d, subject: SUBJ[t.subject] || t.subject, kind: t.kind, title: t.title, min: t.min, floor: !!t.floor,
                     status: t.done ? 'done' : t.skipped ? 'skip' : '', detail: t.detail || '', id: t.id });
      });
    });
    return {
      exported: iso(now),
      what: 'Study data from the CT hub website and the Year 2 Hub add-on in Anki, as last synced',
      website: { studyControl: S ? S.read() : null, ankiReading: anki },
      addon: { syncedAt: s.anki && s.anki.at, version: s.anki && s.anki.addon, plan: s.anki && s.anki.plan,
               cardPlan: s.anki && s.anki.card, calendar: s.anki && s.anki.events, tasks: tasks,
               ticksMadeHere: s.ticks, datesMovedHere: s.moves }
    };
  }
  function csv(rows, cols) {
    function cell(v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    return [cols.join(',')].concat(rows.map(function (r) { return cols.map(function (c) { return cell(r[c]); }).join(','); })).join('\n') + '\n';
  }
  function resultsCSV() {
    var S = SC(); if (!S) return '';
    var rs = S.view(S.read()).results.sort(function (a, b) { return a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || ''); })
      .map(function (r) { return Object.assign({}, r, { percent: r.max ? Math.round(1000 * r.score / r.max) / 10 : '', causes: (r.causes || []).join(';') }); });
    return csv(rs, ['date', 'subject', 'kind', 'title', 'score', 'max', 'percent', 'estimate', 'causes', 'errorCards', 'id']);
  }
  function tasksCSV(now) {
    return csv(exportAll(now).addon.tasks, ['date', 'subject', 'kind', 'title', 'min', 'floor', 'status', 'detail', 'id']);
  }

  w.AnkiBridge = {
    KEY: KEY, SUBJ: SUBJ, ORDER: ORDER,
    read: read, ingest: ingest, status: function (tid) { return status(read(), tid); }, tick: tick,
    today: today, dayTasks: dayTasks, reconcile: reconcile, disagreements: disagreements, adopt: adopt,
    outbound: outbound, pull: pull, push: push, sync: sync, start: start, pairingCode: pairingCode, state: state,
    exportAll: exportAll, resultsCSV: resultsCSV, tasksCSV: tasksCSV, csv: csv
  };
})(typeof window !== 'undefined' ? window : this);
