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

  var GROUP_ORDER = ['Every day', 'Study', 'Body', 'The plan', 'Research',
                     'People & money', 'Looking back', 'Plan upkeep'];

  var PAGES = {
    'Standing.html':             { name: 'The Standing',  group: 'Every day', back: 'front' },
    'Today.dc.html':             { name: 'Today',         group: 'Every day', parent: 'Standing.html', back: 'wrong' },
    'Plan.html':                 { name: 'The Plan',      group: 'Every day', parent: 'Standing.html', back: 'none' },
    'Conditions.html':           { name: 'Conditions',    group: 'Every day', parent: 'Standing.html', back: 'correct' },

    'Recall.html':               { name: 'Recall',        group: 'Study', parent: 'Today.dc.html', back: 'none' },
    'Anatomy.dc.html':           { name: 'Anatomy',       group: 'Study', parent: 'Today.dc.html', back: 'wrong' },
    'Study Engine.dc.html':      { name: 'Study Engine',  group: 'Study', parent: 'Recall.html',   back: 'wrong' },
    'Reading List.dc.html':      { name: 'Reading List',  group: 'Study', parent: 'Today.dc.html', back: 'wrong' },

    'Grind.dc.html':             { name: 'Grind board',   group: 'Body', parent: 'Today.dc.html', back: 'wrong' },
    'Life Log.dc.html':          { name: 'Life Log',      group: 'Body', parent: 'Today.dc.html', back: 'wrong' },
    'Health.html':               { name: 'The Body',      group: 'Body', parent: 'Today.dc.html', back: 'correct' },
    'Trends.html':               { name: 'Trends',        group: 'Body', parent: 'Life Log.dc.html', back: 'none' },
    'Week.html':                 { name: 'The Week',      group: 'Body', parent: 'Grind.dc.html', back: 'none' },

    'Campaign.html':             { name: 'The Campaign',  group: 'The plan', parent: 'Plan.html', back: 'correct' },
    'Verify.html':               { name: 'Verify',        group: 'The plan', parent: 'Plan.html', back: 'correct' },
    'Debt.html':                 { name: 'The Debt',      group: 'The plan', parent: 'Plan.html', back: 'correct' },
    'Ledger.html':               { name: 'The Ledger',    group: 'The plan', parent: 'Plan.html', back: 'correct' },
    'Day Budget.html':           { name: 'The Day Budget',group: 'The plan', parent: 'Plan.html', back: 'correct' },

    'Pipeline.html':             { name: 'Pipeline',      group: 'Research', parent: 'Plan.html', back: 'correct' },
    'Publication Pipeline.html': { name: 'Pipeline · the write-up', group: 'Research', parent: 'Plan.html', back: 'none' },
    'Conference Radar.dc.html':  { name: 'Conference Radar', group: 'Research', parent: 'Plan.html', back: 'wrong' },

    'Network Map.dc.html':       { name: 'Network Map',   group: 'People & money', parent: 'Plan.html', back: 'wrong' },
    'Dossiers.dc.html':          { name: 'Dossiers',      group: 'People & money', parent: 'Network Map.dc.html', back: 'wrong' },
    'Vault.dc.html':             { name: 'Vault',         group: 'People & money', parent: 'Plan.html', back: 'wrong' },

    'Weekly Review.dc.html':     { name: 'Weekly Review', group: 'Looking back', parent: 'Standing.html', back: 'wrong' },
    'Journal.dc.html':           { name: 'Journal',       group: 'Looking back', parent: 'Today.dc.html', back: 'wrong' },
    'Examiner.dc.html':          { name: 'The Examiner',  group: 'Looking back', parent: 'Weekly Review.dc.html', back: 'wrong' },
    /* The Workshop, not Mission Control. It is a bench you come to with a
       question about the plan — am I on track — which is why it sits under
       the Plan rather than being the front door thirteen pages linked to. */
    'Hub.dc.html':               { name: 'The Workshop',  group: 'Looking back', parent: 'Plan.html', back: 'none' },

    'Settings.html':             { name: 'Recalibrate',   group: 'Plan upkeep', parent: 'Plan.html', back: 'correct' },
    'Archive.html':              { name: 'Archive · v1',  group: 'Plan upkeep', parent: 'Plan.html', back: 'correct' },

    'CT Master Plan.html':       { name: 'CT Master Plan (v1)', archived: true, replacedBy: 'Plan.html' },
    'Summer Sprint.dc.html':     { name: 'Summer Sprint',       archived: true, replacedBy: 'Plan.html' },
    'Plan Analysis.dc.html':     { name: 'Plan Analysis',       archived: true, replacedBy: 'Plan.html' },
    'Research Plan.dc.html':     { name: 'Research Plan',       archived: true, replacedBy: 'Pipeline.html' },
    'Timeline.dc.html':          { name: 'Collision Timeline',  archived: true, replacedBy: 'Plan.html' },
    'Reference.dc.html':         { name: 'Reference',           archived: true, replacedBy: 'Archive.html' }
  };

  /* The phone tab bar. Deliberately NOT the spine: the spine is an ownership
     model and the tabs are a usage one, and conflating them would demote
     Reading and Journal — which are here because they are what gets opened
     day to day — in favour of an architecture argument. */
  var TABS = [
    ['Standing.html', 'Standing', '◆'],
    ['Today.dc.html', 'Today', '◷'],
    ['Reading List.dc.html', 'Reading', '▤'],
    ['Journal.dc.html', 'Journal', '✎'],
    ['Weekly Review.dc.html', 'Review', '◈']
  ];

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
    isSpine: isSpine, live: live, archived: archived, groups: groups,
    chain: chain, here: here
  };
})(typeof window !== 'undefined' ? window : this);
