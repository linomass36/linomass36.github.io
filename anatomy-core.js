/* ─────────────────────────────────────────────────────────────────────────
   anatomy-core.js — the closure rules, in one place.

   Three pages need to agree about what an open loop is, when a retest falls
   due, and whether you are in re-entry: the Anatomy page itself, Today (which
   opens the day from your phone) and Weekly Review (which surfaces the
   tripwires on a Sunday). Rules copied into three files drift apart, so they
   live here and nowhere else.

   STORAGE CONTRACT — keep this stable.
     ct_anatomy_v1 = { schema:3, app:"anatomy-closure", savedAt:ISO,
                       meta:{repaired,rollover},
                       blocks:{<blockId>:BlockRec},
                       days:{<YYYY-MM-DD>:DayRec},
                       orphans:{<unknownId>:BlockRec} }
     BlockRec {studied,inv,topo,gate,d14,d45,d14due,d45due,reps[],cards}
     DayRec   {tier,p0,rand,randScore,minRead,minDraw,cardsNew,cardsFixed,cardsCut,sheet,note}

   Block ids (nk1, hd4, tx10 …) are permanent primary keys. A title or a
   relation may be edited freely; an id must never be reused or renumbered.
   Ids no longer present in anatomy-data.js are parked in `orphans` rather
   than dropped, so no history is ever lost.

   The day boundary is 05:00 by default (meta.rollover), because a session
   that runs past midnight belongs to the day it started. That is deliberately
   not the Life Log's convention — separate stores, and each keeps the
   boundary that suits what it records.

   Requires anatomy-data.js for the syllabus.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var KEY = 'ct_anatomy_v1';
  // Read once, on first run, from the standalone file's stores. Never written
  // to and never deleted — that file keeps working alongside this one.
  var IMPORT_FROM = ['anatomy_closure_data', 'anatomy_system_v1', 'anatomy_blocks_v1'];
  var SCHEMA = 3;
  var DAY_MS = 86400000;

  var BLOCK_DEF = { studied: '', inv: '', topo: '', gate: '', d14: '', d45: '',
                    d14due: '', d45due: '', reps: [], cards: 0 };
  var DAY_DEF = { tier: '', p0: false, rand: '', randScore: '', minRead: 0, minDraw: 0,
                  cardsNew: 0, cardsFixed: 0, cardsCut: 0, sheet: '', note: '' };
  var META_DEF = { repaired: 0, rollover: 5 };

  // Set by read() so a page can say where the data came from.
  var lastImport = '';
  var lastMigrationNote = '';

  function data() { return (window.ANATOMY_DATA || {}); }
  function regions() { return data().regions || []; }
  function tiers() { return data().tiers || {}; }
  function gate() { return data().thoraxGate || ''; }
  function repairTotal() { return data().repairTotal || 0; }

  /* ── the syllabus ── */
  function allBlocks() {
    var out = [];
    regions().forEach(function (r) {
      (r.blocks || []).forEach(function (b) {
        out.push({ id: b.id, name: b.name, rel: b.rel, region: r.name, regionId: r.id });
      });
    });
    return out;
  }
  function findBlock(id) {
    var all = allBlocks();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  /* ── the store ── */
  function blank() {
    return { schema: SCHEMA, app: 'anatomy-closure', savedAt: '',
             meta: Object.assign({}, META_DEF), blocks: {}, days: {}, orphans: {} };
  }

  function detectSchema(p) {
    if (p && typeof p.schema === 'number') return p.schema;
    if (p && (p.blocks || p.days)) return 2;
    var k = p ? Object.keys(p) : [];
    if (k.length && p[k[0]] && typeof p[k[0]] === 'object' && 'studied' in p[k[0]]) return 1;
    return 0;
  }

  // Additive and lossless: unknown fields survive, missing ones default.
  function migrate(p) {
    if (!p || typeof p !== 'object') return blank();
    var v = detectSchema(p), notes = [];
    var d = JSON.parse(JSON.stringify(p));
    if (v === 0) return blank();

    if (v === 1) {                                  // a flat map of blocks
      d = { schema: 2, meta: {}, blocks: d, days: {} };
      notes.push('imported from the first tracker (blocks only)');
      v = 2;
    }
    if (v === 2) {                                  // minGen → read/draw + counts
      Object.keys(d.days || {}).forEach(function (key) {
        var x = d.days[key];
        if ('minGen' in x) { x.minDraw = +x.minGen || 0; delete x.minGen; }
        if ('minCards' in x) {
          var m = +x.minCards || 0;
          if (m) x.note = ((x.note || '') + ' [legacy: ' + m + ' card-edit min]').trim();
          delete x.minCards;
        }
      });
      notes.push('card minutes converted to read/draw minutes and card counts');
      v = 3;
    }

    var out = blank();
    out.meta = Object.assign({}, META_DEF, d.meta || {});
    Object.keys(d.blocks || {}).forEach(function (id) {
      var r = Object.assign({}, BLOCK_DEF, d.blocks[id] || {});
      r.reps = Array.isArray(r.reps) ? r.reps : [];
      r.cards = +r.cards || 0;
      (findBlock(id) ? out.blocks : out.orphans)[id] = r;
    });
    Object.keys(d.days || {}).forEach(function (day) {
      var r = Object.assign({}, DAY_DEF, d.days[day] || {});
      ['minRead', 'minDraw', 'cardsNew', 'cardsFixed', 'cardsCut'].forEach(function (k) { r[k] = +r[k] || 0; });
      r.p0 = !!r.p0;
      out.days[day] = r;
    });
    Object.assign(out.orphans, d.orphans || {});
    var orphanN = Object.keys(out.orphans).length;
    if (orphanN) notes.push(orphanN + ' block record' + (orphanN > 1 ? 's' : '') + ' kept aside — those ids are not in this build');
    lastMigrationNote = notes.join('; ');
    return out;
  }

  function read() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) {}
    if (raw) {
      try {
        var s = migrate(JSON.parse(raw));
        if (backfillStudy(s)) write(s);
        return s;
      } catch (e) { return blank(); }
    }

    // First run here: adopt whatever the standalone file left behind.
    for (var i = 0; i < IMPORT_FROM.length; i++) {
      var r = null;
      try { r = localStorage.getItem(IMPORT_FROM[i]); } catch (e) {}
      if (!r) continue;
      try {
        var s = migrate(JSON.parse(r));
        lastImport = IMPORT_FROM[i];
        backfillStudy(s);
        write(s);
        return s;
      } catch (e) {}
    }
    return blank();
  }

  function write(s) {
    s.schema = SCHEMA;
    s.app = 'anatomy-closure';
    s.savedAt = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    return s;
  }
  /* ── study hours reach the rest of the hub ────────────────────────────
     Read and draw minutes are study time, and every "hours studied" figure
     in the hub — the Study Engine's pacing bar, the weekly review's numbers,
     the weekly export — is computed from the Life Log's sessions. Without
     this they would be invisible there, and the week would be understated
     the moment the closure log got used.

     One session per anatomy day, tagged src:'anatomy' and rewritten in place
     rather than appended, so correcting the minutes corrects the figure
     instead of adding to it. Anchored at noon local so it lands on the same
     calendar day the Life Log keys by. */
  var LIFELOG_KEY = 'ct_lifelog_v1';

  function dayMinutes(s, day) {
    var r = s.days[day];
    return r ? ((+r.minRead || 0) + (+r.minDraw || 0)) : 0;
  }

  function mirrorStudy(s, day) {
    var mins = dayMinutes(s, day);
    var ll = null;
    try { ll = JSON.parse(localStorage.getItem(LIFELOG_KEY)); } catch (e) {}
    if (!ll || typeof ll !== 'object') ll = {};
    if (!Array.isArray(ll.sessions)) ll.sessions = [];
    ll.sessions = ll.sessions.filter(function (x) {
      return !(x && x.src === 'anatomy' && x.day === day);
    });
    if (mins > 0) {
      var end = new Date(day + 'T12:00:00').getTime();
      if (!isNaN(end)) {
        ll.sessions.push({ type: 'study', subject: 'anatomy',
                           start: end - mins * 60000, end: end,
                           src: 'anatomy', day: day });
      }
    }
    try { localStorage.setItem(LIFELOG_KEY, JSON.stringify(ll)); } catch (e) {}
  }

  // Minutes logged before this existed still count: mirrored once, then a
  // flag in meta stops it happening again.
  function backfillStudy(s) {
    if (s.meta && s.meta.mirrored) return false;
    Object.keys(s.days).forEach(function (d) {
      if (dayMinutes(s, d) > 0) mirrorStudy(s, d);
    });
    s.meta.mirrored = 1;
    return true;
  }

  // Read, change, write — the only way anything in here is edited.
  function mut(fn) {
    var s = read();
    var t = today(s);
    var before = dayMinutes(s, t);
    fn(s);
    write(s);
    if (dayMinutes(s, t) !== before) mirrorStudy(s, t);
    return s;
  }

  function blockRec(s, id) {
    if (!s.blocks[id]) s.blocks[id] = Object.assign({}, BLOCK_DEF, { reps: [] });
    return s.blocks[id];
  }
  function dayRec(s, d) {
    if (!s.days[d]) s.days[d] = Object.assign({}, DAY_DEF);
    return s.days[d];
  }

  /* ── dates ── */
  function rollover(s) { var r = s && s.meta && s.meta.rollover; return (r === 0 || r) ? r : 5; }
  function isoLocal(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function today(s) { var d = new Date(); d.setHours(d.getHours() - rollover(s)); return isoLocal(d); }
  function clockNow() { var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function addDays(iso, n) {
    if (!iso) return '';
    var d = new Date(iso + 'T12:00:00');
    if (isNaN(d)) return '';
    d.setDate(d.getDate() + n);
    return isoLocal(d);
  }
  function daysBetween(a, b) {
    if (!a || !b) return 0;
    var x = new Date(a + 'T12:00:00'), y = new Date(b + 'T12:00:00');
    if (isNaN(x) || isNaN(y)) return 0;
    return Math.round((y - x) / DAY_MS);
  }
  function lastNDays(s, n) {
    var out = [], t = today(s);
    for (var i = 0; i < n; i++) out.push(addDays(t, -i));
    return out;
  }

  /* ── block status ── */
  function status(s, id) {
    var b = blockRec(s, id);
    if (!b.studied) return 'todo';
    if (b.inv === '' || b.topo === '') {
      return daysBetween(b.studied, today(s)) > 2 ? 'stale' : 'open';
    }
    return (parseFloat(b.inv) >= 80 && parseFloat(b.topo) >= 80) ? 'closed' : 'repeat';
  }
  function closedDate(s, id) {
    var b = blockRec(s, id);
    return status(s, id) === 'closed' ? (b.gate || b.studied) : '';
  }
  function dueDate(s, id, k) {
    var b = blockRec(s, id), cd = closedDate(s, id);
    if (!cd) return '';
    return b[k + 'due'] || addDays(cd, k === 'd14' ? 14 : 45);
  }
  function dueList(s) {
    var t = today(s), out = [];
    allBlocks().forEach(function (b) {
      if (!closedDate(s, b.id)) return;
      var r = blockRec(s, b.id);
      ['d14', 'd45'].forEach(function (k) {
        if (r[k]) return;
        var dd = dueDate(s, b.id, k);
        if (dd && dd <= t) out.push({ b: b, k: k, dd: dd });
      });
    });
    return out.sort(function (a, x) { return a.dd < x.dd ? -1 : 1; });
  }
  function openLoops(s) {
    return allBlocks().filter(function (b) {
      return ['open', 'repeat', 'stale'].indexOf(status(s, b.id)) > -1;
    });
  }

  /* ── activity and re-entry ── */
  function activeDays(s) { return Object.keys(s.days).filter(function (d) { return s.days[d].tier; }).sort(); }
  function lastActive(s) { var a = activeDays(s); return a.length ? a[a.length - 1] : ''; }
  function gapDays(s) { var la = lastActive(s); return la ? daysBetween(la, today(s)) : 0; }

  /* Re-entry, with one correction to the original.
     The original asked "is the gap from the last logged day to today three or
     more?" — so declaring today's tier set the gap to zero and switched
     re-entry off on the spot. The banner promises "no new blocks for two
     days", and that promise could never be kept: the moment you used the page
     the cap lifted.
     The break is now measured where it actually happened — between the last
     two logged days, or between the last logged day and today — and re-entry
     holds until two days have been logged since it. */
  function reentryInfo(s) {
    var t = today(s);
    var active = activeDays(s).filter(function (d) { return d <= t; });
    if (!active.length) return { on: false, gap: 0 };

    // Still away: the gap runs from the last logged day up to today.
    var tail = daysBetween(active[active.length - 1], t);
    if (tail >= 3) return { on: true, gap: tail };

    // Back: find the most recent break and count the days logged since it.
    for (var i = active.length - 1; i > 0; i--) {
      var g = daysBetween(active[i - 1], active[i]);
      if (g >= 3) return { on: (active.length - i) < 2, gap: g };
    }
    return { on: false, gap: 0 };
  }
  function inReentry(s) { return reentryInfo(s).on; }

  function p0Rate(s, n) {
    var t = today(s);
    var days = lastNDays(s, n).filter(function (d) { return d <= t; });
    var run = days.filter(function (d) { return s.days[d] && s.days[d].tier && s.days[d].tier !== 'rest'; });
    if (!run.length) return null;
    return Math.round(100 * run.filter(function (d) { return s.days[d].p0; }).length / run.length);
  }
  function lastPaperScore(s) {
    var last = '';
    allBlocks().forEach(function (b) {
      var r = blockRec(s, b.id);
      (r.reps || []).forEach(function (x) { if (x.date > last) last = x.date; });
    });
    Object.keys(s.days).forEach(function (d) { if (s.days[d].randScore !== '' && d > last) last = d; });
    return last;
  }
  function d45Rate(s) {
    var p = 0, f = 0;
    allBlocks().forEach(function (b) {
      var r = blockRec(s, b.id);
      if (r.d45 === 'pass') p++;
      if (r.d45 === 'fail') f++;
    });
    return (p + f) ? Math.round(100 * p / (p + f)) : null;
  }

  /* ── the week ── */
  function weekStats(s) {
    var wk = lastNDays(s, 7);
    var o = { read: 0, draw: 0, cardsNew: 0, cardsFixed: 0, cardsCut: 0, run: 0, p0kept: 0, p0missed: 0, closed: 0, days: wk };
    wk.forEach(function (d) {
      var x = s.days[d];
      if (!x || !x.tier) return;
      if (x.tier !== 'rest') { o.run++; if (x.p0) o.p0kept++; else o.p0missed++; }
      o.read += +x.minRead || 0; o.draw += +x.minDraw || 0;
      o.cardsNew += +x.cardsNew || 0; o.cardsFixed += +x.cardsFixed || 0; o.cardsCut += +x.cardsCut || 0;
    });
    o.closed = allBlocks().filter(function (b) {
      var cd = closedDate(s, b.id);
      return cd && wk.indexOf(cd) > -1;
    }).length;
    return o;
  }

  /* ── the six-plus-one tripwires ── */
  function tripwires(s) {
    var t = today(s);
    var open = openLoops(s);
    var w = weekStats(s);
    var rate = d45Rate(s);
    var lp = lastPaperScore(s);
    var paperGap = lp ? daysBetween(lp, t) : 999;
    var thorax = regions().filter(function (r) { return r.id === 'thorax'; })[0];
    var thoraxStarted = thorax ? thorax.blocks.some(function (b) { return blockRec(s, b.id).studied; }) : true;

    return [
      { fired: open.length > 5,
        text: 'Open loops above 5 (' + open.length + '). No new block until they clear.' },
      { fired: w.p0missed >= 2,
        text: 'Phase 0 skipped ' + w.p0missed + ' times in the last 7 days. That week\'s checkmarks are void.' },
      { fired: paperGap >= 14,
        text: lp ? paperGap + ' days since anything was scored on paper. Studying by impression again.'
                 : 'Nothing has been scored on paper yet.' },
      { fired: rate !== null && rate < 70,
        text: 'D45 pass rate ' + (rate || 0) + '%. Closure is not holding — card design or block size, not effort.' },
      { fired: w.draw < w.read * 0.6 && w.read > 0,
        text: 'Draw ' + w.draw + ' min against read ' + w.read + ' min this week. Intake is crowding out generation — the exact shape of last year.' },
      { fired: w.closed > 0 && w.cardsNew / w.closed > 20,
        text: Math.round(w.cardsNew / w.closed) + ' new cards per closed block this week. Authoring is expanding again; the ceiling is about 15.' },
      { fired: !!gate() && t >= gate() && !thoraxStarted,
        text: 'Past ' + gate() + ' and thorax has not started. Move unfinished regions to closure-track and begin.' },
    ];
  }

  /* ── one glance, for Today and Mission Control ── */
  function summary(s) {
    s = s || read();
    var t = today(s);
    var all = allBlocks();
    var open = openLoops(s);
    var closed = all.filter(function (b) { return status(s, b.id) === 'closed'; });
    var day = s.days[t] || Object.assign({}, DAY_DEF);
    var re = reentryInfo(s);
    var lp = lastPaperScore(s);
    return {
      day: t,
      tier: day.tier, p0: !!day.p0,
      declared: !!day.tier,
      openLoops: open.length, closed: closed.length, total: all.length,
      dueToday: dueList(s).length,
      retestCap: re.on ? 3 : 6,
      reentry: re.on, gap: re.gap,
      p0Rate14: p0Rate(s, 14),
      d45Rate: d45Rate(s),
      daysSincePaper: lp ? daysBetween(lp, t) : null,
      daysToGate: gate() ? daysBetween(t, gate()) : null,
      firedTripwires: tripwires(s).filter(function (x) { return x.fired; }).length,
    };
  }

  /* ── the writes Today needs ── */
  function setTier(k) { return mut(function (s) { dayRec(s, today(s)).tier = k; }); }
  function toggleP0() { return mut(function (s) { var d = dayRec(s, today(s)); d.p0 = !d.p0; }); }

  window.AnatomyCore = {
    KEY: KEY, IMPORT_FROM: IMPORT_FROM, SCHEMA: SCHEMA,
    BLOCK_DEF: BLOCK_DEF, DAY_DEF: DAY_DEF, META_DEF: META_DEF,

    regions: regions, tiers: tiers, gate: gate, repairTotal: repairTotal,
    allBlocks: allBlocks, findBlock: findBlock,

    blank: blank, detectSchema: detectSchema, migrate: migrate,
    read: read, write: write, mut: mut, blockRec: blockRec, dayRec: dayRec,

    rollover: rollover, isoLocal: isoLocal, today: today, clockNow: clockNow,
    addDays: addDays, daysBetween: daysBetween, lastNDays: lastNDays,

    status: status, closedDate: closedDate, dueDate: dueDate, dueList: dueList, openLoops: openLoops,
    activeDays: activeDays, lastActive: lastActive, gapDays: gapDays,
    reentryInfo: reentryInfo, inReentry: inReentry,
    p0Rate: p0Rate, lastPaperScore: lastPaperScore, d45Rate: d45Rate,

    weekStats: weekStats, tripwires: tripwires, summary: summary,
    dayMinutes: dayMinutes, mirrorStudy: mirrorStudy,
    setTier: setTier, toggleP0: toggleP0,

    importedFrom: function () { return lastImport; },
    migrationNote: function () { return lastMigrationNote; },
  };
})();
