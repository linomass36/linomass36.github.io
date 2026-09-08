/* ─────────────────────────────────────────────────────────────────────────
   backup.js — every store, in one file, restorable.

   WHY THIS EXISTS. The hub already had a backup, in Hub.dc.html, and it kept
   a hardcoded list of twenty keys. The hub writes forty. So the backup
   silently omitted twenty-two live stores, among them:

     plan_v2_state_v1   every plan item you have ticked
     ct_health_v1       the entire body record and health import
     ct_weekly_v1       the weekly reviews
     ct_week_v1         the elastic week
     ct_conditions_v1   declared conditions
     ct_facts_v1        the derived fact table Trends reads
     ct_rest_v1         the rest protocol's four lists

   It also listed two keys nothing writes any more. A backup that restores
   less than half the hub is worse than none: it is the one you trust.

   So this file does not keep a list. It enumerates localStorage, exactly as
   sync.js already does when deciding what to push, and uses the same rule —
   which means a store invented next year is backed up the day it is written,
   with nobody remembering to add it.

   WHAT IS DELIBERATELY LEFT OUT, and it is not an oversight:

     __sync*    bookkeeping — revisions, pending flags, the undo buffer.
                Restoring another device's sync cursor corrupts sync.
     __local*   device-only by contract. VAULT.md is explicit that the vault
                key lives at __local_vault_device_v1 precisely because
                anything outside that prefix gets uploaded. A downloaded file
                is even less private than Firestore — it goes to Downloads,
                into email, onto a USB stick — so the key that decrypts the
                whole published site must never be in one.
     __cal_tok  a Google OAuth token. Same reasoning: a credential in a file
                you might forward is a credential you have given away. Sign
                in again after a restore; it takes one tap.

   The exclusions are reported in the file's own manifest, so a restore can
   say what it will NOT bring back rather than leaving you to notice.
   ───────────────────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  var FORMAT = 1;
  var CREDENTIALS = ['__cal_tok'];

  function isDeviceOnly(k) {
    return k.indexOf('__sync') === 0 || k.indexOf('__local') === 0;
  }
  function isCredential(k) { return CREDENTIALS.indexOf(k) >= 0; }

  /* Every key this backup carries. The rule, not a list. */
  function dataKeys() {
    var out = [], i, k;
    for (i = 0; i < localStorage.length; i++) {
      k = localStorage.key(i);
      if (!k) continue;
      if (isDeviceOnly(k) || isCredential(k)) continue;
      out.push(k);
    }
    return out.sort();
  }

  function skippedKeys() {
    var out = [], i, k;
    for (i = 0; i < localStorage.length; i++) {
      k = localStorage.key(i);
      if (k && (isDeviceOnly(k) || isCredential(k))) out.push(k);
    }
    return out.sort();
  }

  function bytes(s) {
    try { return new Blob([s]).size; } catch (e) { return (s || '').length; }
  }
  function human(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }

  /* The file. `stores` is key -> raw string, exactly as localStorage holds it:
     no re-parsing, so a store this file does not understand still round-trips
     byte for byte. */
  function collect() {
    var keys = dataKeys(), stores = {}, total = 0;
    keys.forEach(function (k) {
      var v = null;
      try { v = localStorage.getItem(k); } catch (e) {}
      if (v == null) return;
      stores[k] = v;
      total += bytes(v);
    });
    return {
      format: FORMAT,
      app: 'CT Hub',
      version: (w.APP_CONFIG && w.APP_CONFIG.version) || '',
      at: new Date().toISOString(),
      day: (w.CTDay && w.CTDay.today) ? w.CTDay.today() : new Date().toISOString().slice(0, 10),
      count: Object.keys(stores).length,
      bytes: total,
      skipped: skippedKeys(),
      stores: stores
    };
  }

  function filename(b) {
    return 'ct-hub-backup-' + (b.day || 'export') + '.json';
  }

  /* Hand the file to the browser. Returns the manifest so a caller can report
     what was written without rebuilding it. */
  function download() {
    var b = collect();
    var json = JSON.stringify(b, null, 2);
    var a = document.createElement('a');
    var url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.href = url; a.download = filename(b);
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
    return b;
  }

  /* Read a file without touching anything, so the UI can say what a restore
     WOULD do. This is the whole reason restore is two steps. */
  function inspect(json) {
    var b;
    try { b = JSON.parse(json); } catch (e) { return { ok: false, why: 'That is not JSON.' }; }
    if (!b || typeof b !== 'object' || !b.stores || typeof b.stores !== 'object') {
      return { ok: false, why: 'No stores in it — not a hub backup.' };
    }
    if (b.format > FORMAT) {
      return { ok: false, why: 'Written by a newer version of the hub (format ' + b.format + ').' };
    }
    var keys = Object.keys(b.stores).sort();
    var replaces = [], adds = [], identical = [];
    keys.forEach(function (k) {
      var cur = null;
      try { cur = localStorage.getItem(k); } catch (e) {}
      if (cur == null) adds.push(k);
      else if (cur === b.stores[k]) identical.push(k);
      else replaces.push(k);
    });
    var here = dataKeys();
    var untouched = here.filter(function (k) { return keys.indexOf(k) < 0; });
    return {
      ok: true, backup: b, keys: keys,
      at: b.at, day: b.day, version: b.version,
      bytes: b.bytes || 0, human: human(b.bytes || 0),
      adds: adds, replaces: replaces, identical: identical, untouched: untouched
    };
  }

  /* Two modes, and the difference matters enough to be named at the button:

       merge    only writes stores you do not already have. Nothing you did
                since the backup is lost. The safe one.
       replace  writes every store in the file over what is here. Anything
                changed since the backup is gone.

     Neither deletes a store the file does not mention; a restore is not a
     factory reset, and silently dropping a store the backup predates would be
     the same class of bug as the list this file exists to replace. */
  function restore(json, mode) {
    var r = inspect(json);
    if (!r.ok) return { ok: false, why: r.why };
    var wrote = [], skipped = [], failed = [];
    r.keys.forEach(function (k) {
      var cur = null;
      try { cur = localStorage.getItem(k); } catch (e) {}
      if (mode !== 'replace' && cur != null) { skipped.push(k); return; }
      try { localStorage.setItem(k, r.backup.stores[k]); wrote.push(k); }
      catch (e) { failed.push(k); }
    });
    return { ok: true, mode: mode === 'replace' ? 'replace' : 'merge',
             wrote: wrote, skipped: skipped, failed: failed, untouched: r.untouched };
  }

  w.Backup = {
    FORMAT: FORMAT,
    dataKeys: dataKeys,
    skippedKeys: skippedKeys,
    collect: collect,
    filename: filename,
    download: download,
    inspect: inspect,
    restore: restore,
    human: human
  };
})(typeof window !== 'undefined' ? window : this);
