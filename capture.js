/* ─────────────────────────────────────────────────────────────────────────
   capture.js — one input, five destinations.

   The store you could write to depended on the page you happened to be
   standing on: a thought went to the Journal, a paper to the Reading List, a
   person to the Dossiers, a conference to the Hub's desk. Every one of those
   stores already existed, every shape was already defined, and the ids were
   already there. What was missing was the text field.

   This is the text field. It is injected on every hub page alongside the
   drawer, opens with ⌘K / Ctrl-K or the ⌕ button, and routes on a prefix:

     @Name  said something worth keeping   → that person's dossier
     #Title, Author                        → the reading list, as a paper
     14 Oct  ACC Boston                    → the conference desk
     +Ship the abstract                    → this week's priorities
     anything else                         → the journal

   Everything it writes goes through localStorage.setItem, which sync.js has
   patched, so a line captured on a phone is on the laptop before you have put
   the phone down. Nothing here invents a store or a shape.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.__hbCaptureLoaded) return;
  window.__hbCaptureLoaded = true;

  var K_JOURNAL = 'ct_journal_v1',
      K_BOOKS   = 'ct_reading_books_v1',
      K_DOSSIER = 'ct_dossier_v1',
      K_NODES   = 'nm_nodes_v2',
      K_CONFS   = 'hub_confs_v1',
      K_WEEKLY  = 'ct_weekly_v1';

  function readJSON(k, fb) {
    try { var raw = localStorage.getItem(k); if (raw) { var v = JSON.parse(raw); if (v != null) return v; } }
    catch (e) {}
    return fb;
  }
  function writeJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  function isoDay(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }
  function monday() {
    var x = new Date();
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    x.setHours(0, 0, 0, 0);
    return isoDay(x);
  }
  function uid(p) { return p + Date.now() + Math.floor(Math.random() * 999); }

  /* ── the date parser ────────────────────────────────────────────────────
     Deliberately narrow. It recognises the three ways you would actually
     write a conference date and nothing else, because a parser that guesses
     is worse than one that hands the line to the journal: a wrong guess
     files something where you will never look for it. */
  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function parseDate(text) {
    var t = String(text).trim();
    var m;

    // 2026-10-14 …
    m = t.match(/^(\d{4})-(\d{2})-(\d{2})\s*(.*)$/);
    if (m) return { y: +m[1], mo: +m[2] - 1, d: +m[3], rest: m[4] };

    // 14 Oct 2026 …  /  14 Oct …
    m = t.match(/^(\d{1,2})\s+([a-z]{3,9})\.?\s*(\d{4})?\s+(.*)$/i);
    if (m) {
      var mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
      if (mi >= 0) return { y: m[3] ? +m[3] : guessYear(mi, +m[1]), mo: mi, d: +m[1], rest: m[4] };
    }

    // Oct 14 2026 …  /  Oct 14 …
    m = t.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:,)?\s*(\d{4})?\s+(.*)$/i);
    if (m) {
      var mj = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
      if (mj >= 0) return { y: m[3] ? +m[3] : guessYear(mj, +m[2]), mo: mj, d: +m[2], rest: m[4] };
    }
    return null;
  }

  // A bare month and day means the next one of those, not one in the past.
  function guessYear(mo, d) {
    var now = new Date(), y = now.getFullYear();
    var cand = new Date(y, mo, d);
    if (cand < new Date(now.getFullYear(), now.getMonth(), now.getDate())) y += 1;
    return y;
  }

  function acronymFor(name) {
    var words = String(name).trim().split(/\s+/).filter(function (w) { return /^[A-Za-z]/.test(w); });
    if (words.length >= 2) return words.map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 5);
    return String(name).trim().slice(0, 4).toUpperCase();
  }

  /* ── the routes ─────────────────────────────────────────────────────────
     Each returns what to say back, or null when it declines and the line
     should fall through to the journal. */

  function toDossier(line) {
    var m = String(line).match(/^@\s*([^:,\n]+?)\s*(?::|,|\s{2,}|\s-\s)\s*(.+)$/);
    var name, note;
    if (m) { name = m[1].trim(); note = m[2].trim(); }
    else {
      var w = String(line).slice(1).trim().split(/\s+/);
      if (w.length < 2) return null;                 // just a name is not a note
      name = w.shift(); note = w.join(' ');
      // a two-word name followed by a note: "@Anna Kowalska said yes"
      if (w.length > 1 && /^[A-Z]/.test(w[0])) { name += ' ' + w.shift(); note = w.join(' '); }
    }
    if (!name || !note) return null;

    // Match an existing contact so the note lands on their file rather than
    // opening a second one under a slightly different spelling.
    var nodes = readJSON(K_NODES, []);
    var key = name;
    if (Array.isArray(nodes)) {
      var hit = nodes.filter(function (n) {
        return n && String(n.name || '').toLowerCase().indexOf(name.toLowerCase()) === 0;
      })[0];
      if (hit) { key = String(hit.id || hit.name); name = hit.name || name; }
    }

    var d = readJSON(K_DOSSIER, {});
    if (typeof d !== 'object' || !d) d = {};
    if (!d[key]) d[key] = { next: '', log: [] };
    if (!Array.isArray(d[key].log)) d[key].log = [];
    d[key].log.push({ ts: Date.now(), kind: 'note', note: note });
    writeJSON(K_DOSSIER, d);
    return { where: 'the file on ' + name, href: 'Dossiers.dc.html?person=' + encodeURIComponent(key) };
  }

  function toReading(line) {
    var rest = String(line).slice(1).trim();
    if (!rest) return null;
    var parts = rest.split(/\s*[,|·]\s*/);
    var title = parts.shift().trim();
    if (!title) return null;
    var by = parts.join(', ').trim();

    var books = readJSON(K_BOOKS, []);
    if (!Array.isArray(books)) books = [];
    books.push({ id: uid('cap-'), title: title, by: by, note: '', kind: 'paper', url: '', tags: [] });
    writeJSON(K_BOOKS, books);
    return { where: 'the reading list', href: 'Reading List.dc.html' };
  }

  function toConference(parsed) {
    var name = String(parsed.rest || '').trim();
    if (!name) return null;
    var list = readJSON(K_CONFS, []);
    if (!Array.isArray(list)) list = [];
    list.push({
      id: uid('cap-'), acronym: acronymFor(name), name: name, city: '', rel: 'ctcore',
      start: [parsed.y, parsed.mo, parsed.d], end: [parsed.y, parsed.mo, parsed.d],
      cost: '', deadline: '', logged: true,
    });
    writeJSON(K_CONFS, list);
    return { where: 'the conference desk', href: 'Conference Radar.dc.html' };
  }

  function toPriority(line) {
    var text = String(line).slice(1).trim();
    if (!text) return null;
    var w = readJSON(K_WEEKLY, {});
    if (typeof w !== 'object' || !w) w = {};
    if (!w.priorities || typeof w.priorities !== 'object') w.priorities = {};
    var wk = monday();
    var list = Array.isArray(w.priorities[wk]) ? w.priorities[wk].slice() : [];
    list.push(text);
    w.priorities[wk] = list;
    writeJSON(K_WEEKLY, w);
    return { where: 'this week’s priorities', href: 'Weekly Review.dc.html' };
  }

  function toJournal(line) {
    var body = String(line).trim();
    if (!body) return null;
    var list = readJSON(K_JOURNAL, []);
    if (!Array.isArray(list)) list = [];
    var now = Date.now();
    list.push({ id: uid('j'), type: 'daily', date: isoDay(), title: '', body: body,
                tags: [], created: now, updated: now });
    writeJSON(K_JOURNAL, list);
    return { where: 'the journal', href: 'Journal.dc.html' };
  }

  /* One line in, one destination out. Anything a route declines falls through
     to the journal, which is the right default: a thought you cannot file is
     still a thought worth keeping. */
  function route(line) {
    var t = String(line || '').trim();
    if (!t) return null;
    var r = null;
    if (t[0] === '@') r = toDossier(t);
    else if (t[0] === '#') r = toReading(t);
    else if (t[0] === '+') r = toPriority(t);
    else {
      var d = parseDate(t);
      if (d) r = toConference(d);
    }
    return r || toJournal(t);
  }

  // ── the field ──────────────────────────────────────────────────────────
  var CSS =
    '#hbcap-btn{position:fixed;right:calc(12px + env(safe-area-inset-right,0px));' +
    'top:calc(64px + env(safe-area-inset-top,0px));z-index:2147483190;width:44px;height:44px;' +
    'border-radius:50%;border:1px solid #E4E2DD;cursor:pointer;background:#FFFDF8;color:#3B6D11;' +
    'font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center;' +
    'box-shadow:0 4px 14px rgba(26,27,26,.16);-webkit-tap-highlight-color:transparent;' +
    'touch-action:manipulation;font-family:system-ui,sans-serif;}' +
    '#hbcap-btn:hover{background:#F1F7E9;border-color:#3B6D11;}' +
    '#hbcap-back{position:fixed;inset:0;z-index:2147483240;background:rgba(20,20,22,.38);' +
    'display:none;align-items:flex-start;justify-content:center;padding:14vh 16px 16px;}' +
    '#hbcap-back.open{display:flex;}' +
    '#hbcap-box{width:100%;max-width:540px;background:#FFFDF8;border:1px solid #E4E2DD;' +
    'border-radius:16px;box-shadow:0 18px 48px rgba(26,27,26,.3);overflow:hidden;' +
    'font-family:"IBM Plex Sans",system-ui,sans-serif;}' +
    '#hbcap-in{width:100%;border:none;outline:none;background:transparent;color:#1A1B1A;' +
    'font-size:17px;line-height:1.5;padding:18px 18px 12px;font-family:inherit;}' +
    '#hbcap-hint{padding:0 18px 14px;font-family:"IBM Plex Mono",monospace;font-size:11px;' +
    'color:#8f9088;line-height:1.7;}' +
    '#hbcap-hint b{color:#3B6D11;font-weight:600;}' +
    '#hbcap-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;' +
    'padding:11px 18px;background:#F7F5F0;border-top:1px solid #EFEDE7;' +
    'font-family:"IBM Plex Mono",monospace;font-size:11px;color:#8f9088;}' +
    '#hbcap-save{min-height:38px;padding:0 16px;border-radius:9px;border:none;background:#3B6D11;' +
    'color:#fff;font-family:inherit;font-size:12px;cursor:pointer;}' +
    '#hbcap-save:disabled{background:#CFCABD;cursor:default;}' +
    '#hbcap-toast{position:fixed;left:50%;bottom:calc(80px + env(safe-area-inset-bottom,0px));' +
    'transform:translateX(-50%);z-index:2147483250;max-width:92vw;background:#3B6D11;color:#FFFDF8;' +
    'font-family:"IBM Plex Mono",monospace;font-size:12.5px;padding:11px 18px;border-radius:22px;' +
    'box-shadow:0 8px 26px rgba(26,27,26,.28);display:none;align-items:center;gap:12px;}' +
    '#hbcap-toast.on{display:flex;}' +
    '#hbcap-toast a{color:#DCEBC8;text-decoration:underline;}' +
    '@media (max-width:640px){#hbcap-btn{top:auto;bottom:calc(74px + env(safe-area-inset-bottom,0px));}}';

  var back, input, hint, save, toast, toastTimer;

  function hintFor(v) {
    var t = String(v || '');
    if (!t.trim()) return 'Type <b>@</b> a person, <b>#</b> a paper, a <b>date</b> for a conference, <b>+</b> a priority — anything else becomes a journal entry.';
    if (t[0] === '@') return '→ <b>that person’s file</b> · @Name, what they said';
    if (t[0] === '#') return '→ <b>the reading list</b> · #Title, Author';
    if (t[0] === '+') return '→ <b>this week’s priorities</b>';
    if (parseDate(t)) return '→ <b>the conference desk</b>';
    return '→ <b>the journal</b>';
  }

  function build() {
    var st = document.createElement('style'); st.textContent = CSS;
    document.head.appendChild(st);

    var btn = document.createElement('button');
    btn.id = 'hbcap-btn'; btn.type = 'button';
    btn.setAttribute('aria-label', 'Capture a line'); btn.title = 'Capture (⌘K)';
    btn.textContent = '✎';
    btn.addEventListener('click', open);
    document.body.appendChild(btn);

    back = document.createElement('div');
    back.id = 'hbcap-back';
    back.innerHTML =
      '<div id="hbcap-box" role="dialog" aria-label="Capture a line">' +
        '<input id="hbcap-in" autocomplete="off" placeholder="A line — it will find its own way…">' +
        '<div id="hbcap-hint"></div>' +
        '<div id="hbcap-foot"><span>enter to file · esc to close</span>' +
        '<button id="hbcap-save" type="button">File it</button></div>' +
      '</div>';
    document.body.appendChild(back);

    toast = document.createElement('div');
    toast.id = 'hbcap-toast';
    document.body.appendChild(toast);

    input = document.getElementById('hbcap-in');
    hint  = document.getElementById('hbcap-hint');
    save  = document.getElementById('hbcap-save');

    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    input.addEventListener('input', paint);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    save.addEventListener('click', commit);
    paint();
  }

  function paint() {
    var v = input.value;
    hint.innerHTML = hintFor(v);
    save.disabled = !String(v).trim();
  }

  function open() {
    back.classList.add('open');
    input.value = ''; paint();
    setTimeout(function () { input.focus(); }, 30);
  }
  function close() { back.classList.remove('open'); }

  function commit() {
    var v = input.value;
    if (!String(v).trim()) return;
    var r = route(v);
    close();
    if (!r) return;
    toast.innerHTML = '';
    var span = document.createElement('span');
    span.textContent = '✓ filed in ' + r.where;
    toast.appendChild(span);
    if (r.href) {
      var a = document.createElement('a');
      a.href = r.href; a.textContent = 'open';
      toast.appendChild(a);
    }
    toast.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('on'); }, 4200);
  }

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k') {
      // The Hub binds ⌘K to its own search; capture stays out of its way.
      if (document.getElementById('hb-search-open')) return;
      e.preventDefault(); open();
    }
  });

  // exposed so the tests — and the console — can drive it without the UI
  window.hubCapture = { route: route, parseDate: parseDate, open: open, close: close };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
