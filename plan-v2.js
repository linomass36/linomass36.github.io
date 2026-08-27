/* ─────────────────────────────────────────────────────────────────────────
   plan-v2.js — state + render helpers shared by the v2 plan pages.

   One localStorage key holds everything the user changes: which Phase-0
   items are done, where each pipeline item sits and when it last moved,
   which verification questions are answered, and any plan imported from
   the Settings page. sync.js carries that key across devices like every
   other hub key, so nothing here talks to the network itself.

   The key is deliberately NOT the v1 key ('ct-master-plan-v2', which
   despite its name is v1's store). A shared key would have made the two
   plans overwrite each other's progress.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var KEY = 'plan_v2_state_v1';

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var v = JSON.parse(raw); if (v && typeof v === 'object') return v; }
    } catch (e) {}
    return {};
  }
  function write(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    return s;
  }
  function patch(fn) { var s = read(); fn(s); return write(s); }

  // day.js decides when a day starts — 05:00, not midnight.
  function today() { return window.CTDay ? window.CTDay.today() : new Date().toISOString().slice(0, 10); }
  function daysBetween(iso, from) {
    if (!iso) return null;
    var a = new Date(iso + 'T00:00:00'), b = from ? new Date(from + 'T00:00:00') : new Date();
    if (isNaN(a)) return null;
    return Math.round((b - a) / 86400000);
  }
  /* Negative = still ahead of you. The forcing function reads better as
     "N days left" than as a date you have to subtract in your head. */
  function daysUntil(iso) { var d = daysBetween(iso); return d === null ? null : -d; }

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function money(n) {
    if (n === null || n === undefined) return '—';
    var neg = n < 0; n = Math.abs(n);
    return (neg ? '−$' : '$') + n.toLocaleString('en-US');
  }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  /* ── the plan itself ────────────────────────────────────────────────
     A plan imported through Settings shadows the shipped file, so a
     recalibration takes effect without a deploy. The shipped copy stays
     the fallback, which is what makes a bad import recoverable. */
  function plan() {
    var s = read();
    if (s.imported && s.imported.phases) return s.imported;
    return window.PLAN_V2 || {};
  }
  function isImported() { var s = read(); return !!(s.imported && s.imported.phases); }

  /* ── done-state for any checkable item ─────────────────────────── */
  function isDone(id) { var d = read().done || {}; return !!d[id]; }
  function setDone(id, on) {
    return patch(function (s) {
      s.done = s.done || {};
      if (on) s.done[id] = today(); else delete s.done[id];
    });
  }
  function toggleDone(id) { var on = !isDone(id); setDone(id, on); return on; }
  function doneCount(ids) {
    var d = read().done || {}, n = 0;
    ids.forEach(function (i) { if (d[i]) n++; });
    return n;
  }

  /* ── what is actually next ─────────────────────────────────────────
     The v2 recalibration replaced a 371-step inventory with one live phase
     at a time, and every consumer that wanted "the next few moves" was
     still walking v1's branches. They now all come through here, so there
     is one answer to the question instead of four.

     `live` is the phase the calendar is in, not the first one marked live:
     a phase whose window has passed is history even if the file still says
     otherwise. Only the live phase carries items — a queued phase states an
     objective and a failure mode, and inventing tasks for it would be
     exactly the over-planning v2 exists to stop. */
  function livePhase() {
    var P = plan();
    var phases = P.phases || [];
    var t = today();
    var byDate = null, byFlag = null;
    phases.forEach(function (ph) {
      if (!byFlag && ph.status === 'live') byFlag = ph;
      if (!byDate && ph.start && ph.end && ph.start <= t && t <= ph.end) byDate = ph;
    });
    return byDate || byFlag || phases[0] || null;
  }

  function phaseItems(ph) {
    if (!ph) return [];
    var P = plan();
    var blk = P['phase' + ph.num];
    return (blk && blk.items) ? blk.items : [];
  }

  /* Every item the plan currently holds, flattened, each tagged with the
     phase it belongs to. */
  function allItems() {
    var P = plan();
    var out = [];
    (P.phases || []).forEach(function (ph) {
      phaseItems(ph).forEach(function (it) {
        out.push({ id: it.id, label: it.t, tag: it.tag || '', due: it.due || null,
                   detail: it.d || '', steps: it.steps || [],
                   phaseId: ph.id, phase: ph.label, color: ph.color || '#993C1D' });
      });
    });
    return out;
  }

  /* The next open moves, soonest deadline first, undated last. A due date is
     the only ordering v2 respects — everything live serves one date. */
  function moves(limit) {
    var d = read().done || {};
    var open = allItems().filter(function (it) { return !d[it.id]; });
    open.sort(function (a, b) {
      if (a.due && b.due) return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
      if (a.due) return -1;
      if (b.due) return 1;
      return 0;
    });
    return limit ? open.slice(0, limit) : open;
  }

  /* Counted against the live phase, which is the whole point of v2: a
     percentage of 371 items dated years out never moves and says nothing. */
  function counts() {
    var d = read().done || {};
    var ph = livePhase();
    var liveItems = phaseItems(ph);
    var all = allItems();
    var liveDone = 0;
    liveItems.forEach(function (it) { if (d[it.id]) liveDone++; });
    var totalDone = 0;
    all.forEach(function (it) { if (d[it.id]) totalDone++; });
    return {
      phase: ph, phaseLabel: ph ? ph.label : '',
      live: liveItems.length, liveDone: liveDone,
      total: all.length, totalDone: totalDone,
      later: all.length - liveItems.length,
      pct: liveItems.length ? Math.round(liveDone / liveItems.length * 100) : 0,
      pctAll: all.length ? Math.round(totalDone / all.length * 100) : 0
    };
  }

  /* What got closed in the last N days. setDone stamps the day rather than a
     timestamp, so this is day-accurate and needs no clock arithmetic. */
  function winsSince(days) {
    var d = read().done || {};
    var byId = {};
    allItems().forEach(function (it) { byId[it.id] = it; });
    var out = [];
    Object.keys(d).forEach(function (id) {
      var when = d[id];
      if (typeof when !== 'string') return;      // pre-dating writes stored 1
      var ago = daysBetween(when);
      if (ago === null || ago > days || ago < 0) return;
      out.push({ id: id, when: when, ago: ago,
                 label: byId[id] ? byId[id].label : id,
                 known: !!byId[id] });
    });
    return out.sort(function (a, b) { return a.ago - b.ago; });
  }

  /* ── pipeline ──────────────────────────────────────────────────────
     Stage and ball are user-editable; the shipped board is only the seed.
     movedAt is stamped on every stage change, because days-in-stage is
     the number the whole system is built to surface. */
  function pipeItem(seed) {
    var over = (read().pipe || {})[seed.id] || {};
    var it = Object.assign({}, seed, over);
    it.days = over.movedAt ? daysBetween(over.movedAt) : null;
    it.stale = it.days !== null && it.days >= (plan().pipeline || {}).redFlagDays;
    return it;
  }
  function setPipe(id, field, value) {
    return patch(function (s) {
      s.pipe = s.pipe || {};
      s.pipe[id] = s.pipe[id] || {};
      s.pipe[id][field] = value;
      if (field === 'stage') s.pipe[id].movedAt = today();
    });
  }
  function touchPipe(id) {
    return patch(function (s) {
      s.pipe = s.pipe || {};
      s.pipe[id] = s.pipe[id] || {};
      s.pipe[id].movedAt = today();
    });
  }

  /* ── verification queue ────────────────────────────────────────── */
  function verifyResult(n) { return (read().verify || {})[n] || null; }
  function setVerify(n, result) {
    return patch(function (s) {
      s.verify = s.verify || {};
      if (result) s.verify[n] = { result: result, at: today() };
      else delete s.verify[n];
    });
  }

  /* ── import / export ───────────────────────────────────────────────
     Export is what you hand an assistant to recalibrate against; import
     is how the answer comes back. Both go through Settings. */
  function importPlan(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('Not an object.');
    if (!Array.isArray(obj.phases) || !obj.phases.length) {
      throw new Error('No "phases" array — this does not look like a plan file.');
    }
    if (!obj.version) throw new Error('No "version" field.');
    patch(function (s) {
      s.imported = obj;
      s.importedAt = new Date().toISOString();
    });
    return obj;
  }
  function revertPlan() { return patch(function (s) { delete s.imported; delete s.importedAt; }); }
  function importedAt() { return read().importedAt || null; }

  function exportState() {
    var s = read();
    return { key: KEY, exportedAt: new Date().toISOString(),
             done: s.done || {}, pipe: s.pipe || {}, verify: s.verify || {} };
  }
  function resetProgress() {
    return patch(function (s) { delete s.done; delete s.pipe; delete s.verify; });
  }

  /* A page is either current or archived; the banner says which, so a v1
     page opened from a stale bookmark cannot be mistaken for live. */
  function archivedBanner(supersededBy) {
    var b = el('div', 'pv-rule pv-kill');
    b.innerHTML = 'Archived — this document was superseded on ' +
      esc(fmtDate((window.PLAN_V2 || {}).recalibrated)) + '. It is kept for the record. ' +
      'The current plan is <a href="' + esc(supersededBy || 'Plan.html') + '"><b>The Plan</b></a>.';
    return b;
  }

  window.PlanV2 = {
    KEY: KEY, read: read, write: write, patch: patch,
    plan: plan, isImported: isImported, importedAt: importedAt,
    today: today, daysBetween: daysBetween, daysUntil: daysUntil,
    fmtDate: fmtDate, money: money, esc: esc, el: el,
    isDone: isDone, setDone: setDone, toggleDone: toggleDone, doneCount: doneCount,
    livePhase: livePhase, phaseItems: phaseItems, allItems: allItems,
    moves: moves, counts: counts, winsSince: winsSince,
    pipeItem: pipeItem, setPipe: setPipe, touchPipe: touchPipe,
    verifyResult: verifyResult, setVerify: setVerify,
    importPlan: importPlan, revertPlan: revertPlan,
    exportState: exportState, resetProgress: resetProgress,
    archivedBanner: archivedBanner
  };
})();
