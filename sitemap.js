/* ─────────────────────────────────────────────────────────────
   sitemap.js — the only place that knows what pages exist.

   Five files used to re-declare this by hand and had already drifted apart:
   nav.js called Hub "Mission Control" while the Standing's directory called
   it "The workshop"; the directory listed the Plan twice and dropped the
   publication pipeline; Mission Control's rooms grid promoted three pages
   the v2 recalibration had archived. Nothing was wrong with any one of them.
   There were simply five of them.

   WHAT A PAGE DECLARES

     name    what to call it, everywhere
     group   which drawer heading it sits under — a theme, for finding things
     parent  which page OWNS it — the answer to "what is this part of", and
             the destination of its back link. Deliberately NOT the same axis
             as `group`: Journal is filed under "Looking back" because that is
             where you would look for it, and belongs to Today because that is
             where you write it.
     back    what its back control does today, which is what upbar.js needs
             in order to leave the right pages alone:
               'correct' — already points at its owner. Untouched.
               'wrong'   — points at Mission Control. Rewritten in place.
               'none'    — has no back control. One is injected, desktop only,
                           because on a phone the tab bar already covers it.
               'front'   — the front door. Needs nothing.

   ARCHIVED pages carry `archived: true` and `replacedBy`. They stay reachable
   by URL — a plan you can no longer read is a plan you cannot learn from —
   but nothing live should link to one, and the deploy fails if anything does.
   ───────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  var SPINE = ['Standing.html', 'Today.dc.html', 'Plan.html', 'Weekly Review.dc.html'];

  /* The v4 drawer headings. Kept only so a page that has not been folded yet
     still has a heading to sit under; DESTINATIONS below is what v5 navigates
     by, and this goes when the last page is folded. */
  var GROUP_ORDER = ['Every day', 'Study', 'Body', 'The plan', 'Research',
                     'People & money', 'Looking back', 'Plan upkeep'];

  /* ── DESTINATIONS ─────────────────────────────────────────────────────────
     v5 has ten places you can be, not thirty-one. This is that list.

     A destination is not a file yet. Each one names the page you LAND on today
     (`lands`) and collects the pages that will become its panels, so navigation
     can be reorganised before a single line of content moves — which is the
     whole point of doing it in this order. When a destination is built, `lands`
     changes to the merged page and its panels become tabs. Nothing else in the
     hub has to know that happened.

     Body and Study are deliberately two-level: the destination is one place in
     the navigation, but each heavy board keeps its own file and is loaded as a
     panel. Fusing four React boards and three vanilla pages into single files
     is where a regression would hide, and the navigation gain is identical.

     Every page carries `dest` and `panel`. A page with no `dest` is archived —
     the tests enforce that both ways.

     NAMES. Each destination and page carries three labels, because the names on
     this site are evocative rather than descriptive and both readings are
     useful: `name` is the written one ("The Standing"), `plain` says what it is
     ("Home"), `blurb` is the sentence underneath. Which pair is shown is a
     setting, not a decision taken here — see naming() below. */
  var DESTINATIONS = [
    { id: 'home',     name: 'The Standing',  plain: 'Home',      icon: '\u25c6',
      lands: 'Standing.html',
      blurb: 'What every system owes you today, and what to do next.' },

    { id: 'plan',     name: 'The Plan',      plain: 'Plan',      icon: '\u25b3',
      lands: 'Plan.html',
      blurb: 'The live plan, its forcing date, and the research that serves it.' },

    { id: 'body',     name: 'The Body',      plain: 'Body',      icon: '\u2692',
      lands: 'Grind.dc.html',
      blurb: 'Training, rest, the daily log, and what the numbers say about them.' },

    { id: 'study',    name: 'Recall',        plain: 'Study',     icon: '\u25c9',
      lands: 'Recall.html',
      blurb: 'What you owe your memory today, and the anatomy you are closing out.' },

    /* Its own destination, not a tab under Study. Reading here is recreation
       rather than work, and filing it beside the error-card queue made it look
       like homework. */
    { id: 'reading',  name: 'Reading List',  plain: 'Reading',   icon: '\u25a4',
      lands: 'Reading List.dc.html',
      blurb: 'The shelf, what is on the go, and what it is worth reading next.' },

    { id: 'money',    name: 'The Vault',     plain: 'Money',     icon: '\u25ce',
      lands: 'Vault.dc.html',
      blurb: 'Net worth, the targets you are aiming at, the debt, and what a day costs.' },

    { id: 'people',   name: 'Network Map',   plain: 'People',    icon: '\u2735',
      lands: 'Network Map.dc.html',
      blurb: 'Who is warm, who is owed a touch, their files, and the conferences to reach them at.' },

    { id: 'review',   name: 'Weekly Review', plain: 'Looking back', tab: 'Review', icon: '\u25c8',
      lands: 'Weekly Review.dc.html',
      blurb: 'The week examined, the journal, and whether the plan is still on track.' },

    { id: 'settings', name: 'Recalibrate',   plain: 'Settings',  icon: '\u2699',
      lands: 'Settings.html',
      blurb: 'Change the plan, declare a condition, back everything up, read the archive.' }
  ];

  var PAGES = {
    'Standing.html':             { name: 'The Standing',  group: 'Every day', back: 'front',
      dest: 'home', panel: 'Board', ord: 1,
      plain: 'Home',
      blurb: 'Every system, and the seven that want you.' },
    'Today.dc.html':             { name: 'Today',         group: 'Every day', parent: 'Standing.html', back: 'wrong',
      dest: 'home', panel: 'Today', ord: 2,
      plain: 'Today',
      blurb: 'The day in front of you, and the next three moves.' },
    'Plan.html':                 { name: 'The Plan',      group: 'Every day', parent: 'Standing.html', back: 'none',
      dest: 'plan', panel: 'Now', ord: 1,
      plain: 'The plan',
      blurb: 'What is live, and the date forcing it.' },
    'Conditions.html':           { name: 'Conditions',    group: 'Every day', parent: 'Standing.html', back: 'correct',
      dest: 'settings', panel: 'Conditions', ord: 2,
      plain: 'Conditions',
      blurb: 'Declare what is true today, and what it holds.' },

    'Recall.html':               { name: 'Recall',        group: 'Study', parent: 'Today.dc.html', back: 'none',
      dest: 'study', panel: 'Due today', ord: 1,
      plain: 'Due today',
      blurb: 'Anki, error cards and resurfaced notes — one desk.' },
    'Anatomy.dc.html':           { name: 'Anatomy',       group: 'Study', parent: 'Today.dc.html', back: 'wrong',
      dest: 'study', panel: 'Anatomy', ord: 2,
      plain: 'Anatomy',
      blurb: 'The closure log: open loops, retests, the syllabus.' },
    'Study Engine.dc.html':      { name: 'Study Engine',  group: 'Study', parent: 'Recall.html',   back: 'wrong',
      dest: 'study', panel: 'Error cards', ord: 3,
      plain: 'Error cards',
      blurb: 'Every mistake you log becomes a scheduled re-ask.' },
    'Reading List.dc.html':      { name: 'Reading List',  group: 'Study', parent: 'Today.dc.html', back: 'wrong',
      dest: 'reading', panel: 'Shelf', ord: 1,
      plain: 'Reading',
      blurb: 'The shelf, what is on the go, and what is worth reading next.' },

    'Grind.dc.html':             { name: 'Grind board',   group: 'Body', parent: 'Today.dc.html', back: 'wrong',
      dest: 'body', panel: 'Session', ord: 1,
      plain: 'Training',
      blurb: 'Month 1: the four-week foundation block.' },
    'Life Log.dc.html':          { name: 'Life Log',      group: 'Body', parent: 'Today.dc.html', back: 'wrong',
      dest: 'body', panel: 'Log', ord: 3,
      plain: 'Daily log',
      blurb: 'Close the day: sessions, screen time, sleep, spend.' },
    'Health.html':               { name: 'The Body',      group: 'Body', parent: 'Today.dc.html', back: 'correct',
      dest: 'body', panel: 'Body', ord: 4,
      plain: 'Health',
      blurb: 'Weight, sleep, food and workouts, from the health export.' },
    'Rest.html':                 { name: 'Rest',          group: 'Body', parent: 'Today.dc.html', back: 'correct',
      dest: 'body', panel: 'Rest', ord: 2,
      plain: 'Rest',
      blurb: 'What rest is, how to choose one, and tonight’s checklist.' },
    'Trends.html':               { name: 'Trends',        group: 'Body', parent: 'Life Log.dc.html', back: 'none',
      dest: 'body', panel: 'Trends', ord: 5,
      plain: 'Trends',
      blurb: 'What moves what — one row per day, correlated.' },
    'Week.html':                 { name: 'The Week',      group: 'Body', parent: 'Grind.dc.html', back: 'none',
      dest: 'body', panel: 'Week', ord: 6,
      plain: 'The week',
      blurb: 'The week ahead, laid into the hours the calendar leaves.' },

    'Campaign.html':             { name: 'The Campaign',  group: 'The plan', parent: 'Plan.html', back: 'correct',
      dest: 'plan', panel: 'Campaign', ord: 2,
      plain: 'Campaign',
      blurb: 'The phase map: what happens when, through 2027.' },
    'Verify.html':               { name: 'Verify',        group: 'The plan', parent: 'Plan.html', back: 'correct',
      dest: 'plan', panel: 'Verify', ord: 3,
      plain: 'Verify',
      blurb: 'Assumptions nothing should be planned around until they resolve.' },
    'Debt.html':                 { name: 'The Debt',      group: 'The plan', parent: 'Plan.html', back: 'correct',
      dest: 'money', panel: 'Debt', ord: 3,
      plain: 'Debt',
      blurb: 'What the plan costs before it earns anything.' },
    'Ledger.html':               { name: 'The Ledger',    group: 'The plan', parent: 'Plan.html', back: 'correct',
      dest: 'money', panel: 'Targets', ord: 2,
      plain: 'Targets',
      blurb: 'What you are aiming at, and whether it is still true.' },
    'Day Budget.html':           { name: 'The Day Budget',group: 'The plan', parent: 'Plan.html', back: 'correct',
      dest: 'money', panel: 'Day budget', ord: 4,
      plain: 'Day budget',
      blurb: 'What the whole hub costs in hours, and which currency is short.' },

    'Pipeline.html':             { name: 'Pipeline',      group: 'Research', parent: 'Plan.html', back: 'correct',
      dest: 'plan', panel: 'Research', ord: 4,
      plain: 'Research',
      blurb: 'Every output, and the two fields that predict whether it finishes.' },
    'Publication Pipeline.html': { name: 'Pipeline · the write-up', group: 'Research', parent: 'Plan.html', back: 'none',
      dest: 'plan', panel: 'Write-up', ord: 5,
      plain: 'Write-up',
      blurb: 'The cancer-research paper, stage by stage.' },
    'Conference Radar.dc.html':  { name: 'Conference Radar', group: 'Research', parent: 'Plan.html', back: 'wrong',
      dest: 'people', panel: 'Radar', ord: 3,
      plain: 'Conferences',
      blurb: 'Where to meet them, and the deadlines to submit by.' },

    'Network Map.dc.html':       { name: 'Network Map',   group: 'People & money', parent: 'Plan.html', back: 'wrong',
      dest: 'people', panel: 'Map', ord: 1,
      plain: 'Map',
      blurb: 'Who is warm, who is cooling, and where they are.' },
    'Dossiers.dc.html':          { name: 'Dossiers',      group: 'People & money', parent: 'Network Map.dc.html', back: 'wrong',
      dest: 'people', panel: 'Files', ord: 2,
      plain: 'Files',
      blurb: 'What was said, and when.' },
    'Vault.dc.html':             { name: 'Vault',         group: 'People & money', parent: 'Plan.html', back: 'wrong',
      dest: 'money', panel: 'Net worth', ord: 1,
      plain: 'Net worth',
      blurb: 'Snapshots, runway, and the line they make.' },

    'Weekly Review.dc.html':     { name: 'Weekly Review', group: 'Looking back', parent: 'Standing.html', back: 'wrong',
      dest: 'review', panel: 'This week', ord: 1,
      plain: 'This week',
      blurb: 'The four passes, once a week.' },
    'Journal.dc.html':           { name: 'Journal',       group: 'Looking back', parent: 'Today.dc.html', back: 'wrong',
      dest: 'review', panel: 'Journal', ord: 2,
      plain: 'Journal',
      blurb: 'What you wrote down.' },
    'Examiner.dc.html':          { name: 'The Examiner',  group: 'Looking back', parent: 'Weekly Review.dc.html', back: 'wrong',
      dest: 'review', panel: 'Examiner', ord: 3,
      plain: 'Examiner',
      blurb: 'Everything you logged, examined.' },
    /* The Workshop, not Mission Control. It is a bench you come to with a
       question about the plan — am I on track — which is why it sits under
       the Plan rather than being the front door thirteen pages linked to. */
    'Hub.dc.html':               { name: 'The Workshop',  group: 'Looking back', parent: 'Plan.html', back: 'none',
      dest: 'review', panel: 'Workshop', ord: 4,
      plain: 'Workshop',
      blurb: 'The bench: am I on track, and what does the data say.' },

    'Settings.html':             { name: 'Recalibrate',   group: 'Plan upkeep', parent: 'Plan.html', back: 'correct',
      dest: 'settings', panel: 'Recalibrate', ord: 1,
      plain: 'Recalibrate',
      blurb: 'Change the plan, and back everything up.' },
    'Archive.html':              { name: 'Archive · v1',  group: 'Plan upkeep', parent: 'Plan.html', back: 'correct',
      dest: 'settings', panel: 'Archive', ord: 3,
      plain: 'Archive',
      blurb: 'The v1 documents, kept and labelled.' },

    /* ── archived ──────────────────────────────────────────────────────────
       Each one carries what the Archive page needs to describe it: `meta` is
       its size at a glance, `was` what it was for, `why` it stopped being
       current, `replacedBy` what took over. That text used to live in a
       hardcoded list inside Archive.html — the same mistake this file was
       written to end — and it had already drifted: Reference.dc.html was
       archived here and absent there, so the one page the archive exists to
       keep readable was reachable only by typing its URL. */
    'CT Master Plan.html': {
      name: 'CT Master Plan (v1)', archived: true, replacedBy: 'Plan.html',
      meta: '371 steps \u00b7 13 branches', color: '#993C1D',
      was: 'The full inventory: four research tracks, six identity dimensions, and every step ' +
           'from the summer to the twenty-five-year view.',
      why: 'Its three founding assumptions did not hold \u2014 the capital engine, the research ' +
           'spine, and topic-first specialty choice. Replaced wholesale rather than edited.' },

    'Summer Sprint.dc.html': {
      name: 'Summer Sprint', archived: true, replacedBy: 'Plan.html',
      meta: '35 moves \u00b7 Jul \u2013 Oct 2026', color: '#3B6D11',
      was: 'The 52-day sprint at term resolution: the guide, the capital ladder, the habits ' +
           'underneath them.',
      why: 'The summer it planned has happened. Its earnings and product assumptions are ' +
           'superseded by the ground-truth table.' },

    'Research Plan.dc.html': {
      name: 'Research Plan', archived: true, replacedBy: 'Pipeline.html',
      meta: '5 tracks \u00b7 8 quarters', color: '#534AB7',
      was: 'A five-track research portfolio with phase-by-phase execution, decision gates and a ' +
           'dependency view.',
      why: 'It had drifted to five tracks while the master plan carried four, and neither matched ' +
           'what was actually being worked on. Collapsed to one live project plus an annex.' },

    'Plan Analysis.dc.html': {
      name: 'Plan Analysis', archived: true, replacedBy: 'Plan.html',
      meta: 'the strategic read', color: '#6E4B8A',
      was: 'The v1 plan examined rather than listed \u2014 summer into year into decade, with its ' +
           'soft spots written out.',
      why: 'It analyses a plan that no longer exists. Worth reading once as a record of what the ' +
           'reasoning looked like before the recalibration.' },

    'Timeline.dc.html': {
      name: 'Collision Timeline', archived: true, replacedBy: 'Plan.html',
      meta: 'one axis', color: '#2E6A86',
      was: 'Checkpoints, conferences and deadlines merged onto a single line so collisions were ' +
           'visible early.',
      why: 'The dates it merges are v1 dates. The v2 phase map carries the live ones.' },

    'Reference.dc.html': {
      name: 'Reference', archived: true, replacedBy: 'Archive.html',
      meta: 'the door to five documents', color: '#8a8577',
      was: 'One drawer entry instead of five: a page saying what each read-only document was and ' +
           'when it was worth opening, so they did not sit at the same weight as a page you open ' +
           'every morning.',
      why: 'The Archive does that job now, and says why each document was retired rather than ' +
           'only what it held.' }
  };

  /* The phone tab bar. Deliberately NOT the spine: the spine is an ownership
     model and the tabs are a usage one, and conflating them would demote
     Reading and Journal — which are here because they are what gets opened
     day to day — in favour of an architecture argument. */
  /* The phone tab bar: five destinations, not five pages. Standing and Today
     were both on it and rendered the same thirteen systems, which is the
     duplication v5 exists to remove — so the freed slot goes to the Body,
     which is opened every day and was three taps deep. */
  var TABS = [
    ['home',    'Home',    '\u25c6'],
    ['body',    'Body',    '\u2692'],
    ['study',   'Study',   '\u25c9'],
    ['plan',    'Plan',    '\u25b3'],
    ['review',  'Review',  '\u25c8']
  ];

  /* The tab bar as links, resolved to whatever page each destination lands on
     today. One place turns a destination into an href, so folding a
     destination later changes nothing here. */
  function tabLinks(mode) {
    return TABS.map(function (t) {
      var d = destination(t[0]);
      if (!d) return null;
      /* A tab bar is five words wide on a phone, so it uses the short label in
         BOTH modes — "Looking back" does not fit and truncating it to "Look…"
         teaches nobody anything. The long plain name lives in the drawer. */
      return { href: d.lands, id: d.id, icon: t[2], label: d.tab || t[1] };
    }).filter(Boolean);
  }

  function get(file) { return PAGES[file] || null; }
  function nameOf(file) { var p = PAGES[file]; return p ? p.name : file; }
  function parentOf(file) { var p = PAGES[file]; return (p && p.parent) || null; }
  function isArchived(file) { return !!(PAGES[file] && PAGES[file].archived); }
  function isSpine(file) { return SPINE.indexOf(file) >= 0; }

  function live() {
    return Object.keys(PAGES).filter(function (f) { return !PAGES[f].archived; });
  }
  function archived() {
    return Object.keys(PAGES).filter(function (f) { return PAGES[f].archived; });
  }

  /* The archived pages as full records, in declaration order, for the Archive
     page to render. Everything needed to describe a retired document is here,
     so archiving a page is one edit in this file rather than two in two — and
     a page cannot be archived into invisibility again. */
  function archivedPages() {
    return archived().map(function (f) {
      var p = PAGES[f];
      return { href: f, name: p.name, meta: p.meta || '', color: p.color || '#8a8577',
               was: p.was || '', why: p.why || '', now: p.replacedBy || 'Plan.html' };
    });
  }

  /* ── destinations ────────────────────────────────────────────────────────
     The v5 navigation. `byDestination()` is what the drawer and the tab bar
     read: ten headings, each with the pages that will become its panels, in
     panel order. It works today, against thirty-one separate files, and it
     will keep working unchanged once those files are merged — the only thing
     that changes is that `lands` stops differing from the panels' own hrefs. */
  function destinations() { return DESTINATIONS.slice(); }

  function destOf(file) {
    var p = PAGES[file];
    return (p && p.dest) || null;
  }
  function destination(id) {
    for (var i = 0; i < DESTINATIONS.length; i++) {
      if (DESTINATIONS[i].id === id) return DESTINATIONS[i];
    }
    return null;
  }
  /* Panel order is declared per page (`ord`), not inherited from the order
     PAGES happens to be written in. The first panel is what the destination
     opens on, so this is a real decision — Body opens on the session you owe
     today, Money on net worth — and leaving it to file order got it wrong. */
  function panelsOf(id) {
    return live().filter(function (f) { return PAGES[f].dest === id; })
                 .sort(function (a, b) { return (PAGES[a].ord || 99) - (PAGES[b].ord || 99); })
                 .map(function (f) { return { href: f, panel: PAGES[f].panel || PAGES[f].name,
                                              ord: PAGES[f].ord || 99 }; });
  }
  function byDestination() {
    return DESTINATIONS.map(function (d) {
      return { id: d.id, name: d.name, plain: d.plain, blurb: d.blurb, icon: d.icon,
               lands: d.lands, panels: panelsOf(d.id) };
    });
  }

  /* ── naming ──────────────────────────────────────────────────────────────
     The pages are named rather than described — "The Standing", "The Examiner",
     "Recalibrate" — which reads well and tells a newcomer nothing. Rather than
     choose, both are available and the reader picks:

       'named'  the written name, with the plain sentence beneath it
       'plain'  the plain word, and the written name steps aside

     Stored under hub_naming_v1, which sync.js carries between devices like any
     other preference. Guarded because this file is also loaded in tests and by
     the build, where there is no localStorage at all. */
  var NAME_KEY = 'hub_naming_v1';

  function naming() {
    try {
      var v = w.localStorage && w.localStorage.getItem(NAME_KEY);
      return v === 'plain' ? 'plain' : 'named';
    } catch (e) { return 'named'; }
  }
  function setNaming(mode) {
    try { w.localStorage.setItem(NAME_KEY, mode === 'plain' ? 'plain' : 'named'); }
    catch (e) {}
  }

  /* One label, resolved for whichever mode is on. `title` is what to show big,
     `sub` what to show under it. In plain mode the written name becomes the
     subtitle rather than being thrown away — it is still what the page calls
     itself, and a reader who has learned it should not lose it. */
  function label(file, mode) {
    var p = PAGES[file]; if (!p) return { title: file, sub: '' };
    mode = mode || naming();
    if (mode === 'plain' && p.plain) return { title: p.plain, sub: p.blurb || '' };
    return { title: p.name, sub: p.blurb || (p.plain || '') };
  }
  function destLabel(d, mode) {
    mode = mode || naming();
    if (mode === 'plain') return { title: d.plain, sub: d.blurb || '' };
    return { title: d.name, sub: d.blurb || '' };
  }

  /* Grouped for the drawer and the Standing's directory, in reading order. */
  function groups() {
    var by = {};
    live().forEach(function (f) {
      var g = PAGES[f].group || 'Plan upkeep';
      (by[g] = by[g] || []).push([f, PAGES[f].name]);
    });
    return GROUP_ORDER.filter(function (g) { return by[g] && by[g].length; })
                      .map(function (g) { return [g, by[g]]; });
  }

  /* The chain from a page up to the front door. Used by upbar.js, and by the
     deploy check that every page can actually be got out of. */
  function chain(file) {
    var out = [], seen = {}, cur = file, guard = 0;
    while (cur && !seen[cur] && guard++ < 12) {
      seen[cur] = 1;
      var p = parentOf(cur);
      if (!p) break;
      out.push(p);
      cur = p;
    }
    return out;
  }

  /* Which file the browser is looking at. */
  function here() {
    try { return decodeURIComponent((location.pathname.split('/').pop() || '')); }
    catch (e) { return (location.pathname.split('/').pop() || ''); }
  }

  w.SITEMAP = {
    spine: SPINE, groupOrder: GROUP_ORDER, pages: PAGES, tabs: TABS,
    get: get, nameOf: nameOf, parentOf: parentOf, isArchived: isArchived,
    isSpine: isSpine, live: live, archived: archived, archivedPages: archivedPages,
    groups: groups,
    destinations: destinations, destination: destination, destOf: destOf,
    panelsOf: panelsOf, byDestination: byDestination, tabLinks: tabLinks,
    naming: naming, setNaming: setNaming, label: label, destLabel: destLabel,
    chain: chain, here: here
  };
})(typeof window !== 'undefined' ? window : this);
