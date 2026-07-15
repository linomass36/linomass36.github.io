/* ─────────────────────────────────────────────────────────────
   nav.js — bookmark sidebar for every hub page.

   Injected into each hub page by the deploy Action (alongside
   sync.js), so the raw exports are never hand-edited. Self-contained:
   builds its own styles + DOM, no framework.

   What it gives you:
     • A floating button (top-right) that opens a slide-in drawer.
     • Every hub page listed, with the current page highlighted.
     • A "Bookmarks" section you can add your own links to. They live
       in localStorage ('hub_bookmarks_v1'), so sync.js carries them
       across your devices just like everything else.
   ───────────────────────────────────────────────────────────── */
(function () {
  if (window.__hbNavLoaded) return;         // never double-mount
  window.__hbNavLoaded = true;

  var VERSION = (window.APP_CONFIG && window.APP_CONFIG.version) || '';

  // Every hub page, in reading order. Filenames must match the deploy.
  var PAGES = [
    ['Hub.dc.html', 'Mission Control'],
    ['CT Master Plan.html', 'CT Master Plan'],
    ['Summer Sprint.dc.html', 'Summer Sprint'],
    ['Plan Analysis.dc.html', 'Plan Analysis'],
    ['Study Engine.dc.html', 'Study Engine'],
    ['Reading List.dc.html', 'Reading List'],
    ['Library.dc.html', 'Library'],
    ['Journal.dc.html', 'Journal'],
    ['Life Log.dc.html', 'Life Log'],
    ['Weekly Review.dc.html', 'Weekly Review'],
    ['Review Room.dc.html', 'Review Room'],
    ['Timeline.dc.html', 'Timeline'],
    ['Network Map.dc.html', 'Network Map'],
    ['Conference Radar.dc.html', 'Conference Radar'],
    ['Dossiers.dc.html', 'Dossiers'],
    ['Examiner.dc.html', 'Examiner'],
    ['Vault.dc.html', 'Vault'],
    ['Canvas.dc.html', 'Canvas']
  ];

  var BM_KEY = 'hub_bookmarks_v1';

  function currentFile() {
    try { return decodeURIComponent((location.pathname.split('/').pop() || '')); }
    catch (e) { return location.pathname.split('/').pop() || ''; }
  }
  function readBookmarks() {
    try { var a = JSON.parse(localStorage.getItem(BM_KEY)); if (Array.isArray(a)) return a; }
    catch (e) {}
    return [];
  }
  function writeBookmarks(list) {
    try { localStorage.setItem(BM_KEY, JSON.stringify(list)); } catch (e) {}
  }

  var THEME_KEY = 'hub_theme_v1';
  function isDark() {
    try { return localStorage.getItem(THEME_KEY) === 'dark'; } catch (e) { return false; }
  }
  function applyTheme(dark) {
    document.documentElement.classList.toggle('hb-dark', !!dark);
    try { localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light'); } catch (e) {}
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function normUrl(u) {
    u = String(u || '').trim();
    if (!u) return '';
    if (!/^(https?:)?\/\//i.test(u) && !/^[\w.\- ]+\.(dc\.)?html$/i.test(u)) u = 'https://' + u;
    return u;
  }

  var CSS =
    '#hbnav-btn{position:fixed;right:calc(12px + env(safe-area-inset-right,0px));' +
    'top:calc(12px + env(safe-area-inset-top,0px));z-index:2147483200;' +
    'width:44px;height:44px;border-radius:50%;border:1px solid #E4E2DD;cursor:pointer;' +
    'background:#993C1D;color:#fff;font-size:18px;line-height:1;display:flex;' +
    'align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(26,27,26,.22);' +
    '-webkit-tap-highlight-color:transparent;touch-action:manipulation;}' +
    '#hbnav-btn:hover{background:#7f3016;}' +
    '#hbnav-back{position:fixed;inset:0;z-index:2147483210;background:rgba(20,20,22,.42);' +
    'opacity:0;visibility:hidden;transition:opacity .22s ease;}' +
    '#hbnav-panel{position:fixed;top:0;right:0;bottom:0;z-index:2147483220;width:82%;max-width:288px;' +
    'background:#F7F5F1;border-left:1px solid #E4E2DD;box-shadow:-6px 0 28px rgba(26,27,26,.18);' +
    'transform:translateX(100%);transition:transform .24s cubic-bezier(.4,0,.2,1);' +
    'display:flex;flex-direction:column;font-family:"IBM Plex Sans",system-ui,sans-serif;' +
    'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);}' +
    '#hbnav.open #hbnav-panel{transform:none;}' +
    '#hbnav.open #hbnav-back{opacity:1;visibility:visible;}' +
    '.hbnav-hd{display:flex;align-items:baseline;justify-content:space-between;gap:8px;' +
    'padding:18px 18px 12px;border-bottom:1px solid #E4E2DD;}' +
    '.hbnav-hd b{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.18em;' +
    'text-transform:uppercase;color:#993C1D;font-weight:600;}' +
    '.hbnav-hd span{font-family:"IBM Plex Mono",monospace;font-size:10px;color:#A6A79F;}' +
    '.hbnav-scroll{overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;padding:8px 10px 18px;}' +
    '.hbnav-sec{font-family:"IBM Plex Mono",monospace;font-size:9px;letter-spacing:.14em;' +
    'text-transform:uppercase;color:#A6A79F;padding:14px 8px 6px;}' +
    '.hbnav-lnk{display:block;text-decoration:none;color:#26271F;font-size:14px;padding:9px 10px;' +
    'border-radius:9px;border:1px solid transparent;line-height:1.2;}' +
    '.hbnav-lnk:hover{background:#EFEDE7;}' +
    '.hbnav-lnk.on{background:#fff;border-color:#E4E2DD;border-left:3px solid #993C1D;' +
    'color:#993C1D;font-weight:600;}' +
    '.hbnav-bm{display:flex;align-items:center;gap:6px;}' +
    '.hbnav-bm .hbnav-lnk{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    '.hbnav-x{flex:none;border:none;background:none;color:#B9B8B0;cursor:pointer;font-size:15px;' +
    'padding:4px 8px;border-radius:8px;-webkit-tap-highlight-color:transparent;}' +
    '.hbnav-x:hover{color:#A32E27;background:#F5E9E7;}' +
    '.hbnav-add{margin:8px 8px 0;width:calc(100% - 16px);font-family:"IBM Plex Mono",monospace;' +
    'font-size:11px;color:#3B6D11;background:#F1F7E9;border:1px dashed #C9DDB0;border-radius:9px;' +
    'padding:9px;cursor:pointer;-webkit-tap-highlight-color:transparent;}' +
    '.hbnav-add:hover{background:#e8f2dc;}' +
    '.hbnav-toggle{display:flex;align-items:center;justify-content:space-between;gap:8px;' +
    'margin:2px 8px 6px;padding:9px 10px;border:1px solid #E4E2DD;border-radius:9px;' +
    'background:#fff;cursor:pointer;font-size:13px;color:#26271F;width:calc(100% - 16px);' +
    '-webkit-tap-highlight-color:transparent;touch-action:manipulation;}' +
    '.hbnav-toggle:hover{background:#EFEDE7;}' +
    '.hbnav-sw{flex:none;width:34px;height:20px;border-radius:20px;background:#D8D5CE;position:relative;transition:background .18s;}' +
    '.hbnav-sw::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .18s;}' +
    '.hbnav-toggle.on .hbnav-sw{background:#3B6D11;}' +
    '.hbnav-toggle.on .hbnav-sw::after{transform:translateX(14px);}' +
    '@media (max-width:640px){#hbnav-panel{width:86%;}}';

  function build() {
    if (document.getElementById('hbnav')) return;

    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var here = currentFile();

    var root = document.createElement('div');
    root.id = 'hbnav';

    var btn = document.createElement('button');
    btn.id = 'hbnav-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open bookmarks');
    btn.innerHTML = '&#9776;';

    var back = document.createElement('div');
    back.id = 'hbnav-back';

    var panel = document.createElement('div');
    panel.id = 'hbnav-panel';

    root.appendChild(back);
    root.appendChild(panel);

    function render() {
      var pageLinks = PAGES.map(function (p) {
        var on = p[0] === here ? ' on' : '';
        return '<a class="hbnav-lnk' + on + '" href="' + esc(p[0]) + '">' + esc(p[1]) + '</a>';
      }).join('');

      var bms = readBookmarks();
      var bmLinks = bms.map(function (b, i) {
        var ext = /^https?:/i.test(b.url);
        var attrs = ext ? ' target="_blank" rel="noopener"' : '';
        return '<div class="hbnav-bm">' +
          '<a class="hbnav-lnk" href="' + esc(b.url) + '"' + attrs + '>' + esc(b.label || b.url) + '</a>' +
          '<button class="hbnav-x" data-rm="' + i + '" aria-label="Remove bookmark">&times;</button>' +
          '</div>';
      }).join('');
      if (!bms.length) bmLinks = '<div style="padding:6px 10px;font-size:12px;color:#A6A79F;font-style:italic;">No bookmarks yet.</div>';

      panel.innerHTML =
        '<div class="hbnav-hd"><b>Bookmarks</b><span>' + (VERSION ? 'v' + esc(VERSION) : '') + '</span></div>' +
        '<div class="hbnav-scroll">' +
          '<button class="hbnav-toggle' + (isDark() ? ' on' : '') + '" id="hbnav-theme">' +
            '<span>Dark mode</span><span class="hbnav-sw"></span></button>' +
          '<div class="hbnav-sec">Pages</div>' + pageLinks +
          '<div class="hbnav-sec">Saved</div>' + bmLinks +
          '<button class="hbnav-add" id="hbnav-add">+ Add bookmark</button>' +
        '</div>';

      panel.querySelector('#hbnav-theme').addEventListener('click', function () {
        applyTheme(!isDark());
        render();
      });
      panel.querySelector('#hbnav-add').addEventListener('click', function () {
        var url = normUrl(window.prompt('Bookmark URL (or a page like Vault.dc.html)?'));
        if (!url) return;
        var label = (window.prompt('Label?') || url).trim();
        var list = readBookmarks();
        list.push({ label: label, url: url });
        writeBookmarks(list);
        render();
      });
      Array.prototype.forEach.call(panel.querySelectorAll('.hbnav-x'), function (x) {
        x.addEventListener('click', function () {
          var i = +x.getAttribute('data-rm');
          var list = readBookmarks();
          list.splice(i, 1);
          writeBookmarks(list);
          render();
        });
      });
    }

    function open() { root.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    function close() { root.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }

    btn.addEventListener('click', function () {
      root.classList.contains('open') ? close() : open();
    });
    back.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

    // Edge-swipe: drag in from the right edge to open; swipe right to close.
    var sx = 0, sy = 0, tracking = false;
    document.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { tracking = false; return; }
      var t = e.touches[0];
      sx = t.clientX; sy = t.clientY;
      var open_ = root.classList.contains('open');
      // start only from the right edge (to open) or anywhere while open (to close)
      tracking = open_ || sx >= window.innerWidth - 28;
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      var t = (e.changedTouches && e.changedTouches[0]) || null;
      if (!t) return;
      var dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) < 45 || Math.abs(dy) > Math.abs(dx)) return; // mostly-horizontal only
      if (dx < 0 && !root.classList.contains('open')) open();      // swipe left → open
      else if (dx > 0 && root.classList.contains('open')) close(); // swipe right → close
    }, { passive: true });

    render();
    document.body.appendChild(btn);
    document.body.appendChild(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
