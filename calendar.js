/* ─────────────────────────────────────────────────────────────
   calendar.js — read next week off Google Calendar, once, on a Sunday.

   WHY THIS EXISTS. The Grind board is a fixed nine-week grid keyed
   `week|slot` — `3|push` — so a week where clinic eats Tuesday cannot be
   expressed: there is nowhere to put "moved to Thursday". That keying is
   also why the board is invisible to the trends table, which reads training
   from the Life Log instead. A week that changes shape every week, and a
   scribe shift arriving as a new variable, needs a calendar rather than a
   grid.

   WHAT ACTUALLY WORKS FROM A STATIC SITE. The site already signs in with
   firebase.auth.GoogleAuthProvider, and that provider takes extra scopes;
   the popup result carries a real OAuth access token, and Google's Calendar
   API sends CORS headers, so the browser can call it directly. No server, no
   proxy.

   Two things this cannot do, and does not pretend to:

     * Firebase hands the browser NO refresh token, so the access token lives
       about an hour. This is one popup per session — right for a Sunday
       ritual, wrong for anything automatic. It does not poll.
     * calendar.readonly is a sensitive scope. Kept in Testing with yourself
       as the test user it works indefinitely; publishing would need Google's
       verification.

   The secret .ics URL looks easier and is not — Google serves it without
   CORS headers, so a browser fetch fails and it would need a proxy. An .ics
   FILE, dropped in, needs no auth at all and is the offline path.
   ───────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  var SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
  var API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  var TOKKEY = '__cal_tok';        // sessionStorage: dies with the tab, never synced

  function cfg() { return (w.APP_CONFIG && w.APP_CONFIG.firebase) || null; }

  function tok() {
    try { var raw = sessionStorage.getItem(TOKKEY); if (!raw) return null;
      var o = JSON.parse(raw);
      return (o && o.t && o.exp > Date.now()) ? o.t : null;
    } catch (e) { return null; }
  }
  function setTok(t, ttlMs) {
    try { sessionStorage.setItem(TOKKEY, JSON.stringify({ t: t, exp: Date.now() + (ttlMs || 3300000) })); }
    catch (e) {}
  }

  /* sync.js already loads firebase-auth-compat; wait for it rather than
     loading a second copy of the SDK. */
  function whenFirebase(cb, fail) {
    var tries = 0;
    (function poll() {
      if (w.firebase && w.firebase.auth) return cb();
      if (++tries > 100) return fail(new Error('the Firebase SDK never loaded'));
      setTimeout(poll, 100);
    })();
  }

  function connect(done) {
    var have = tok();
    if (have) return done(null, have);
    if (!cfg()) return done(new Error('no Firebase config on this page'));
    whenFirebase(function () {
      try {
        if (!w.firebase.apps || !w.firebase.apps.length) w.firebase.initializeApp(cfg());
        var p = new w.firebase.auth.GoogleAuthProvider();
        p.addScope(SCOPE);
        /* Ask every time rather than reusing a silent grant: this only runs
           when the button is pressed, and a silent failure here looks like
           the button being broken. */
        p.setCustomParameters({ prompt: 'consent' });
        w.firebase.auth().signInWithPopup(p).then(function (r) {
          var t = r && r.credential && r.credential.accessToken;
          if (!t) return done(new Error('signed in, but Google returned no calendar token'));
          setTok(t);
          done(null, t);
        }).catch(function (e) {
          done(new Error(e && e.code === 'auth/popup-blocked'
            ? 'the popup was blocked — allow popups for this site and try again'
            : (e && e.message) || 'sign-in failed'));
        });
      } catch (e) { done(e); }
    }, done);
  }

  function iso(d) { return new Date(d).toISOString(); }

  /* Monday 00:00 to Sunday 23:59 of the week after the one containing `from`. */
  function nextWeekRange(from) {
    var d = new Date(from || Date.now());
    var mon = new Date(d);
    mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7) + 7);
    mon.setHours(0, 0, 0, 0);
    var end = new Date(mon);
    end.setDate(end.getDate() + 7);
    return { start: mon, end: end };
  }

  function fetchRange(token, start, end, done) {
    var url = API + '?singleEvents=true&orderBy=startTime&maxResults=250' +
      '&timeMin=' + encodeURIComponent(iso(start)) +
      '&timeMax=' + encodeURIComponent(iso(end));
    fetch(url, { headers: { Authorization: 'Bearer ' + token } })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) {
          try { sessionStorage.removeItem(TOKKEY); } catch (e) {}
          throw new Error('the calendar token expired — press it again');
        }
        if (!r.ok) throw new Error('Calendar said ' + r.status);
        return r.json();
      })
      .then(function (j) { done(null, (j.items || []).map(normalise).filter(Boolean)); })
      .catch(function (e) { done(e); });
  }

  function normalise(ev) {
    if (!ev || ev.status === 'cancelled') return null;
    var s = ev.start || {}, e = ev.end || {};
    var allDay = !!s.date;
    var start = new Date(s.dateTime || (s.date + 'T00:00:00'));
    var end = new Date(e.dateTime || (e.date + 'T00:00:00'));
    if (isNaN(start) || isNaN(end)) return null;
    /* Declined invitations are not your week. */
    var me = (ev.attendees || []).filter(function (a) { return a.self; })[0];
    if (me && me.responseStatus === 'declined') return null;
    return {
      title: ev.summary || '(untitled)', start: start, end: end, allDay: allDay,
      hours: Math.max(0, (end - start) / 3600000),
      kind: classify(ev.summary || '')
    };
  }

  /* What a block is, so the planner knows what it may move around. Deliberately
     crude and deliberately visible: the point is that you can see how each
     event was read and fix a wrong one by renaming it. */
  var RULES = [
    ['work',  /clinic|ward|hospital|shift|scribe|volunteer|on.?call|rotation|duty/i],
    ['class', /lecture|seminar|class|lab|tutorial|exam|test|course/i],
    ['travel',/flight|train|drive|airport|travel/i],
    ['fixed', /appointment|dentist|doctor|meeting|call/i]
  ];
  function classify(title) {
    for (var i = 0; i < RULES.length; i++) if (RULES[i][1].test(title)) return RULES[i][0];
    return 'other';
  }

  /* ── .ics, the no-auth path ────────────────────────────────────────
     Enough of RFC 5545 for a Google export: unfold the continuation lines,
     read VEVENTs, take DTSTART/DTEND/SUMMARY. */
  function parseICS(text) {
    var lines = String(text || '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
    var out = [], cur = null;
    lines.forEach(function (ln) {
      if (/^BEGIN:VEVENT/i.test(ln)) { cur = {}; return; }
      if (/^END:VEVENT/i.test(ln)) {
        if (cur && cur.start && cur.end) {
          out.push({
            title: cur.title || '(untitled)', start: cur.start, end: cur.end,
            allDay: !!cur.allDay,
            hours: Math.max(0, (cur.end - cur.start) / 3600000),
            kind: classify(cur.title || '')
          });
        }
        cur = null; return;
      }
      if (!cur) return;
      var m = /^(DTSTART|DTEND|SUMMARY)([^:]*):(.*)$/i.exec(ln);
      if (!m) return;
      var key = m[1].toUpperCase(), params = m[2] || '', val = m[3];
      if (key === 'SUMMARY') { cur.title = val.replace(/\\,/g, ',').replace(/\\n/gi, ' ').trim(); return; }
      var d = icsDate(val, params);
      if (!d) return;
      if (key === 'DTSTART') { cur.start = d; if (/VALUE=DATE(?!-TIME)/i.test(params)) cur.allDay = true; }
      else cur.end = d;
    });
    return out;
  }
  function icsDate(v, params) {
    v = String(v || '').trim();
    var m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(v);
    if (!m) return null;
    var y = +m[1], mo = +m[2] - 1, d = +m[3], h = +(m[4] || 0), mi = +(m[5] || 0), s = +(m[6] || 0);
    /* A floating or TZID time is local to wherever it was written, which for
       a personal calendar is where you were. Local is the honest reading. */
    return m[7] ? new Date(Date.UTC(y, mo, d, h, mi, s)) : new Date(y, mo, d, h, mi, s);
  }

  /* ── the planner ───────────────────────────────────────────────────
     Given the week's committed blocks, find where the training sessions can
     go. Not clever: the day with the most free waking hours gets the next
     session, sessions never double up on a day, and a day with a long work
     block is passed over before a light one. Crude beats opaque here — you
     are going to override it anyway, and you need to see why it chose. */
  function planWeek(events, opts) {
    opts = opts || {};
    var sessions = opts.sessions || ['Push', 'Pull', 'Legs', 'Run', 'Swim', 'Core'];
    var wakeFrom = opts.wakeFrom == null ? 7 : opts.wakeFrom;   // 07:00
    var wakeTo = opts.wakeTo == null ? 22 : opts.wakeTo;        // 22:00
    var range = opts.range || nextWeekRange();
    var DAYN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    var days = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(range.start);
      d.setDate(d.getDate() + i);
      days.push({
        idx: i, name: DAYN[i], date: d,
        key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
        committed: 0, blocks: [], session: null
      });
    }
    (events || []).forEach(function (ev) {
      var i = Math.floor((ev.start - range.start) / 86400000);
      if (i < 0 || i > 6) return;
      var day = days[i];
      day.blocks.push(ev);
      /* An all-day event is a claim on the day, not on 24 hours of it. */
      day.committed += ev.allDay ? 4 : Math.min(ev.hours, wakeTo - wakeFrom);
    });
    days.forEach(function (d) {
      d.free = Math.max(0, (wakeTo - wakeFrom) - d.committed);
      d.blocks.sort(function (a, b) { return a.start - b.start; });
    });

    /* Hardest days first out of the running: sort by free time descending and
       deal the sessions round. */
    var order = days.slice().sort(function (a, b) { return b.free - a.free; });
    var placed = [], unplaced = [];
    sessions.forEach(function (s, n) {
      var d = order[n];
      if (d && d.free >= 1.5) { d.session = s; placed.push({ day: d.key, name: d.name, session: s }); }
      else unplaced.push(s);
    });

    return {
      range: range, days: days, placed: placed, unplaced: unplaced,
      totalFree: Math.round(days.reduce(function (t, d) { return t + d.free; }, 0) * 10) / 10,
      totalCommitted: Math.round(days.reduce(function (t, d) { return t + d.committed; }, 0) * 10) / 10
    };
  }

  /* Sessions are stored BY DATE, which is the whole point: the Grind board's
     week|slot key cannot be joined to anything, so training has never been
     visible to the trends table. */
  var WKEY = 'ct_week_v1';
  function saveWeek(plan) {
    var store;
    try { store = JSON.parse(localStorage.getItem(WKEY)) || {}; } catch (e) { store = {}; }
    if (!store.days || typeof store.days !== 'object') store.days = {};
    plan.days.forEach(function (d) {
      store.days[d.key] = {
        session: d.session, done: (store.days[d.key] || {}).done || false,
        committed: Math.round(d.committed * 10) / 10,
        free: Math.round(d.free * 10) / 10,
        blocks: d.blocks.map(function (b) {
          return { title: b.title, kind: b.kind,
                   from: b.allDay ? null : b.start.getHours() + ':' + String(b.start.getMinutes()).padStart(2, '0'),
                   to: b.allDay ? null : b.end.getHours() + ':' + String(b.end.getMinutes()).padStart(2, '0'),
                   hours: Math.round(b.hours * 10) / 10, allDay: !!b.allDay };
        })
      };
    });
    store.at = Date.now();
    try { localStorage.setItem(WKEY, JSON.stringify(store)); return true; } catch (e) { return false; }
  }
  function readWeek() {
    try { var d = JSON.parse(localStorage.getItem(WKEY)); return (d && d.days) ? d : { days: {} }; }
    catch (e) { return { days: {} }; }
  }
  function markDone(dayKey, on) {
    var s = readWeek();
    if (!s.days[dayKey]) s.days[dayKey] = {};
    s.days[dayKey].done = !!on;
    try { localStorage.setItem(WKEY, JSON.stringify(s)); } catch (e) {}
  }

  w.CTCalendar = {
    connect: connect, fetchRange: fetchRange, nextWeekRange: nextWeekRange,
    parseICS: parseICS, classify: classify, planWeek: planWeek,
    saveWeek: saveWeek, readWeek: readWeek, markDone: markDone,
    hasToken: function () { return !!tok(); }, SCOPE: SCOPE, KEY: WKEY
  };
})(typeof window !== 'undefined' ? window : this);
