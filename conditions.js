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

   ── the correction this file carries ─────────────────────────────────────
   The first version had one setting per condition: declared, or not. That
   made every condition maximal. Declaring "injured" told the hub the body
   was finished, held the board, hid the numbers and asked for one thing —
   whether the injury was a torn hamstring or a sore shoulder that rules out
   pressing and nothing else. So the only truthful move on a bad-but-not-
   terrible day was to declare nothing, which is exactly the state this file
   was written to abolish.

   So a condition now carries two more facts, both asked at the moment you
   declare it:

     · a GRADE — is this debilitating, is it a slower day, or is it just on
       the record? Only the first holds anything. A slower day keeps the
       whole board on screen with its real numbers and lowers the ask; a
       noted condition changes nothing at all and exists so that a thin week
       has its reason attached to it when you read it back.

     · the AREAS it actually stops — lifting, cardio, stretching, a long
       sit, sleep. What you do not tick is the answer to "what can I still
       do", and each area names its own swap, so the page can say "the run
       is out, the bike is not" instead of going quiet.

   While a HOLD-grade condition stands, its systems are HELD:
     · they never render as owed, so they cannot read as failure;
     · nothing accrues against them;
     · streaks hold rather than break, which is what removes the reason to
       fake one.
   Their numbers still render. Being held is a fact about what is owed, not
   a reason to stop showing you where you actually stand.

   The precedent is this hub's own. anatomy-core.js already had gapDays(),
   reentryInfo(), a rest tier whose line reads "nothing accrues today", and
   a re-entry ramp that says "run Core, that is a full day today". It is the
   best idea in the codebase and it reached one system out of ten. This
   promotes it to all of them, at three strengths instead of one.

   Stored under ct_conditions_v1. sync.js carries every ct_* key, so a
   condition declared on a phone is standing on the desktop. Records written
   by the first version have no grade and no areas; they read back as the
   full-strength, full-scope condition they were declared as, so nothing
   silently loosens under you.
   ───────────────────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  var KEY = 'ct_conditions_v1';

  /* Which systems each scope covers. The ids match systems.js exactly — a
     typo here silently holds nothing, so they are asserted in one place.
     This is the coarse fallback: it applies to a condition with no areas
     ticked, and to every record the first version wrote. */
  var SCOPES = {
    body:   ['grind', 'record'],
    mind:   ['anatomy', 'study', 'reading'],
    output: ['plan', 'research'],
    people: ['network']
  };

  /* ── grades ──────────────────────────────────────────────────────────────
     How much of a condition this actually is. The question the picker asks
     is the one you would ask a person: is this stopping you, or slowing you?

     Only `hold` holds. `ease` deliberately changes nothing about what is
     rendered — the board, the numbers and the red column all stay — and
     changes only what counts as clearing a system. `none` is a note in the
     margin of the day and nothing more. */
  var GRADES = [
    { id: 'note', label: 'Just keep note', short: 'noted', effect: 'none',
      one: 'nothing is held',
      blurb: 'Nothing is held and nothing is lowered. The board asks for everything and the ' +
             'numbers read exactly as they would on any other day. This is on the record so a ' +
             'thin week has its reason attached when you read it back.' },

    { id: 'ease', label: 'Slower day', short: 'slower', effect: 'ease',
      one: 'the ask drops, the board stays',
      blurb: 'The whole board stays on screen with its real numbers — nothing is hidden and ' +
             'nothing is folded away. What changes is the size of the ask: the systems this ' +
             'touches drop to a floor you can hit today, and hitting the floor clears them.' },

    { id: 'stop', label: 'Stops me', short: 'out', effect: 'hold',
      one: 'the systems it touches are held',
      blurb: 'The systems this touches are held: they never render as owed, nothing accrues ' +
             'against them, and streaks hold. Their numbers still show — held is a fact about ' +
             'what is owed, not a reason to hide where you stand.' }
  ];

  /* A condition records what it BLOCKS and what it still ALLOWS, so the ask
     on a floor day can be derived rather than hardcoded. Hardcoding is how
     an earlier draft told someone with a lumbar injury to sit down for
     twenty minutes. `review` is the day the hub asks whether it still
     holds, so a condition cannot quietly become permanent.

     `areas` are the specific things a condition might stop, each carrying
     the systems it holds and — the part that matters on the day — the swap
     that survives it. An area left unticked is not a gap in the data: it is
     you saying that one is fine, and the page reads it as such.

     `gradeNames` renames a grade where the plain word is wrong for that
     condition: illness at full strength is bed-rest, an exam block is not
     an affliction. The mechanism underneath is identical. */
  var DEFS = [
    { id: 'injured',  label: 'Injured',    scope: ['body'],             review: 7,
      hint: 'body',
      detailHint: 'Where? e.g. lower back, left knee',
      phrase: 'you are injured', detailPhrase: 'the {d} is out',
      defaultGrade: 'ease',
      gradeNames: { note: 'Sore, but fine', ease: 'Work around it', stop: 'Debilitating' },
      gradeBlurbs: {
        ease: 'The board stays up with its real numbers. The parts you tick below drop out of ' +
              'today’s ask and their swaps take their place — the run goes, the bike does not.',
        stop: 'Everything the injury touches is held. Nothing accrues, the streaks hold, and the ' +
              'page asks for the one thing the injury still permits.'
      },
      areaLabel: 'What does it actually stop?',
      areaNote: 'Tick only what is genuinely out. What you leave unticked is what the hub will ask for.',
      areas: [
        { id: 'lift',     label: 'Lifting',              holds: ['grind'],
          alt: 'the unloaded half of the board — machines, the other side, rehab sets' },
        { id: 'cardio',   label: 'Running / cardio',     holds: ['grind'],
          alt: 'the bike, the pool or a walk in place of the run' },
        { id: 'mobility', label: 'Stretching / mobility', holds: [],
          alt: 'the mobility work that can be done lying down' },
        { id: 'sit',      label: 'Sitting for long',     holds: ['study', 'research', 'plan'],
          alt: 'standing bouts and audio in place of one long desk block' },
        { id: 'sleep',    label: 'Sleeping through',     holds: ['record'],
          alt: 'log the night anyway — a broken night is the data, not a missing entry' },
        { id: 'focus',    label: 'Concentrating',        holds: ['anatomy', 'study', 'reading'],
          alt: 'short bouts of recall, which survive a distracted head better than reading does' }
      ],
      blocks: ['lifting', 'running', 'long sitting'],
      allows: ['standing', 'walking', 'lying down', 'short bouts', 'audio'] },

    { id: 'ill',      label: 'Ill',        scope: ['body', 'mind'],     review: 5,
      hint: 'body + mind',
      detailHint: 'What is it? e.g. chest infection, migraine',
      phrase: 'you are ill', detailPhrase: 'you are ill — {d}',
      defaultGrade: 'ease',
      gradeNames: { note: 'Under the weather', ease: 'A slower day', stop: 'Bed-rest' },
      gradeBlurbs: {
        note: 'Nothing changes. The board asks for everything and the numbers are untouched — ' +
              'the entry exists so that next week you can see why the week looked like that.',
        ease: 'A slower day, not a lost one. The board stays up in full; the parts you tick drop ' +
              'to their floor, and the floor counts as clearing them.',
        stop: 'Bed-rest. Everything this reaches is held, nothing accrues, and the entire ask ' +
              'for the day is one line in the log.'
      },
      areaLabel: 'How far does it reach?',
      areaNote: 'Bed-rest usually means all of them. A cold that is only a cold may mean none.',
      areas: [
        { id: 'train',   label: 'Training of any kind',  holds: ['grind'],
          alt: 'a walk, if you can be upright at all' },
        { id: 'focus',   label: 'Sustained focus',       holds: ['study', 'research', 'plan'],
          alt: 'recall in short bouts, which a foggy head survives' },
        { id: 'screens', label: 'Screens and reading',   holds: ['reading', 'study'],
          alt: 'audio — a lecture or a podcast with your eyes shut' },
        { id: 'people',  label: 'Being around people',   holds: ['network'],
          alt: 'a message in place of a meeting' },
        /* Ticking this one is ticking all of them: nothing on the list
           survives not being able to stand up, and letting the page then
           report "still on: sustained focus" would be the sort of cheerful
           nonsense that gets a tool closed for good. */
        { id: 'upright', label: 'Being upright',         holds: ['grind', 'record', 'anatomy', 'study', 'reading', 'plan', 'research', 'network'],
          subsumes: ['train', 'focus', 'screens', 'people'],
          alt: 'the log line, and nothing else — that is the whole day' }
      ],
      blocks: ['lifting', 'running', 'sustained focus'],
      allows: ['lying down', 'audio', 'very short bouts'] },

    { id: 'overtime', label: 'Work spike', scope: ['output', 'mind'],   review: 14,
      hint: 'output + mind',
      detailHint: 'What is eating the week?',
      phrase: 'the week is full', detailPhrase: 'the week is full — {d}',
      defaultGrade: 'ease',
      gradeNames: { note: 'Busy, coping', ease: 'Short on hours', stop: 'No hours at all' },
      areaLabel: 'What has it taken?',
      areas: [
        { id: 'blocks',  label: 'Long blocks of time',   holds: ['research', 'plan'],
          alt: 'anything that fits in fifteen minutes' },
        { id: 'evening', label: 'The evenings',          holds: ['study', 'reading'],
          alt: 'the commute — audio, or cards on a phone' },
        { id: 'head',    label: 'Any deep thinking',     holds: ['research', 'anatomy'],
          alt: 'queue work, which needs no run-up' }
      ],
      blocks: ['long blocks', 'deep work'],
      allows: ['short bouts', 'audio', 'anything under 15 min'] },

    { id: 'exams',    label: 'Exam block', scope: ['output', 'people'], review: 21,
      hint: 'output + people',
      detailHint: 'Which exam, and when?',
      phrase: 'the exam block is on', detailPhrase: 'the exam block is on — {d}',
      defaultGrade: 'stop',
      gradeNames: { note: 'On the calendar', ease: 'Ramping up', stop: 'Head down' },
      areaLabel: 'What is on hold until it is over?',
      areas: [
        { id: 'projects', label: 'New projects',        holds: ['plan', 'research'],
          alt: 'the queue, which is the only thing that compounds this month' },
        { id: 'people',   label: 'Correspondence',      holds: ['network'],
          alt: 'a note in the network map to pick it up after' },
        { id: 'reading',  label: 'Reading off-syllabus', holds: ['reading'],
          alt: 'the syllabus itself, which is not off the table' }
      ],
      blocks: ['new projects', 'correspondence'],
      allows: ['review', 'recall', 'the queue'] },

    { id: 'flat',     label: 'Flat',       scope: ['body', 'mind', 'output', 'people'], review: 3,
      hint: 'everything, for three days',
      detailHint: 'Anything worth naming?',
      phrase: 'you are flat', detailPhrase: 'you are flat — {d}',
      defaultGrade: 'ease',
      gradeNames: { note: 'Off, but functioning', ease: 'Running on fumes', stop: 'Nothing in the tank' },
      areaLabel: 'What has gone?',
      areas: [
        { id: 'start',  label: 'Starting anything',     holds: ['plan', 'research', 'grind'],
          alt: 'finishing something already open, which needs no run-up' },
        { id: 'focus',  label: 'Holding attention',     holds: ['study', 'reading', 'anatomy'],
          alt: 'one card, or one page — the unit small enough to survive today' },
        { id: 'people', label: 'Talking to anyone',     holds: ['network'],
          alt: 'the journal, which asks nothing back' }
      ],
      blocks: ['anything needing momentum'],
      allows: ['one line', 'one card', 'one loop'] }
  ];

  /* The ask on a HOLD day, per condition. Small on purpose, and phrased as
     sufficient — the hub's own words from anatomy-core: "that is a full day
     today." */
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

  /* The ask on an EASE day. Different in kind from a hold ramp: it does not
     replace the board, it resizes it. So it names the floor rather than the
     single thing, and the page keeps rendering everything behind it. */
  var EASED = {
    injured: { ask: 'Work the half of the board the injury leaves open.',
               why: 'Nothing is held and nothing is hidden — the numbers below are the real ones. ' +
                    'What has changed is the size of a finished day: whatever the injury permits, done once, clears it.',
               alt: 'worse than you thought? → change it to debilitating and the board goes quiet' },
    ill:     { ask: 'Half of what a normal day asks, and log it.',
               why: 'The board is still up because you can still read it. Take the small version of ' +
                    'each thing — twenty cards not sixty, a walk not a session — and the day counts as done.',
               alt: 'if it turns into bed-rest, change the grade and everything holds' },
    overtime:{ ask: 'Anything that fits in the gaps — one card, one loop, one page.',
               why: 'The week is short on hours, not on days. The board stays visible so the small ' +
                    'wins land somewhere, and the floor is one unit of anything.',
               alt: 'a fifteen-minute day is still a day this fortnight' },
    exams:   { ask: 'The queue first, then whatever is left over.',
               why: 'Ramping into a block rather than sitting in one. Everything is still shown; ' +
                    'the queue is the part that must not slip.',
               alt: 'once the block starts properly, change this to head down' },
    flat:    { ask: 'One unit of anything on the board, then stop.',
               why: 'Not a plan and not a review. One card, one page, one line — the unit is small ' +
                    'because momentum is the thing missing, and one is how it comes back.',
               alt: 'this condition expires by itself in three days' }
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

  function gradeDef(id) {
    for (var i = 0; i < GRADES.length; i++) if (GRADES[i].id === id) return GRADES[i];
    return null;
  }

  /* The grade as this condition words it. A missing grade means a record the
     first version wrote, and those were all full strength — so the fallback
     is `stop`, never the def's default. Loosening someone's declared
     condition during an upgrade would be the one unforgivable bug in here. */
  function gradeFor(d, id) {
    var base = gradeDef(id) || gradeDef('stop');
    var out = { id: base.id, label: base.label, short: base.short, effect: base.effect,
                one: base.one, blurb: base.blurb };
    if (d && d.gradeNames && d.gradeNames[out.id]) out.label = d.gradeNames[out.id];
    if (d && d.gradeBlurbs && d.gradeBlurbs[out.id]) out.blurb = d.gradeBlurbs[out.id];
    return out;
  }

  // The grades a condition offers, worded for it, in escalating order.
  function grades(id) {
    var d = def(id);
    return GRADES.map(function (g) { return gradeFor(d, g.id); });
  }

  // Active conditions, each decorated with how long it has stood.
  function active() {
    var t = today();
    return read().map(function (c) {
      var d = def(c.id);
      var days = c.since ? daysBetween(c.since, t) + 1 : 1;
      var g = gradeFor(d, c.grade);
      var all = d.areas || [];
      var ticked = Array.isArray(c.areas) ? c.areas.slice() : [];
      // An area may swallow others whole; ticking it ticks them.
      all.forEach(function (a) {
        if (ticked.indexOf(a.id) < 0) return;
        (a.subsumes || []).forEach(function (o) { if (ticked.indexOf(o) < 0) ticked.push(o); });
      });
      var out = all.filter(function (a) { return ticked.indexOf(a.id) >= 0; });
      var open = all.filter(function (a) { return ticked.indexOf(a.id) < 0; });
      /* Where one area swallowed another, only the swallower's swap is
         worth offering: "a walk, if you can be upright" is not advice to
         give someone who has just said they cannot be upright. */
      var swallowed = {};
      out.forEach(function (a) { (a.subsumes || []).forEach(function (o) { swallowed[o] = true; }); });
      /* With areas ticked, what is blocked and what is left is a fact you
         supplied. Without them, fall back to the def's static wording —
         which is also what every pre-grade record gets. */
      var blocks = out.length ? out.map(function (a) { return a.label.toLowerCase(); }) : (d.blocks || []);
      var allows = out.length ? open.map(function (a) { return a.label.toLowerCase(); }).concat(d.allows || [])
                              : (d.allows || []);
      return {
        id: c.id, detail: c.detail || '', since: c.since || t,
        days: days, label: d.label,
        grade: g, effect: g.effect,
        areas: ticked.slice(), outAreas: out, openAreas: open,
        swaps: out.filter(function (a) { return !swallowed[a.id]; })
                  .map(function (a) { return a.alt; }).filter(Boolean),
        blocks: blocks, allows: allows,
        review: d.review, dueReview: days >= d.review
      };
    });
  }

  /* How a condition reads inside a sentence. "The ill is out" was what
     falling back to the label produced, so each def supplies its own. */
  function phrase(c) {
    var d = def(c.id);
    if (!d) return c.label || '';
    if (c.detail && d.detailPhrase) return d.detailPhrase.replace('{d}', c.detail);
    if (c.detail) return 'the ' + c.detail + ' is out';
    return d.phrase || d.label.toLowerCase();
  }

  // Active conditions at a given strength.
  function byEffect(e) {
    return active().filter(function (c) { return c.effect === e; });
  }
  function holding() { return byEffect('hold'); }
  function easing()  { return byEffect('ease'); }
  function noted()   { return byEffect('none'); }

  /* Declaring, or re-declaring. `opts` may be a plain detail string, which
     is what the first caller passed. Re-declaring an already-standing
     condition keeps its start date: changing a grade at noon is a correction,
     not a new injury, and resetting day 6 to day 1 would be a lie in the one
     place this file exists to stop lying. */
  function declare(id, opts) {
    var d = def(id);
    if (!d) return active();
    if (typeof opts === 'string' || opts == null) opts = { detail: opts || '' };

    var prev = null;
    read().forEach(function (c) { if (c.id === id) prev = c; });
    var list = read().filter(function (c) { return c.id !== id; });

    var grade = opts.grade != null ? opts.grade
              : (prev ? prev.grade : null) != null ? prev.grade
              : d.defaultGrade;
    var areas = Array.isArray(opts.areas) ? opts.areas
              : (prev && Array.isArray(prev.areas)) ? prev.areas : [];
    var known = {};
    (d.areas || []).forEach(function (a) { known[a.id] = true; });

    list.push({
      id: id,
      detail: (opts.detail != null ? opts.detail : (prev ? prev.detail : '')) || '',
      grade: gradeFor(d, grade).id,
      areas: areas.filter(function (a) { return known[a]; }),
      since: (prev && prev.since) || today()
    });
    write(list);
    return active();
  }

  function lift(id) {
    write(read().filter(function (c) { return c.id !== id; }));
    return active();
  }

  function toggle(id, opts) {
    return read().some(function (c) { return c.id === id; }) ? lift(id) : declare(id, opts);
  }

  // The stored record, or null — what the picker reopens with.
  function get(id) {
    var found = null;
    active().forEach(function (c) { if (c.id === id) found = c; });
    return found;
  }

  function clear() { write([]); return []; }

  /* Which systems one condition covers. Ticked areas are authoritative when
     there are any; otherwise the def's coarse scope stands in, which is what
     keeps pre-grade records behaving exactly as they did. */
  function scopeIds(c) {
    var d = def(c.id), out = {};
    if (!d) return out;
    if (c.outAreas && c.outAreas.length) {
      c.outAreas.forEach(function (a) {
        (a.holds || []).forEach(function (sysId) { out[sysId] = true; });
      });
      return out;
    }
    (d.scope || []).forEach(function (sc) {
      (SCOPES[sc] || []).forEach(function (sysId) { out[sysId] = true; });
    });
    return out;
  }

  // The set of system ids currently held, as a lookup. Hold grade only.
  function heldIds() {
    var out = {};
    holding().forEach(function (c) {
      var ids = scopeIds(c);
      for (var k in ids) out[k] = true;
    });
    return out;
  }

  /* Eased systems: still owed, still rendered, still counted — only the size
     of the ask moves. A system that is held by one condition and eased by
     another is held; the stronger claim wins. */
  function easedIds() {
    var out = {}, held = heldIds();
    easing().forEach(function (c) {
      var ids = scopeIds(c);
      for (var k in ids) if (!held[k]) out[k] = true;
    });
    return out;
  }

  function isHeld(sysId) { return !!heldIds()[sysId]; }
  function isEased(sysId) { return !!easedIds()[sysId]; }

  /* The hold-grade conditions that actually hold a system. A condition can
     be graded as stopping you and still hold nothing — stretching is the
     only thing out, and stretching is nobody's system — and collapsing the
     page to one ask on the strength of that would be the original bug in a
     new costume. */
  function stopping() {
    return holding().filter(function (c) {
      var ids = scopeIds(c);
      for (var k in ids) return true;
      return false;
    });
  }

  /* Is today a floor day — the short page, one ask, red column folded? Only
     a hold-grade condition that holds something does that. A slower day is
     emphatically not a floor day: the whole point of the grade is that the
     board stays up. */
  function floorDay() { return stopping().length > 0; }
  function easeDay() { return !floorDay() && easing().length > 0; }

  /* The ramp for today, given what is standing. Re-entry outranks a
     condition's own ask, because the point of a ramp is that it rises.
     A hold outranks an ease, and an ease outranks the drift ramp. */
  function ramp(opts) {
    opts = opts || {};
    if (opts.reentry) return RAMPS.reentry;
    var h = stopping();
    if (h.length && RAMPS[h[0].id]) return RAMPS[h[0].id];
    var e = easing();
    if (e.length && EASED[e[0].id]) return EASED[e[0].id];
    return RAMPS.drift;
  }

  /* What the conditions rule out, what they still permit, and what to do
     instead — merged across everything standing. Shown under the ask so it
     reads as derived, not asserted. A noted condition contributes nothing:
     it is on the record precisely because it is not stopping anything. */
  function envelope() {
    var blocks = {}, allows = {}, swaps = {};
    active().forEach(function (c) {
      if (c.effect === 'none') return;
      (c.blocks || []).forEach(function (b) { blocks[b] = true; });
      (c.allows || []).forEach(function (b) { allows[b] = true; });
      (c.swaps || []).forEach(function (b) { swaps[b] = true; });
    });
    // Anything explicitly out cannot also be listed as still on.
    Object.keys(blocks).forEach(function (b) { delete allows[b]; });
    return { blocks: Object.keys(blocks), allows: Object.keys(allows), swaps: Object.keys(swaps) };
  }

  w.Conditions = {
    KEY: KEY, DEFS: DEFS, SCOPES: SCOPES, RAMPS: RAMPS, GRADES: GRADES, EASED: EASED,
    active: active, declare: declare, lift: lift, toggle: toggle, clear: clear, get: get,
    holding: holding, stopping: stopping, easing: easing, noted: noted, byEffect: byEffect,
    phrase: phrase,
    heldIds: heldIds, easedIds: easedIds, isHeld: isHeld, isEased: isEased,
    scopeIds: scopeIds, floorDay: floorDay, easeDay: easeDay,
    ramp: ramp, envelope: envelope, grades: grades, gradeFor: gradeFor,
    def: def, today: today, daysBetween: daysBetween
  };
})(window);
