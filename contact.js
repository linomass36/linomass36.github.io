/* ─────────────────────────────────────────────────────────────
   contact.js — one person a day, so a network does not quietly go cold.

   The Network Map already knew everything needed for this and said none of
   it out loud. Each node carries `type`, `strength`, `lastDays` and `owed`,
   and the board reported them as "5 owed a touch" — a number you scroll
   past. A number is not a thing you do; a name is.

   So the same move the resurfaced item makes: pick ONE, say why it is that
   one today, and give it a first line so the cost of acting is a tap rather
   than twenty minutes of drafting. The pick is fixed for the calendar day,
   because a panel that reshuffles on reload is a feed, and a feed is the
   thing this is not.

   THE CADENCE. Warmth decays at different rates for different kinds of tie.
   A mentor you see monthly goes cold in six weeks; a conference contact you
   met once is not owed anything for half a year. Overdue-ness is therefore
   a ratio — days since the last touch over what this tier can bear — not a
   raw count, or the dormant contacts would crowd out the live ones forever.
   ───────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  var NKEY = 'nm_nodes_v2';
  var DKEY = 'ct_dossier_v1';
  var SKEY = 'ct_contact_v1';   // what has been dismissed or acted on, per day

  /* Days a tie of each kind can go untouched before it is decaying. These are
     the tiers the Network Map already uses. */
  var CADENCE = {
    mentor: 35, ct: 75, peer: 60, sponsor: 30, researcher: 75,
    program: 120, conference: 180, family: 21, you: 0
  };
  var DEFAULT_CADENCE = 90;

  function readJSON(k, fb) {
    try { var r = localStorage.getItem(k); if (r) { var v = JSON.parse(r); if (v != null) return v; } }
    catch (e) {}
    return fb;
  }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function today() {
    if (w.CTDay) return w.CTDay.key(Date.now());
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  function nodes() {
    var n = readJSON(NKEY, null);
    if (Array.isArray(n)) return n;
    /* Before the map has been opened once its store is empty, and the seed
       lives inside that page. Nothing to pick from is a fine answer. */
    return [];
  }

  /* The dossier is the record of actual contact, and it is what `lastDays`
     drifts out of step with. A touch logged there wins over the node's own
     figure, so acting on the suggestion changes tomorrow's pick. */
  function lastTouchDays(id) {
    var d = readJSON(DKEY, {}) || {};
    var log = (d[id] || {}).log;
    if (!Array.isArray(log) || !log.length) return null;
    var newest = 0;
    log.forEach(function (r) { var t = r && r.ts; if (t && t > newest) newest = t; });
    if (!newest) return null;
    return Math.max(0, Math.floor((Date.now() - newest) / 86400000));
  }

  function state() {
    var s = readJSON(SKEY, {}) || {};
    if (!s.skipped || typeof s.skipped !== 'object') s.skipped = {};
    if (!s.done || typeof s.done !== 'object') s.done = {};
    return s;
  }

  /* How overdue a person is, as a multiple of their tier's cadence. Above 1
     the tie is past what it can bear; below 0.5 it is current. */
  function score(p, skipped) {
    if (!p || !p.id || p.type === 'you') return null;
    var cad = CADENCE[p.type] != null ? CADENCE[p.type] : DEFAULT_CADENCE;
    if (!cad) return null;
    var logged = lastTouchDays(p.id);
    var days = logged != null ? logged
             : (typeof p.lastDays === 'number' ? p.lastDays : null);
    if (days == null) return null;
    var s = days / cad;
    /* An unanswered message is a debt, not a schedule — it outranks a tie
       that is merely due. */
    if (p.owed) s *= 1.6;
    /* Reach is the map's own estimate of how far a person can move things.
       A small nudge, so it breaks ties rather than deciding them. */
    var reach = typeof p.reach === 'number' ? p.reach : 2;
    s *= (1 + (reach - 2) * 0.12);
    /* Dormant ties are real but they are not this week's work. */
    if (p.strength === 'dormant') s *= 0.6;
    if (p.strength === 'cold') s *= 0.45;
    /* Passed over today, or already contacted today. */
    if (skipped && skipped[p.id]) s *= 0;
    return s;
  }

  function why(p, days, cad) {
    var over = Math.round(days - cad);
    if (p.owed) return 'You owe them a reply — ' + days + ' days now.';
    if (over > 0) return days + ' days since the last touch, past the ' + cad + '-day mark for this tier.';
    return days + ' days since the last touch.';
  }

  /* A first line, so the suggestion costs a tap rather than a draft. Kept
     deliberately plain: a script that sounds written is worse than none. */
  function opener(p) {
    var n = String(p.name || '').split(' ').slice(-1)[0];
    if (p.owed) return 'Reply to ' + (n || 'them') + ' — short is fine, late and short beats later and long.';
    if (p.type === 'mentor' || p.type === 'ct') {
      return 'Send one specific thing you read this month and ask what they make of it.';
    }
    if (p.type === 'conference' || p.type === 'program') {
      return 'A line saying what you have been working on since you met, and nothing asked for.';
    }
    return 'One line. Say what prompted it, ask one question, stop.';
  }

  /* Today's person. Fixed for the day: the same list, the same skips, the
     same answer however many times the page is opened. */
  function pick() {
    var st = state(), day = today();
    var skipped = st.skipped[day] || {};
    if (st.done[day]) return null;               // already reached out today
    var best = null, bestScore = 0;
    nodes().forEach(function (p) {
      var s = score(p, skipped);
      if (s == null || !(s > bestScore)) return;
      bestScore = s; best = p;
    });
    if (!best) return null;
    var cad = CADENCE[best.type] != null ? CADENCE[best.type] : DEFAULT_CADENCE;
    var logged = lastTouchDays(best.id);
    var days = logged != null ? logged : (best.lastDays || 0);
    return {
      id: best.id, name: best.name, role: best.role || '',
      city: best.city || '', type: best.type || '', strength: best.strength || '',
      owed: !!best.owed, days: days, cadence: cad,
      ratio: Math.min(1, days / (cad || 1)),
      overdue: days > cad,
      why: why(best, days, cad),
      opener: opener(best),
      href: 'Dossiers.dc.html?person=' + encodeURIComponent(best.id),
      note: best.met || best.notes || ''
    };
  }

  /* Passed over — not today, but still owed. Comes back tomorrow. */
  function skip(id) {
    var st = state(), day = today();
    st.skipped[day] = st.skipped[day] || {};
    st.skipped[day][id] = 1;
    return writeJSON(SKEY, st);
  }

  /* Reached out. Writes the touch to the dossier, which is what lastTouchDays
     reads — so the pick genuinely moves on rather than repeating tomorrow. */
  function done(id, note) {
    var st = state(), day = today();
    st.done[day] = id;
    writeJSON(SKEY, st);
    var d = readJSON(DKEY, {}) || {};
    var rec = d[id] || (d[id] = {});
    if (!Array.isArray(rec.log)) rec.log = [];
    rec.log.unshift({ ts: Date.now(), note: note || 'reached out — from the Standing' });
    return writeJSON(DKEY, d);
  }

  function isDone() { return !!state().done[today()]; }

  w.CTContact = {
    pick: pick, skip: skip, done: done, isDone: isDone,
    score: score, CADENCE: CADENCE, KEY: SKEY
  };
})(typeof window !== 'undefined' ? window : this);
