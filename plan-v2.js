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

  function today() { return new Date().toISOString().slice(0, 10); }
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
    pipeItem: pipeItem, setPipe: setPipe, touchPipe: touchPipe,
    verifyResult: verifyResult, setVerify: setVerify,
    importPlan: importPlan, revertPlan: revertPlan,
    exportState: exportState, resetProgress: resetProgress,
    archivedBanner: archivedBanner
  };
})();
