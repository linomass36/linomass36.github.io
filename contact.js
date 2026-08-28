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

  /* ── what to say ────────────────────────────────────────────────────────
     One template said the same thing every time a tier came up, so the card
     read as wallpaper by the third day. This builds a ROTATION instead: a
     list of angles, each one assembled from something the map already
     knows about this person, and each one carrying where it came from.

     The rule that keeps it honest: an angle is only offered when the field
     it needs is present. `ops` is their own opportunity list, `met` is how
     you know them, `notes` is what you wrote about them — so a suggestion
     can name a real thing without the code inventing one. Nothing here
     asserts a paper, a conversation or an opinion that is not in the store.

     `Ask about their work` is deliberately a QUESTION rather than a claim
     for the same reason: you know their field from `role`, you do not know
     what they published this month, and pretending to is how a message
     gets sent that should not have been. */

  function firstName(p) {
    var parts = String(p.name || '').trim().split(/\s+/);
    var last = parts[parts.length - 1] || 'them';
    return /^(prof|dr|mr|ms|mrs)\.?$/i.test(parts[0]) ? last : parts[0] || last;
  }

  /* "they are breast cancer surgeon" needed an article. */
  function article(s) {
    var t = lower(s);
    return (/^[aeiou]/i.test(t) ? 'an ' : 'a ') + t;
  }

  function lower(s) { return String(s || '').charAt(0).toLowerCase() + String(s || '').slice(1); }

  /* What the live phase needs, in words you would actually use. */
  function planNeed() {
    try {
      var V = w.PlanV2;
      if (!V || !V.livePhase) return null;
      var ph = V.livePhase();
      if (!ph) return null;
      return { label: ph.label, objective: ph.objective || '' };
    } catch (e) { return null; }
  }

  /* Something you are actually reading, so "I have been reading X" is true. */
  function reading() {
    try {
      var r = readJSON('ct_reading_v1', {}) || {};
      var items = r.items || r.books || r.state || {};
      var open = [];
      Object.keys(items).forEach(function (k) {
        var it = items[k];
        if (it && (it.status === 'reading' || it.started) && !it.done) {
          open.push(it.title || it.name || k);
        }
      });
      return open[0] || null;
    } catch (e) { return null; }
  }

  function angles(p) {
    var n = firstName(p), out = [];
    var logged = lastTouchDays(p.id);
    var days = logged != null ? logged : (p.lastDays != null ? p.lastDays : null);
    var need = planNeed();
    var book = reading();

    if (p.owed) out.push({ angle: 'the reply you owe', from: 'they are marked owed',
      text: 'Reply to ' + n + '. Short is fine — late and short beats later and long. ' +
            'Answer the thing they asked, then say what you have been doing since.' });

    (Array.isArray(p.ops) ? p.ops : []).forEach(function (op) {
      out.push({ angle: 'something on their list', from: 'their ops list on the Network Map',
        text: '\u201c' + String(op).replace(/\.$/, '') + '\u201d \u2014 ask for it plainly, ' +
              'give a date, and make it easy to say no to.' });
    });

    if (p.role) out.push({ angle: 'their work', from: 'their role: ' + p.role,
      text: 'Ask what they are working on now. You know they are ' + article(p.role) +
            ' \u2014 ask which case or paper is taking their attention this term, ' +
            'and say why you are asking.' });

    if (need) out.push({ angle: 'what you are doing', from: 'the live phase of the plan',
      text: 'Tell them what you are on: ' + lower(need.objective || need.label) +
            '. Two sentences, no ask attached \u2014 people answer updates more ' +
            'often than they answer requests.' });

    if (book) out.push({ angle: 'something you read', from: 'your reading list',
      text: 'You are reading ' + book + '. Send one line on what it changed for you ' +
            'and ask whether they read it the same way.' });

    if (p.met) out.push({ angle: 'how you know them', from: 'the "met" note on their card',
      text: 'Pick up the thread you already have \u2014 ' + lower(p.met.replace(/\.$/, '')) +
            '. Reference it directly rather than starting cold.' });

    if (p.notes) out.push({ angle: 'what you wrote about them', from: 'your notes on their card',
      text: 'Your note reads: \u201c' + String(p.notes).slice(0, 110).replace(/\s+\S*$/, '') +
            '\u2026\u201d Write the message that follows from it.' });

    if (p.introById || (p.reach || 0) >= 3) out.push({ angle: 'an introduction',
      from: 'their reach is ' + (p.reach || '\u2014') + ' of 3',
      text: 'Ask who else you should be talking to. High-reach people answer this ' +
            'more readily than they answer a request for their own time.' });

    out.push({ angle: 'no ask at all', from: 'the default, and the safest one',
      text: 'One line. Say what prompted it, ask one question, stop. ' +
            (days != null ? 'It has been ' + days + ' days; that is the whole reason needed.' : '') });

    return out;
  }

  /* Kept for anything still reading a single string. */
  function opener(p) {
    var a = angles(p);
    return a.length ? a[0].text : 'One line. Say what prompted it, ask one question, stop.';
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
      angles: angles(best),
      met: best.met || '', notes: best.notes || '',
      reach: best.reach == null ? null : best.reach,
      ops: Array.isArray(best.ops) ? best.ops.length : 0,
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
    pick: pick, skip: skip, done: done, isDone: isDone, angles: angles,
    score: score, CADENCE: CADENCE, KEY: SKEY
  };
})(typeof window !== 'undefined' ? window : this);
