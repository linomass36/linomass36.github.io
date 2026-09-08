/* ─────────────────────────────────────────────────────────────────────────
   tour.js — the first-run tour, and the one the Guide replays.

   WHY IT IS A SEQUENCE OF CARDS and not coach-marks pinned to elements: this
   hub is thirty-odd pages that were written independently, and an overlay
   that points at "the third tile" breaks the first time a tile moves. Cards
   explain the IDEAS — ten places, panels, the drawer, what red means, the
   backup — and every idea survives a layout change.

   IT RUNS ONCE, on the front door only. Popping a tour over a page someone
   opened to do something is how a tour gets dismissed unread; the front door
   is the one page where "what is this" is the question being asked. After
   that it is on demand, from the Guide.

   The steps are built from sitemap.js where they can be, so the tour cannot
   describe a structure the hub no longer has.

   Escape closes it, the backdrop closes it, focus moves to the card and
   returns on close, and it never runs twice in a session.
   ───────────────────────────────────────────────────────────────────────── */
(function (w, d) {
  'use strict';
  if (w.__hbTour) return;

  var KEY = 'hub_tour_v1';
  var HOME = 'Standing.html';

  function seen() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return true; }
  }
  function markSeen() {
    try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now() })); } catch (e) {}
  }
  function SM() { return w.SITEMAP || null; }

  /* The places, in the sitemap's own order, so this list cannot go stale. */
  function places() {
    var m = SM();
    if (!m || !m.destinations) return [];
    try {
      var mode = m.naming ? m.naming() : 'named';
      return m.destinations().map(function (x) {
        return { name: mode === 'plain' ? x.plain : x.name, blurb: x.blurb, lands: x.lands };
      });
    } catch (e) { return []; }
  }

  function steps() {
    var P = places();
    var list = P.length
      ? '<ul class="hbt-list">' + P.map(function (p) {
          return '<li><b>' + esc(p.name) + '</b><span>' + esc(p.blurb || '') + '</span></li>';
        }).join('') + '</ul>'
      : '';

    return [
      { t: 'This is your hub',
        b: '<p>Everything you track lives here — the plan, the body, what you are reading, ' +
           'the money, the people, the week just gone.</p><p>It used to be thirty-one separate ' +
           'pages. It is <b>ten places</b> now. This takes about a minute.</p>' },

      { t: 'Ten places', b: '<p>Every page belongs to one of these.</p>' + list },

      { t: 'Tabs, not pages',
        b: '<p>A place can hold several panels, and they sit in a row of tabs across the top. ' +
           'The Plan holds five; the Body holds six.</p>' +
           '<p>Some of those panels are one file and some are still separate pages — you cannot ' +
           'tell from using it, and you should not have to.</p>' },

      { t: 'Red means one thing',
        b: '<p>Arterial red means <b>owed</b> — something wants you today — and it means nothing ' +
           'else on this site. Links are the blue-grey.</p>' +
           '<p>The old version used one colour for both, which is why a board of thirteen tiles ' +
           'read as an emergency in which nothing could be prioritised.</p>' },

      { t: 'The drawer knows everything',
        b: '<p>The button in the top-right corner opens every place, each with a line saying what ' +
           'it is for.</p><p>There is a <b>Plain names</b> switch in there too. The pages have ' +
           'written names — the Standing, the Examiner, Recalibrate — and that switch swaps them ' +
           'for plain ones and keeps the written name underneath.</p>' },

      { t: 'Back it up',
        b: '<p><b>Settings → Backup</b> writes every store in this browser to one file, and reads ' +
           'one back.</p><p>It reads what is actually there rather than a list someone has to ' +
           'remember to update — the old backup kept a list, and it was missing more than half ' +
           'your data. Your passphrase and calendar token are deliberately left out.</p>' },

      { t: 'That is the whole tour',
        b: '<p>The <b>Guide</b> has all of this in writing, plus what each place holds, and a ' +
           'button to run this again.</p><p>It is in the drawer, under Settings.</p>' }
    ];
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function css() {
    if (d.getElementById('hbt-css')) return;
    var s = d.createElement('style');
    s.id = 'hbt-css';
    s.textContent =
      '#hbt-back{position:fixed;inset:0;z-index:2147483000;background:rgba(36,27,16,.55);' +
      '-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);display:flex;' +
      'align-items:center;justify-content:center;padding:18px;}' +
      '#hbt-card{background:var(--surface,#F8F2E2);color:var(--ink,#241B10);' +
      'border:1px solid var(--line-2,#C6B48B);border-radius:var(--r3,5px);' +
      'box-shadow:0 24px 60px rgba(0,0,0,.35);max-width:520px;width:100%;' +
      'max-height:86vh;overflow:auto;padding:26px 26px 20px;' +
      'font-family:var(--serif,Georgia,serif);}' +
      '#hbt-card h2{font-family:var(--display,Georgia,serif);font-style:italic;font-weight:400;' +
      'font-size:30px;line-height:1.1;margin:0 0 12px;}' +
      '#hbt-card p{margin:0 0 11px;color:var(--body,#4B3B26);font-size:17px;line-height:1.55;}' +
      '.hbt-list{list-style:none;margin:12px 0 0;padding:0;}' +
      '.hbt-list li{padding:7px 0;border-top:1px solid var(--line,#DCCFAE);}' +
      '.hbt-list li:first-child{border-top:none;}' +
      '.hbt-list b{display:block;font-weight:600;font-size:16px;}' +
      '.hbt-list span{display:block;font-style:italic;color:var(--muted,#7A6543);font-size:14.5px;line-height:1.4;}' +
      '#hbt-foot{display:flex;align-items:center;gap:10px;margin-top:20px;' +
      'padding-top:14px;border-top:1px solid var(--line,#DCCFAE);}' +
      '#hbt-dots{flex:1;display:flex;gap:5px;}' +
      '.hbt-dot{width:7px;height:7px;border-radius:50%;background:var(--line-2,#C6B48B);}' +
      '.hbt-dot.on{background:var(--owed,#8E2A20);}' +
      '#hbt-card button{min-height:44px;padding:0 16px;border-radius:var(--r2,4px);cursor:pointer;' +
      'font-family:var(--sc,var(--serif,Georgia,serif));font-size:16px;letter-spacing:.08em;' +
      'text-transform:lowercase;font-variant:small-caps;' +
      'border:1px solid var(--line-2,#C6B48B);background:var(--raised,#FCF8EC);color:var(--body,#4B3B26);}' +
      '#hbt-card button.pri{background:var(--owed,#8E2A20);border-color:var(--owed,#8E2A20);' +
      'color:var(--surface,#F8F2E2);font-weight:600;}' +
      '@media (prefers-reduced-motion:no-preference){#hbt-card{animation:hbtIn .18s ease;}}' +
      '@keyframes hbtIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}';
    d.head.appendChild(s);
  }

  function run() {
    if (d.getElementById('hbt-back')) return;
    css();
    var S = steps(), i = 0;
    var prev = d.activeElement;

    var back = d.createElement('div'); back.id = 'hbt-back';
    var card = d.createElement('div'); card.id = 'hbt-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-label', 'A tour of the hub');
    card.tabIndex = -1;
    back.appendChild(card);

    function close() {
      markSeen();
      d.removeEventListener('keydown', onKey, true);
      back.remove();
      try { if (prev && prev.focus) prev.focus(); } catch (e) {}
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') go(i + 1);
      else if (e.key === 'ArrowLeft') go(i - 1);
    }
    function go(n) {
      if (n < 0) return;
      if (n >= S.length) { close(); return; }
      i = n; draw();
    }
    function draw() {
      var s = S[i];
      card.innerHTML =
        '<h2>' + esc(s.t) + '</h2>' + s.b +
        '<div id="hbt-foot"><span id="hbt-dots">' +
        S.map(function (_, n) { return '<span class="hbt-dot' + (n === i ? ' on' : '') + '"></span>'; }).join('') +
        '</span>' +
        (i > 0 ? '<button type="button" data-go="back">back</button>' : '') +
        '<button type="button" data-go="skip">' + (i === S.length - 1 ? 'close' : 'skip') + '</button>' +
        (i < S.length - 1 ? '<button type="button" class="pri" data-go="next">next</button>' : '') +
        '</div>';
      card.focus();
    }
    card.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[data-go]');
      if (!b) return;
      var a = b.getAttribute('data-go');
      if (a === 'next') go(i + 1);
      else if (a === 'back') go(i - 1);
      else close();
    });
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    d.addEventListener('keydown', onKey, true);

    d.body.appendChild(back);
    draw();
  }

  w.__hbTour = { run: run, seen: seen, reset: function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
  } };

  /* First run, front door only. */
  function maybe() {
    var m = SM();
    var here = '';
    try { here = m && m.here ? m.here() : (location.pathname.split('/').pop() || ''); } catch (e) {}
    if (here !== HOME) return;
    if (seen()) return;
    setTimeout(run, 700);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', maybe);
  else maybe();
})(window, document);
