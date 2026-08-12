/* ─────────────────────────────────────────────────────────────
   obsidian.js — two-way bridge between the Reading List and an
   Obsidian vault.

   One book = one Markdown note. The note carries everything in its
   frontmatter (status, dates, where you are, tags) and its body
   (timestamped notes with a place in the book, plus the reflection
   fields). Edit the note in Obsidian, or edit the book on the site —
   the next sync reconciles both sides.

   Two transports, pick either (or both):

     1. VAULT FOLDER — the browser writes straight into the vault
        directory on disk (File System Access API: Chrome/Edge on
        desktop). No Obsidian plugin, no server. You grant the folder
        once; the handle is remembered in IndexedDB.

     2. LOCAL REST API — the "Local REST API" community plugin in
        Obsidian exposes the vault over https://127.0.0.1:27124.
        Works while Obsidian is running, in any browser that can reach
        it (accept the plugin's self-signed certificate once).

   Merging is a real three-way merge, not a last-writer-wins clobber:
   we keep a snapshot of what was last synced, so an edit made in
   Obsidian and an edit made on the site both survive, and a note you
   delete on one side stays deleted.

   Everything is exposed on window.ObsidianBridge.
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var FOLDER_DEFAULT = 'Reading List';
  var CFG_KEY = 'ct_obsidian_cfg_v1';   // lives in localStorage → rides the Firestore sync

  // The reflection prompts, kept here so the page and the Markdown
  // writer/parser can never drift apart.
  var REFLECTION = [
    { key: 'found',    label: 'How did you find it?',                 ph: 'recommended by…, cited in…, stumbled on…' },
    { key: 'takeaway', label: 'The main takeaway?',                   ph: 'the one idea worth keeping' },
    { key: 'thoughts', label: 'Thoughts, quotes, lines worth saving', ph: 'anything you want your future self to reread' },
    { key: 'action',   label: 'What will you do because of it?',      ph: 'a habit, an experiment, the next book…' }
  ];

  // Scalars that participate in the three-way merge.
  var SCALARS = ['title', 'by', 'shelf', 'note', 'doi', 'status', 'progress', 'pages', 'started', 'finished'];

  // ── Config ───────────────────────────────────────────────────
  function cfg() {
    var c = null;
    try { var raw = localStorage.getItem(CFG_KEY); if (raw) c = JSON.parse(raw); } catch (e) {}
    c = c || {};
    return {
      folder:    c.folder || FOLDER_DEFAULT,
      vaultName: c.vaultName || '',
      restUrl:   c.restUrl || 'https://127.0.0.1:27124',
      restKey:   c.restKey || '',
      transport: c.transport || 'folder',   // 'folder' | 'rest'
      includeAll: !!c.includeAll,           // also write books you've never touched
      lastSync:  c.lastSync || '',
      lastError: c.lastError || ''
    };
  }
  function setCfg(patch) {
    var c = Object.assign(cfg(), patch || {});
    try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) {}
    return c;
  }

  // ── Small helpers ────────────────────────────────────────────
  function str(v) { return v == null ? '' : String(v); }
  function trim(v) { return str(v).trim(); }

  function hash(s) {                     // djb2 — only needs to spot a changed file
    s = str(s); var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }
  // The `updated:` line changes on every write; ignore it when comparing.
  function stripStamp(md) { return str(md).replace(/^updated:.*$/m, 'updated:'); }

  function slug(title) {
    return trim(title)
      .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '')
      .replace(/[\\/:*?"<>|#^\[\]]/g, ' ')   // characters Obsidian/OSes dislike in filenames
      .replace(/\s+/g, ' ').trim().slice(0, 80) || 'Untitled';
  }

  // Note timestamps are minute-precision so they survive a round trip
  // through the human-readable stamp written into the Markdown.
  function nowStamp() { return new Date(Math.floor(Date.now() / 60000) * 60000).toISOString(); }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtStamp(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
           ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function parseStamp(s) {
    s = trim(s);
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    if (!m) return '';
    var d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }
  // Dates in frontmatter (started/finished) stay as plain ISO strings.
  function fmtDay(iso) { var d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10); }

  // ── Markdown: write ──────────────────────────────────────────
  function yaml(v) {
    var s = str(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ');
    return '"' + s + '"';
  }

  /* A record is the transport-neutral shape of one book:
     { id, title, by, shelf, note, doi, status, progress, started, finished,
       tags: [], notes: [{ at, loc, text }], reflection: { key: text },
       updated }                                                          */
  function buildNote(rec) {
    var out = [];
    out.push('---');
    out.push('ct_id: ' + yaml(rec.id));
    out.push('title: ' + yaml(rec.title));
    out.push('author: ' + yaml(rec.by));
    out.push('shelf: ' + yaml(rec.shelf));
    out.push('status: ' + (rec.status || 'unread'));
    out.push('progress: ' + yaml(rec.progress));
    out.push('pages: ' + (parseInt(rec.pages, 10) > 0 ? parseInt(rec.pages, 10) : ''));
    out.push('started: ' + (rec.started ? fmtDay(rec.started) : ''));
    out.push('finished: ' + (rec.finished ? fmtDay(rec.finished) : ''));
    out.push('tags: [' + (rec.tags || []).map(function (t) { return 'reading/' + t; }).join(', ') + ']');
    if (rec.doi) out.push('doi: ' + yaml(rec.doi));
    out.push('updated: ' + (rec.updated || new Date().toISOString()));
    out.push('source: reading-list');
    out.push('---');
    out.push('');
    out.push('# ' + str(rec.title));
    if (rec.by) out.push('*' + str(rec.by) + '*');
    if (rec.note) { out.push(''); out.push('> ' + str(rec.note).replace(/\n/g, '\n> ')); }
    out.push('');
    out.push('## Notes');
    out.push('');
    var notes = (rec.notes || []).slice().sort(function (a, b) { return str(a.at) < str(b.at) ? -1 : 1; });
    if (!notes.length) {
      out.push('<!-- Add a bullet here and it lands on the site: -->');
      out.push('<!-- - **2026-01-31 09:15 · p. 42** — what you thought -->');
    }
    notes.forEach(function (n) {
      var head = fmtStamp(n.at) || fmtStamp(new Date().toISOString());
      if (trim(n.loc)) head += ' · ' + trim(n.loc);
      var body = str(n.text).split('\n');
      out.push('- **' + head + '** — ' + (body.shift() || ''));
      body.forEach(function (line) { out.push('  ' + line); });
    });
    out.push('');
    out.push('## Reflection');
    out.push('');
    REFLECTION.forEach(function (f) {
      out.push('### ' + f.label);
      out.push('');
      out.push(str((rec.reflection || {})[f.key]));
      out.push('');
    });
    return out.join('\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n') + '\n';
  }

  // ── Markdown: read ───────────────────────────────────────────
  function unyaml(v) {
    v = trim(v);
    if ((v.charAt(0) === '"' && v.slice(-1) === '"') || (v.charAt(0) === "'" && v.slice(-1) === "'")) {
      v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    return v;
  }
  function parseFrontmatter(md) {
    var m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(md);
    if (!m) return { fm: {}, body: md };
    var fm = {};
    m[1].split(/\r?\n/).forEach(function (line) {
      var i = line.indexOf(':');
      if (i < 1 || /^\s/.test(line)) return;
      var k = line.slice(0, i).trim(), v = line.slice(i + 1).trim();
      if (v.charAt(0) === '[' && v.slice(-1) === ']') {
        fm[k] = v.slice(1, -1).split(',').map(unyaml).filter(Boolean);
      } else fm[k] = unyaml(v);
    });
    return { fm: fm, body: md.slice(m[0].length) };
  }

  function section(body, heading) {
    var re = new RegExp('^##\\s+' + heading + '\\s*$', 'im');
    var m = re.exec(body);
    if (!m) return '';
    var rest = body.slice(m.index + m[0].length);
    var next = /^##\s+/m.exec(rest);
    return next ? rest.slice(0, next.index) : rest;
  }

  function parseNotes(text) {
    var notes = [], cur = null;
    str(text).split(/\r?\n/).forEach(function (line) {
      if (/^\s*<!--/.test(line)) return;                       // the hint comment
      var b = /^[-*]\s+(.*)$/.exec(line);
      if (b) {
        if (cur) notes.push(cur);
        var rest = b[1];
        var stamped = /^\*\*([^*]+)\*\*\s*(?:—|-|–|:)?\s*([\s\S]*)$/.exec(rest);
        var at = '', loc = '', txt = rest;
        if (stamped) {
          var head = stamped[1];
          txt = stamped[2];
          var dot = head.indexOf('·');
          if (dot === -1) dot = head.indexOf('|');
          if (dot !== -1) { loc = head.slice(dot + 1).trim(); head = head.slice(0, dot); }
          at = parseStamp(head);
          if (!at) { loc = loc || trim(head); }                // a bold label that isn't a date → treat as the place
        }
        cur = { at: at || nowStamp(), loc: loc, text: trim(txt) };
        return;
      }
      if (cur && /^\s+\S/.test(line)) cur.text += '\n' + line.replace(/^\s{1,2}/, '');
    });
    if (cur) notes.push(cur);
    return notes.filter(function (n) { return trim(n.text) || trim(n.loc); });
  }

  function parseReflection(text) {
    var out = {};
    var parts = str(text).split(/^###\s+/m);
    parts.shift();
    parts.forEach(function (chunk) {
      var nl = chunk.indexOf('\n');
      var label = trim(nl === -1 ? chunk : chunk.slice(0, nl));
      var val = trim(nl === -1 ? '' : chunk.slice(nl + 1));
      var f = REFLECTION.filter(function (x) {
        return x.label.toLowerCase() === label.toLowerCase() || x.key === label.toLowerCase();
      })[0];
      if (f && val) out[f.key] = val;
    });
    return out;
  }

  function parseNote(md, file) {
    var p = parseFrontmatter(md);
    var fm = p.fm, body = p.body;
    var title = trim(fm.title);
    if (!title) {
      var h1 = /^#\s+(.+)$/m.exec(body);
      title = h1 ? trim(h1[1]) : trim(str(file).replace(/\.md$/i, ''));
    }
    var quote = /^>\s?(.*)$/m.exec(body.split(/^##\s+/m)[0] || '');
    return {
      id: trim(fm.ct_id),
      file: file || '',
      title: title,
      by: trim(fm.author),
      shelf: trim(fm.shelf),
      note: quote ? trim(quote[1]) : '',
      doi: trim(fm.doi),
      status: /^(unread|reading|read)$/.test(trim(fm.status)) ? trim(fm.status) : 'unread',
      progress: trim(fm.progress),
      pages: parseInt(fm.pages, 10) > 0 ? String(parseInt(fm.pages, 10)) : '',
      started: fm.started ? parseStamp(fm.started) : '',
      finished: fm.finished ? parseStamp(fm.finished) : '',
      tags: (fm.tags || []).map(function (t) { return trim(t).replace(/^reading\//, '').toLowerCase(); }).filter(Boolean),
      notes: parseNotes(section(body, 'Notes')),
      reflection: parseReflection(section(body, 'Reflection')),
      updated: trim(fm.updated) || ''
    };
  }

  // ── Three-way merge ──────────────────────────────────────────
  function noteKey(n) { return str(n.at) + '|' + trim(n.loc).toLowerCase(); }
  function indexNotes(list) {
    var m = {};
    (list || []).forEach(function (n) {
      var k = noteKey(n), i = 1;
      while (m[k]) { k = noteKey(n) + '#' + (++i); }
      m[k] = n;
    });
    return m;
  }

  /* base = what was last synced (may be null on a first sync),
     local = the site's copy, remote = the vault's copy.
     Either side may be null. Returns the reconciled record.        */
  function merge3(base, local, remote) {
    if (!remote) return local;
    if (!local) return remote;
    var b = base || {};
    var out = {};
    SCALARS.forEach(function (k) {
      var bv = str(b[k]), lv = str(local[k]), rv = str(remote[k]);
      // Whichever side moved away from the last-synced value wins;
      // if both moved, the site is the tie-breaker.
      out[k] = (lv !== bv) ? lv : (rv !== bv ? rv : lv);
    });
    out.id = local.id || remote.id;
    out.file = remote.file || local.file || '';

    // tags — union of both sides, minus any tag that existed at the last
    // sync and was deliberately removed on one of them.
    var bt = (b.tags || []), lt = (local.tags || []), rt = (remote.tags || []);
    var tags = {};
    lt.concat(rt).forEach(function (t) { tags[t] = 1; });
    bt.forEach(function (t) { if (lt.indexOf(t) === -1 || rt.indexOf(t) === -1) delete tags[t]; });
    out.tags = Object.keys(tags).sort();

    // notes — key by timestamp + place, so an edit is an edit and a
    // deletion on either side is honoured.
    var bi = indexNotes(b.notes), li = indexNotes(local.notes), ri = indexNotes(remote.notes);
    var keys = {};
    Object.keys(li).forEach(function (k) { keys[k] = 1; });
    Object.keys(ri).forEach(function (k) { keys[k] = 1; });
    var notes = [];
    Object.keys(keys).forEach(function (k) {
      var inBase = !!bi[k], l = li[k], r = ri[k];
      if (inBase && base) {
        if (!l || !r) return;                                  // deleted on one side → gone
        notes.push(str(l.text) !== str(bi[k].text) ? l : r);   // edited side wins
      } else {
        notes.push(l || r);                                    // new on one side → keep
      }
    });
    out.notes = notes.sort(function (a, c) { return str(a.at) < str(c.at) ? -1 : 1; });

    // reflection — same rule as the scalars, field by field
    out.reflection = {};
    REFLECTION.forEach(function (f) {
      var bv = str((b.reflection || {})[f.key]),
          lv = str((local.reflection || {})[f.key]),
          rv = str((remote.reflection || {})[f.key]);
      var v = (lv !== bv) ? lv : (rv !== bv ? rv : lv);
      if (v) out.reflection[f.key] = v;
    });

    out.updated = new Date().toISOString();
    return out;
  }

  // A record's fingerprint, so we can tell whether the site's copy
  // moved since the last sync without trusting clocks.
  function snapshot(rec) {
    var s = {};
    SCALARS.forEach(function (k) { s[k] = str(rec[k]); });
    s.tags = (rec.tags || []).slice().sort();
    s.notes = (rec.notes || []).map(function (n) { return { at: n.at, loc: n.loc, text: n.text }; });
    s.reflection = Object.assign({}, rec.reflection);
    return s;
  }
  function fingerprint(rec) { return hash(JSON.stringify(snapshot(rec))); }

  // ── Transport 1: the vault folder on disk ────────────────────
  var IDB_DB = 'ct_obsidian', IDB_STORE = 'handles';
  function idb() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('IndexedDB unavailable'));
      var req = indexedDB.open(IDB_DB, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(IDB_STORE); };
      req.onsuccess = function () { res(req.result); };
      req.onerror = function () { rej(req.error); };
    });
  }
  function idbPut(key, val) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(val, key);
        tx.oncomplete = function () { res(true); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function idbGet(key) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction(IDB_STORE, 'readonly');
        var r = tx.objectStore(IDB_STORE).get(key);
        r.onsuccess = function () { res(r.result || null); };
        r.onerror = function () { rej(r.error); };
      });
    });
  }

  function folderSupported() { return typeof window.showDirectoryPicker === 'function'; }

  function pickVault() {
    if (!folderSupported()) return Promise.reject(new Error('This browser cannot open a folder — use Chrome or Edge on a desktop, or the Local REST API.'));
    return window.showDirectoryPicker({ id: 'ct-obsidian-vault', mode: 'readwrite' }).then(function (h) {
      return idbPut('vault', h).then(function () {
        if (!cfg().vaultName) setCfg({ vaultName: h.name });
        return h;
      });
    });
  }
  function savedVault() { return idbGet('vault').catch(function () { return null; }); }
  function forgetVault() { return idbPut('vault', null).then(function () { return true; }); }

  function permission(handle, request) {
    if (!handle) return Promise.resolve('prompt');
    var opts = { mode: 'readwrite' };
    return handle.queryPermission(opts).then(function (p) {
      if (p === 'granted' || !request) return p;
      return handle.requestPermission(opts);
    });
  }

  // The sync folder, and optionally a subfolder of it (plans live in one).
  function segs(sub) {
    return (cfg().folder + (sub ? '/' + sub : '')).split('/').filter(Boolean);
  }

  // Resolve (creating if needed) the sync folder inside the vault.
  function noteDir(request, sub) {
    return savedVault().then(function (vault) {
      if (!vault) throw new Error('No vault folder connected yet.');
      return permission(vault, request).then(function (p) {
        if (p !== 'granted') throw new Error('Permission to the vault folder was not granted.');
        var parts = segs(sub);
        var chain = Promise.resolve(vault);
        parts.forEach(function (part) {
          chain = chain.then(function (dir) { return dir.getDirectoryHandle(part, { create: true }); });
        });
        return chain;
      });
    });
  }

  function folderIO(request, sub) {
    var dirP = noteDir(request, sub);
    return {
      label: 'vault folder',
      list: function () {
        return dirP.then(function (dir) {
          var names = [];
          var it = dir.values();
          function step() {
            return it.next().then(function (r) {
              if (r.done) return names;
              if (r.value.kind === 'file' && /\.md$/i.test(r.value.name)) names.push(r.value.name);
              return step();
            });
          }
          return step();
        });
      },
      read: function (name) {
        return dirP.then(function (dir) { return dir.getFileHandle(name); })
          .then(function (fh) { return fh.getFile(); })
          .then(function (f) { return f.text(); });
      },
      write: function (name, md) {
        return dirP.then(function (dir) { return dir.getFileHandle(name, { create: true }); })
          .then(function (fh) { return fh.createWritable(); })
          .then(function (w) { return w.write(md).then(function () { return w.close(); }); });
      },
      del: function (name) {
        return dirP.then(function (dir) { return dir.removeEntry(name); }).catch(function () {});
      }
    };
  }

  // ── Transport 2: the Local REST API plugin ───────────────────
  function restPath(name, sub) {
    var folder = segs(sub).map(encodeURIComponent).join('/');
    return folder + (name ? '/' + encodeURIComponent(name) : '/');
  }
  function restFetch(path, opts) {
    var c = cfg();
    if (!c.restKey) return Promise.reject(new Error('No API key set for the Local REST API.'));
    opts = opts || {};
    var headers = Object.assign({ Authorization: 'Bearer ' + c.restKey }, opts.headers || {});
    return fetch(c.restUrl.replace(/\/+$/, '') + '/vault/' + path, {
      method: opts.method || 'GET', headers: headers, body: opts.body
    }).then(function (r) {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('Obsidian replied ' + r.status + ' ' + r.statusText);
      return opts.json ? r.json() : r.text();
    });
  }
  function restIO(sub) {
    return {
      label: 'Local REST API',
      list: function () {
        return restFetch(restPath('', sub), { json: true }).then(function (d) {
          return ((d && d.files) || []).filter(function (n) { return /\.md$/i.test(n); });
        }, function () { return []; });   // the subfolder may not exist yet
      },
      read: function (name) { return restFetch(restPath(name, sub)); },
      write: function (name, md) {
        return restFetch(restPath(name, sub), { method: 'PUT', body: md, headers: { 'Content-Type': 'text/markdown' } });
      },
      del: function (name) { return restFetch(restPath(name, sub), { method: 'DELETE' }).catch(function () {}); }
    };
  }
  function restTest() {
    var c = cfg();
    return fetch(c.restUrl.replace(/\/+$/, '') + '/', { headers: { Authorization: 'Bearer ' + c.restKey } })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        if (d && d.versions) return 'Connected to Obsidian ' + (d.versions.obsidian || '') + (d.authenticated === false ? ' — but the API key was rejected' : '');
        if (d && d.status) return String(d.status);
        return 'Reachable';
      });
  }

  function io(request, sub) {
    return cfg().transport === 'rest' ? restIO(sub) : folderIO(request, sub);
  }

  // ── The sync itself ──────────────────────────────────────────
  /*  locals  — records the site holds, one per book
      meta    — { [id]: { file, hash, snap } } from the last sync
      Returns { merged, created, meta, stats }.
        merged  — records to write back into the site's store
        created — records found in the vault with no counterpart here   */
  function sync(locals, meta, opts) {
    opts = opts || {};
    // opts.io lets a caller (or a test) supply its own read/write pair.
    var transport = opts.io || io(opts.request !== false);
    var nextMeta = {};
    var stats = { pushed: 0, pulled: 0, added: 0, unchanged: 0 };

    return transport.list().then(function (names) {
      // Pull every note in the folder, in sequence (kind to both transports).
      var remotes = [];
      var chain = Promise.resolve();
      names.forEach(function (name) {
        chain = chain.then(function () {
          return transport.read(name).then(function (md) {
            if (md == null) return;
            var rec = parseNote(md, name);
            if (trim(md).indexOf('---') !== 0 && !rec.id) return;  // not one of ours
            remotes.push({ rec: rec, md: md, name: name });
          }, function () { /* unreadable file — skip it */ });
        });
      });
      return chain.then(function () { return remotes; });
    }).then(function (remotes) {
      var byId = {}, byTitle = {};
      remotes.forEach(function (r) {
        if (r.rec.id) byId[r.rec.id] = r;
        byTitle[r.rec.title.toLowerCase()] = r;
      });

      var merged = [], created = [], writes = [];

      locals.forEach(function (local) {
        var m = (meta || {})[local.id] || {};
        var hit = byId[local.id] || (m.file ? null : byTitle[str(local.title).toLowerCase()]);
        var remote = hit ? hit.rec : null;
        var remoteChanged = hit ? hash(hit.md) !== m.hash : false;
        var localChanged = !m.snap || fingerprint(local) !== m.snap;

        var out;
        if (!remote) out = local;
        else if (!localChanged && remoteChanged) { out = remote; out.id = local.id; stats.pulled++; }
        else if (localChanged && !remoteChanged) { out = local; }
        else if (!localChanged && !remoteChanged) { out = local; stats.unchanged++; }
        else { out = merge3(m.base || null, local, remote); stats.pulled++; }

        var name = (hit && hit.name) || (slug(out.title) + '.md');
        var md = buildNote(Object.assign({}, out, { updated: new Date().toISOString() }));
        // Ignore the `updated:` stamp when deciding whether anything really
        // moved — otherwise every sync would rewrite every file.
        var same = hit && hash(stripStamp(hit.md)) === hash(stripStamp(md));
        var wanted = opts.includeAll || hasSubstance(out);

        // The note keeps the filename it already has — a book is identified
        // by its ct_id, and renaming the file would break every [[wikilink]]
        // pointing at it. Retitling on the site just rewrites the contents.
        if (!same && wanted) { writes.push({ name: name, md: md }); stats.pushed++; }
        out.file = name;
        nextMeta[out.id] = { file: name, hash: hash(same ? hit.md : md), snap: fingerprint(out), base: snapshot(out) };
        merged.push(out);
        if (hit) { delete byId[local.id]; delete byTitle[str(local.title).toLowerCase()]; }
        if (hit) hit.claimed = true;
      });

      // Notes in the vault that the site has never seen → new books.
      remotes.forEach(function (r) {
        if (r.claimed) return;
        var rec = r.rec;
        if (!rec.title) return;
        if (!rec.id) rec.id = 'usr-' + hash(r.name + rec.title) + Math.floor(Math.random() * 1e4).toString(36);
        rec.file = r.name;
        rec.updated = rec.updated || new Date().toISOString();
        created.push(rec);
        stats.added++;
        // Re-write it so it carries its new ct_id.
        var md = buildNote(rec);
        writes.push({ name: r.name, md: md });
        nextMeta[rec.id] = { file: r.name, hash: hash(md), snap: fingerprint(rec), base: snapshot(rec) };
      });

      // Flush the writes, one at a time.
      var chain = Promise.resolve();
      writes.forEach(function (w) {
        chain = chain.then(function () { return transport.write(w.name, w.md); });
      });
      return chain.then(function () {
        setCfg({ lastSync: new Date().toISOString(), lastError: '' });
        return { merged: merged, created: created, meta: nextMeta, stats: stats };
      });
    }).catch(function (err) {
      setCfg({ lastError: err && err.message ? err.message : String(err) });
      throw err;
    });
  }

  // Worth having a note of its own? (Untouched books stay out of the
  // vault unless you ask for all of them.)
  function hasSubstance(rec) {
    if (rec.status && rec.status !== 'unread') return true;
    if ((rec.notes || []).length) return true;
    if ((rec.tags || []).length) return true;
    if (trim(rec.progress)) return true;
    return REFLECTION.some(function (f) { return trim((rec.reflection || {})[f.key]); });
  }

  /* ─────────── Reading plans ───────────
     A plan is a piece of prose plus an order: read this, then this,
     and here is why. It becomes one note in a Plans subfolder, with
     each step written as a [[wikilink]] to that book's own note, so
     the plan is navigable inside Obsidian and editable there.

     A plan step points at a book by title — that keeps the note
     hand-editable: add a numbered line with a title and the next sync
     adds the step (and the book, if it's new).                        */
  var PLAN_SUB = 'Plans';
  var PLAN_SCALARS = ['title', 'goal', 'why', 'source'];

  function buildPlanNote(plan) {
    var out = [];
    out.push('---');
    out.push('ct_plan_id: ' + yaml(plan.id));
    out.push('title: ' + yaml(plan.title));
    out.push('goal: ' + yaml(plan.goal));
    out.push('created: ' + (plan.created ? fmtDay(plan.created) : fmtDay(new Date().toISOString())));
    if (plan.source) out.push('source_of: ' + yaml(plan.source));
    out.push('updated: ' + (plan.updated || new Date().toISOString()));
    out.push('type: reading-plan');
    out.push('source: reading-list');
    out.push('---');
    out.push('');
    out.push('# ' + str(plan.title));
    if (plan.goal) { out.push(''); out.push('*' + str(plan.goal) + '*'); }
    out.push('');
    out.push('## Why this plan');
    out.push('');
    out.push(str(plan.why));
    out.push('');
    out.push('## The order');
    out.push('');
    (plan.steps || []).forEach(function (s, i) {
      var line = (i + 1) + '. **[[' + str(s.title).replace(/[\[\]|]/g, '') + ']]**';
      if (trim(s.when)) line += ' — ' + trim(s.when);
      out.push(line);
      if (trim(s.why)) {
        str(s.why).split('\n').forEach(function (l) { out.push('   ' + l); });
      }
    });
    if (!(plan.steps || []).length) {
      out.push('<!-- 1. **[[A book title]]** — this week -->');
      out.push('<!--    why it comes first -->');
    }
    return out.join('\n').replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n') + '\n';
  }

  function parseSteps(text) {
    var steps = [], cur = null;
    str(text).split(/\r?\n/).forEach(function (line) {
      if (/^\s*<!--/.test(line)) return;
      var m = /^\s*(?:\d+[.)]|[-*])\s+(.*)$/.exec(line);
      if (m) {
        if (cur) steps.push(cur);
        var rest = m[1], when = '';
        var dash = rest.search(/\s+(?:—|–|--)\s+/);
        if (dash !== -1) { when = rest.slice(dash).replace(/^\s*(?:—|–|--)\s*/, '').trim(); rest = rest.slice(0, dash); }
        var link = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/.exec(rest);
        var title = link ? link[1] : rest.replace(/\*\*/g, '').replace(/^\*|\*$/g, '');
        cur = { title: trim(title), when: when, why: '' };
        return;
      }
      // Continuation lines are prose, whatever they were indented by.
      if (cur && /^\s+\S/.test(line)) cur.why += (cur.why ? '\n' : '') + trim(line);
    });
    if (cur) steps.push(cur);
    return steps.filter(function (s) { return s.title; });
  }

  function parsePlanNote(md, file) {
    var p = parseFrontmatter(md), fm = p.fm, body = p.body;
    var title = trim(fm.title);
    if (!title) {
      var h1 = /^#\s+(.+)$/m.exec(body);
      title = h1 ? trim(h1[1]) : trim(str(file).replace(/\.md$/i, ''));
    }
    return {
      id: trim(fm.ct_plan_id),
      file: file || '',
      title: title,
      goal: trim(fm.goal),
      source: trim(fm.source_of),
      created: fm.created ? parseStamp(fm.created) : '',
      why: trim(section(body, 'Why this plan') || section(body, 'Why')),
      steps: parseSteps(section(body, 'The order') || section(body, 'Order')),
      updated: trim(fm.updated) || ''
    };
  }

  function stepKey(s) { return trim(s.title).toLowerCase(); }

  function mergePlan3(base, local, remote) {
    if (!remote) return local;
    if (!local) return remote;
    var b = base || {}, out = {};
    PLAN_SCALARS.forEach(function (k) {
      var bv = str(b[k]), lv = str(local[k]), rv = str(remote[k]);
      out[k] = (lv !== bv) ? lv : (rv !== bv ? rv : lv);
    });
    out.id = local.id || remote.id;
    out.created = local.created || remote.created;
    out.file = remote.file || local.file || '';

    // Steps, three-way by title: dropped on one side → dropped;
    // edited on one side → that side's wording wins.
    var bi = {}, li = {}, ri = {};
    (b.steps || []).forEach(function (s) { bi[stepKey(s)] = s; });
    (local.steps || []).forEach(function (s) { li[stepKey(s)] = s; });
    (remote.steps || []).forEach(function (s) { ri[stepKey(s)] = s; });

    var remoteMoved = JSON.stringify(remote.steps || []) !== JSON.stringify(b.steps || []);
    var order = (remoteMoved ? (remote.steps || []) : (local.steps || [])).map(stepKey);
    (remoteMoved ? (local.steps || []) : (remote.steps || [])).forEach(function (s) {
      if (order.indexOf(stepKey(s)) === -1) order.push(stepKey(s));
    });

    var steps = [];
    order.forEach(function (k) {
      var l = li[k], r = ri[k], inBase = !!bi[k];
      if (inBase && base) { if (!l || !r) return; }        // removed on a side
      var pick = l || r;
      if (l && r) {
        var same = function (f) { return str(l[f]) === str((bi[k] || {})[f]); };
        pick = { title: (l.title || r.title), when: same('when') ? r.when : l.when,
                 why: same('why') ? r.why : l.why };
      }
      if (pick) steps.push({ title: pick.title, when: str(pick.when), why: str(pick.why) });
    });
    out.steps = steps;
    out.updated = new Date().toISOString();
    return out;
  }

  function planSnapshot(plan) {
    var s = {};
    PLAN_SCALARS.forEach(function (k) { s[k] = str(plan[k]); });
    s.steps = (plan.steps || []).map(function (x) { return { title: x.title, when: str(x.when), why: str(x.why) }; });
    return s;
  }
  function planFingerprint(plan) { return hash(JSON.stringify(planSnapshot(plan))); }

  /*  Same contract as sync(), for plans:
      returns { merged, created, meta, stats, wantBooks }, where
      wantBooks lists step titles the site has no book for yet.        */
  function syncPlans(locals, meta, opts) {
    opts = opts || {};
    var transport = opts.io || io(opts.request !== false, PLAN_SUB);
    var nextMeta = {};
    var stats = { pushed: 0, pulled: 0, added: 0, removed: 0 };

    return transport.list().then(function (names) {
      var remotes = [], chain = Promise.resolve();
      names.forEach(function (name) {
        chain = chain.then(function () {
          return transport.read(name).then(function (md) {
            if (md == null || trim(md).indexOf('---') !== 0) return;
            remotes.push({ plan: parsePlanNote(md, name), md: md, name: name });
          }, function () {});
        });
      });
      return chain.then(function () { return remotes; });
    }).then(function (remotes) {
      var byId = {}, byTitle = {};
      remotes.forEach(function (r) {
        if (r.plan.id) byId[r.plan.id] = r;
        byTitle[r.plan.title.toLowerCase()] = r;
      });

      var merged = [], created = [], writes = [], deletes = [];

      locals.forEach(function (local) {
        var m = (meta || {})[local.id] || {};
        var hit = byId[local.id] || (m.file ? null : byTitle[str(local.title).toLowerCase()]);
        var remote = hit ? hit.plan : null;
        var remoteChanged = hit ? hash(hit.md) !== m.hash : false;
        var localChanged = !m.snap || planFingerprint(local) !== m.snap;

        var out;
        if (!remote) out = local;
        else if (!localChanged && remoteChanged) { out = remote; out.id = local.id; stats.pulled++; }
        else if (localChanged && !remoteChanged) out = local;
        else if (!localChanged && !remoteChanged) out = local;
        else { out = mergePlan3(m.base || null, local, remote); stats.pulled++; }

        var name = (hit && hit.name) || (slug(out.title) + '.md');
        var md = buildPlanNote(Object.assign({}, out, { updated: new Date().toISOString() }));
        var same = hit && hash(stripStamp(hit.md)) === hash(stripStamp(md));
        if (!same) { writes.push({ name: name, md: md }); stats.pushed++; }
        out.file = name;
        nextMeta[out.id] = { file: name, hash: hash(same ? hit.md : md), snap: planFingerprint(out), base: planSnapshot(out) };
        merged.push(out);
        if (hit) hit.claimed = true;
      });

      remotes.forEach(function (r) {
        if (r.claimed || !r.plan.title) return;
        // Synced before but gone from the site → deleted here, so delete there.
        var known = r.plan.id && (meta || {})[r.plan.id];
        if (known) { deletes.push(r.name); stats.removed++; return; }
        var plan = r.plan;
        if (!plan.id) plan.id = 'pl-' + hash(r.name + plan.title) + Math.floor(Math.random() * 1e4).toString(36);
        plan.created = plan.created || new Date().toISOString();
        plan.updated = plan.updated || new Date().toISOString();
        created.push(plan);
        stats.added++;
        var md = buildPlanNote(plan);
        writes.push({ name: r.name, md: md });
        nextMeta[plan.id] = { file: r.name, hash: hash(md), snap: planFingerprint(plan), base: planSnapshot(plan) };
      });

      var wantBooks = [];
      merged.concat(created).forEach(function (p) {
        (p.steps || []).forEach(function (s) { if (wantBooks.indexOf(s.title) === -1) wantBooks.push(s.title); });
      });

      var chain = Promise.resolve();
      writes.forEach(function (w) {
        chain = chain.then(function () { return transport.write(w.name, w.md); });
      });
      deletes.forEach(function (n) { chain = chain.then(function () { return transport.del(n); }); });
      return chain.then(function () {
        return { merged: merged, created: created, meta: nextMeta, stats: stats, wantBooks: wantBooks };
      });
    });
  }

  // ── obsidian:// links ────────────────────────────────────────
  function uriFor(rec, sub) {
    var c = cfg();
    var file = rec.file || (slug(rec.title) + '.md');
    var path = segs(sub).join('/') + '/' + file.replace(/\.md$/i, '');
    if (c.vaultName) return 'obsidian://open?vault=' + encodeURIComponent(c.vaultName) + '&file=' + encodeURIComponent(path);
    return 'obsidian://open?file=' + encodeURIComponent(path);
  }

  window.ObsidianBridge = {
    REFLECTION: REFLECTION,
    cfg: cfg, setCfg: setCfg,
    buildNote: buildNote, parseNote: parseNote,
    merge3: merge3, snapshot: snapshot, fingerprint: fingerprint, hasSubstance: hasSubstance,
    slug: slug, nowStamp: nowStamp, fmtStamp: fmtStamp, parseStamp: parseStamp, hash: hash,
    folderSupported: folderSupported, pickVault: pickVault, savedVault: savedVault,
    forgetVault: forgetVault, permission: permission,
    restTest: restTest,
    sync: sync, uriFor: uriFor,
    PLAN_SUB: PLAN_SUB,
    buildPlanNote: buildPlanNote, parsePlanNote: parsePlanNote, mergePlan3: mergePlan3,
    planFingerprint: planFingerprint, syncPlans: syncPlans,
    planUriFor: function (plan) { return uriFor(plan, PLAN_SUB); }
  };
})();
