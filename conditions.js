/* ─────────────────────────────────────────────────────────────────────────
   conditions.js — what is true about you, not just what is owed.

   Every system in this hub computes what you owe against a fixed plan, so
   the only way it could express a changed circumstance was to turn
   everything red at once. An injured back and a flat week arrived as nine
   simultaneous failures, every morning, in bulk.

   A condition names what is actually CONSTRAINED, and which systems that
   covers. The scoping is the whole point: a lumbar injury stops the grind
   board and has no opinion whatsoever about recall, so it holds two systems
   and leaves the other eight alone. A global "having a bad time" switch
   would be a lie in both directions.

   While a condition stands, its systems are HELD:
     · they never render as owed, so they cannot read as failure;
     · nothing accrues against them;
     · streaks hold rather than break, which is what removes the reason to
       fake one.

   The precedent is this hub's own. anatomy-core.js already had gapDays(),
   reentryInfo(), a rest tier whose line reads "nothing accrues today", and
   a re-entry ramp that says "run Core, that is a full day today". It is the
   best idea in the codebase and it reached one system out of ten. This
   promotes it to all of them.

   Stored under ct_conditions_v1. sync.js carries every ct_* key, so a
   condition declared on a phone is standing on the desktop.
   ───────────────────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  var KEY = 'ct_conditions_v1';

  /* Which systems each scope covers. The ids match systems.js exactly — a
     typo here silently holds nothing, so they are asserted in one place. */
  var SCOPES = {
    body:   ['grind', 'record'],
    mind:   ['anatomy', 'study', 'reading'],
    output: ['plan', 'research'],
    people: ['network']
  };

  /* A condition records what it BLOCKS and what it still ALLOWS, so the ask
     on a floor day can be derived rather than hardcoded. Hardcoding is how
     an earlier draft told someone with a lumbar injury to sit down for
     twenty minutes. `review` is the day the hub asks whether it still
     holds, so a condition cannot quietly become permanent. */
  var DEFS = [
    { id: 'injured',  label: 'Injured',    scope: ['body'],             review: 7,
      hint: 'body',
      blocks: ['lifting', 'running', 'long sitting'],
      allows: ['standing', 'walking', 'lying down', 'short bouts', 'audio'] },

    { id: 'ill',      label: 'Ill',        scope: ['body', 'mind'],     review: 5,
      hint: 'body + mind',
      blocks: ['lifting', 'running', 'sustained focus'],
      allows: ['lying down', 'audio', 'very short bouts'] },

    { id: 'overtime', label: 'Work spike', scope: ['output', 'mind'],   review: 14,
      hint: 'output + mind',
      blocks: ['long blocks', 'deep work'],
      allows: ['short bouts', 'audio', 'anything under 15 min'] },

    { id: 'exams',    label: 'Exam block', scope: ['output', 'people'], review: 21,
      hint: 'output + people',
      blocks: ['new projects', 'correspondence'],
      allows: ['review', 'recall', 'the queue'] },

    { id: 'flat',     label: 'Flat',       scope: ['body', 'mind', 'output', 'people'], review: 3,
      hint: 'everything, for three days',
      blocks: ['anything needing momentum'],
      allows: ['one line', 'one card', 'one loop'] }
  ];

  /* The ask, per condition. Small on purpose, and phrased as sufficient —
     the hub's own words from anatomy-core: "that is a full day today." */
  var RAMPS = {
    injured: { ask: 'Twenty Anki cards, standing or lying — whichever the back allows.',
               why: 'The back rules out lifting, running and a long sit. It does not rule out recall, ' +
                    'and recall is the only thing here that compounds if you leave it. Two bouts if one is too long.',
               alt: 'still too much? → declare rest. The streak holds either way; that is what held means.' },
    ill:     { ask: 'Log the day, then close the laptop.',
               why: 'One line in the Life Log is the whole ask. Everything else is held.',
               alt: 'about forty seconds' },
    overtime:{ ask: 'Move one card on the research plan.',
               why: 'A shift that eats the week still leaves ten minutes, and one card keeps the thread alive.',
               alt: 'or declare rest — the week is already full' },
    exams:   { ask: 'Run the queue, nothing else.',
               why: 'The queue is the only thing that compounds. The rest of the board is held until the block ends.',
               alt: 'twenty cards is a full day this week' },
    flat:    { ask: 'Write one line in the Journal.',
               why: 'Not a plan, not a review. One line about today — that is the entire requirement, and it resets the clock.',
               alt: 'this condition expires by itself in three days' },
    drift:   { ask: 'Pick the smallest open loop and shut it.',
               why: 'Days down is a rut, not a verdict. The ramp back is one closed loop, and the hub will not ' +
                    'show you the backlog until you ask for it.',
               alt: 'the backlog will keep' },
    reentry: { ask: 'Two loops today, and log it.',
               why: 'Yesterday you did the one thing, so the ramp goes up by one — not back to the full board.',
               alt: 'still too much? → back to one. The ramp only rises when you clear it.' }
  };

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  function daysBetween(a, b) {
    var x = new Date(a + 'T12:00:00').getTime(), y = new Date(b + 'T12:00:00').getTime();
    return Math.max(0, Math.round((y - x) / 86400000));
  }

  /* Every read is defensive. This file is loaded by the page you open first
     every morning, and a glance that throws takes the whole page with it. */
  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var v = JSON.parse(raw);
      if (!Array.isArray(v)) return [];
      return v.filter(function (c) { return c && c.id && def(c.id); });
    } catch (e) { return []; }
  }

  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }

  function def(id) {
    for (var i = 0; i < DEFS.length; i++) if (DEFS[i].id === id) return DEFS[i];
    return null;
  }

  // Active conditions, each decorated with how long it has stood.
  function active() {
    var t = today();
    return read().map(function (c) {
      var d = def(c.id);
      var days = c.since ? daysBetween(c.since, t) + 1 : 1;
      return {
        id: c.id, detail: c.detail || '', since: c.since || t,
        days: days, label: d.label, blocks: d.blocks, allows: d.allows,
        review: d.review, dueReview: days >= d.review
      };
    });
  }

  function declare(id, detail) {
    if (!def(id)) return active();
    var list = read().filter(function (c) { return c.id !== id; });
    list.push({ id: id, detail: detail || '', since: today() });
    write(list);
    return active();
  }

  function lift(id) {
    write(read().filter(function (c) { return c.id !== id; }));
    return active();
  }

  function toggle(id, detail) {
    return read().some(function (c) { return c.id === id; }) ? lift(id) : declare(id, detail);
  }

  function clear() { write([]); return []; }

  // The set of system ids currently held, as a lookup.
  function heldIds() {
    var out = {};
    active().forEach(function (c) {
      var d = def(c.id);
      if (!d) return;
      d.scope.forEach(function (sc) {
        (SCOPES[sc] || []).forEach(function (sysId) { out[sysId] = true; });
      });
    });
    return out;
  }

  function isHeld(sysId) { return !!heldIds()[sysId]; }

  /* The ramp for today, given what is standing. Re-entry outranks a
     condition's own ask, because the point of a ramp is that it rises. */
  function ramp(opts) {
    opts = opts || {};
    if (opts.reentry) return RAMPS.reentry;
    var a = active();
    if (a.length && RAMPS[a[0].id]) return RAMPS[a[0].id];
    return RAMPS.drift;
  }

  /* What the conditions rule out and still permit, merged across everything
     standing. Shown under the ask so it reads as derived, not asserted. */
  function envelope() {
    var blocks = {}, allows = {};
    active().forEach(function (c) {
      (c.blocks || []).forEach(function (b) { blocks[b] = true; });
      (c.allows || []).forEach(function (b) { allows[b] = true; });
    });
    return { blocks: Object.keys(blocks), allows: Object.keys(allows) };
  }

  w.Conditions = {
    KEY: KEY, DEFS: DEFS, SCOPES: SCOPES, RAMPS: RAMPS,
    active: active, declare: declare, lift: lift, toggle: toggle, clear: clear,
    heldIds: heldIds, isHeld: isHeld, ramp: ramp, envelope: envelope,
    def: def, today: today, daysBetween: daysBetween
  };
})(window);
