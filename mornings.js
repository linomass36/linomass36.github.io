/* ─────────────────────────────────────────────────────────────────────────
   mornings.js — the mornings of a wait, counted on a wall.

   WHY THIS EXISTS. Wait.html answers "what does today permit". It is a good
   answer and it is the wrong shape for 06:00, because at 06:00 the question
   is not what you may send. It is whether you are going to get up. So this
   is the other half: a mark on a wall for every morning you woke into a day
   with no news in it, a line worth reading while you make the mark, and —
   when the wait ends either way — the eight things to do with that day.

   WHAT IT DOES NOT OWN, and this is the whole of its design. The recurring
   failure in this repo is two pages answering the same question differently,
   so this file keeps NO copy of anything Wait already knows:

     day 1          is the day Wait says the ask went out
     the week       is Wait.phase() reaching 'called'. There is no second
                    seven-day counter here to disagree with that one
     she replied    is Wait.set('replied'). Ticking the box on the overlay
                    writes the SAME field Wait.html writes, so a reply
                    recorded in one place is a reply in the other

   What it owns is exactly what nothing else does: which mornings were
   marked, which of the eight steps are ticked, and the day you accepted the
   silence as an answer. Everything else is read.

   NO WAIT, NO BUTTON. With no send date in ct_wait_v1 there is nothing to
   count from, so nothing mounts — rather than a wall showing day 1 of a
   wait that never started. This is chrome for a season, not furniture.

   INJECTED BY THE DEPLOY, like nav.js and upbar.js; the pages never
   reference it. It mounts to <body> rather than into the page, because a
   .dc.html page throws its own subtree away a tick after boot and takes any
   edit made at DOMContentLoaded with it — see the header of upbar.js, which
   learned that the expensive way. An observer re-mounts if the node ever
   goes, which costs one pass and then goes quiet.
   ───────────────────────────────────────────────────────────────────────── */
(function (w, d) {
  'use strict';
  if (w.__hbMorningsLoaded) return;
  w.__hbMorningsLoaded = true;

  var KEY = 'ct_mornings_v1';
  var DAY = 86400000;

  /* ── store ──────────────────────────────────────────────────────────────
     Three facts. `acked` is a date, not a verdict: it says when you sat down
     with the silence, not whether the silence counts — Wait's clock answers
     that, and answers it the same way on both pages. */
  function read() {
    var s = null;
    try { var r = localStorage.getItem(KEY); if (r) s = JSON.parse(r); } catch (e) {}
    if (!s || typeof s !== 'object') s = {};
    return {
      marks: Array.isArray(s.marks) ? s.marks.slice() : [],
      steps: Array.isArray(s.steps) && s.steps.length === 8
        ? s.steps.map(Boolean) : [false, false, false, false, false, false, false, false],
      acked: num(s.acked)
    };
  }
  function num(v) { var n = Number(v); return isFinite(n) && n > 0 ? n : null; }
  function write(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }

  /* ── the clock, borrowed ────────────────────────────────────────────────
     Every date question is asked of Wait. dayNumber returns null when there
     is no ask to count from, which is the honest answer and the one that
     keeps the button off the screen. */
  function key(ts) {
    var x = new Date(ts);
    return x.getFullYear() + '-' + p2(x.getMonth() + 1) + '-' + p2(x.getDate());
  }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function noonOf(k) { var a = String(k).split('-'); return new Date(+a[0], +a[1] - 1, +a[2], 12).getTime(); }

  function dayNumber(ws, now) {
    if (!ws || !ws.sent) return null;
    now = now == null ? Date.now() : Number(now);
    return Math.round((noonOf(key(now)) - noonOf(key(ws.sent))) / DAY) + 1;
  }

  /* The stretch is up when Wait says so. Asking Wait rather than counting to
     seven here is the point: Wait counts from the LAST message sent, so a
     bump moves the deadline, and a wall that had its own seven would have
     gone on offering the box two days early. */
  function stretchOver(ws, now) {
    if (!ws || !ws.sent || !w.Wait) return false;
    return w.Wait.phase(ws, now == null ? Date.now() : now).id === 'called';
  }

  /* 'yes' the moment Wait carries a reply — including one recorded on the
     other page — and 'no' only once the silence has been acknowledged here.
     The clock running out is not the same event as sitting down with it. */
  function outcome(ws, mine, now) {
    if (!ws || !ws.sent) return null;
    if (ws.replied) return 'yes';
    if (mine && mine.acked) return 'no';
    return null;
  }

  /* ── the words ──────────────────────────────────────────────────────────
     Fixed to the day number, never shuffled. A line that changes when you
     reload is a feed, and contact.js already says why this is not one. */
  var WORDS = [
    { l: 'You asked. That was the whole hard part, and it is already behind you.',
      a: 'Do not reread what you sent. It said what it said, and it does not say it better on the fourth reading.' },
    { l: 'Silence this early is not an answer. It is just the clock, and the clock is nine hours ahead of you.',
      a: 'Waking to nothing at 6am is 3pm to her. That is a few of her waking hours, not a day of being ignored.' },
    { l: 'You are allowed to be alright today. That is not a betrayal of how much you want this.',
      a: 'Do one thing you would have done if you had never sent the message. One. It breaks the day open.' },
    { l: 'Whichever way this lands, you stopped hedging. That part was yours and it is already finished.',
      a: 'Train today. Not to be seen doing it — because the body is the one thing still answering you.' },
    { l: 'The wall is filling up. Every mark on it is a morning you got up into a day with no news in it.',
      a: 'Tell someone. Out loud, to a face. It gets smaller the moment it leaves your head.' },
    { l: 'Do not write the bump in your head all day. It is sent or it is not; rehearsing it is neither.',
      a: 'If the window is open, decide before noon. A decision made at midnight is not a decision.' },
    { l: 'Last mark. Tomorrow you have an answer — and silence is one of the answers.',
      a: 'Choose now what you do either way. Now, not tomorrow, when you will be in no state to choose.' }
  ];
  var AFTER = [
    { l: 'The wait is over whether or not anyone has announced it.',
      a: 'Nothing you could send today improves your position. That is not defeat, it is arithmetic.' },
    { l: 'You did the thing most people never do. You asked plainly and you waited honestly.',
      a: 'Give the day a shape before it gives you one. Write down three things and do them.' },
    { l: 'A door you closed kindly stays closed. That was the right call on the day and it still is.',
      a: 'Do not soothe this by reopening the other one. It would be a worse version of the hedge.' },
    { l: 'The eight steps are not a consolation prize. On a day like this they are the whole plan.',
      a: 'Canopy first. Everything else on the list gets easier once that one is done.' }
  ];
  function words(n) {
    if (!n || n < 1) return WORDS[0];
    return n <= WORDS.length ? WORDS[n - 1] : AFTER[(n - WORDS.length - 1) % AFTER.length];
  }

  /* ── the eight, as dictated ─────────────────────────────────────────────
     Same eight in both outcomes, same order, and the difference between a
     good day and a bad one is not which ones you do. Kept in the words they
     were given in; the page is not the place to improve somebody's list. */
  var STEPS = [
    { w: 'Lock in canopy fully', urgent: true,
      d: 'Do it no matter what. Get up and do it now — literally now, whatever else you are in the middle of.' },
    { w: 'Tell someone' },
    { w: 'Buy a tub of ice cream' },
    { w: 'Eat it watching a film or a series',
      d: 'The Marshals. If that is finished: A Man Called Otto, or The Pitt.' },
    { w: 'Go to the gym' },
    { w: 'Shower' },
    { w: 'Eat ‼️' },
    { w: 'Go to bed, phone downstairs', d: 'Really important. Do not be like meh, whatever.' }
  ];

  /* ── the wall ───────────────────────────────────────────────────────────
     Groups of five: four uprights, then a diagonal laid across them. Every
     stroke is jittered off a seed on its own index, so the wall looks
     scratched by a hand and looks like the SAME scratched wall on every
     repaint. A tally that reshuffles is not a record of anything. */
  var GW = 84, GH = 96;
  function rnd(seed) { var x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function jit(seed, amp) { return (rnd(seed) - 0.5) * 2 * amp; }
  function r1(n) { return Math.round(n * 10) / 10; }

  function isDiagonal(i) { return i % 5 === 4; }

  function strokePath(i) {
    var g = Math.floor(i / 5), k = i % 5, ox = g * GW;
    if (k < 4) {
      var x = ox + 12 + k * 15;
      return 'M ' + r1(x + jit(i * 3 + 1, 3)) + ' ' + r1(12 + jit(i * 5, 4)) +
             ' Q ' + r1(x + jit(i * 3 + 3, 3)) + ' 48 ' +
             r1(x + jit(i * 3 + 2, 4.5)) + ' ' + r1(84 + jit(i * 7, 4));
    }
    return 'M ' + r1(ox + 3 + jit(i * 3 + 1, 2)) + ' ' + r1(86 + jit(i * 5, 3)) +
           ' Q ' + r1(ox + 36) + ' 42 ' +
           r1(ox + 68 + jit(i * 3 + 2, 3)) + ' ' + r1(10 + jit(i * 7, 3));
  }

  function tallySVG(count, fresh) {
    var groups = Math.max(1, Math.ceil(count / 5));
    var wd = groups * GW + 16, s, i;
    s = '<svg class="hbm-tally" viewBox="0 0 ' + wd + ' ' + GH + '" width="' + wd +
        '" height="' + GH + '" role="img" aria-label="' + count + ' mornings marked">' +
        '<defs><filter id="hbm-rough" x="-20%" y="-20%" width="140%" height="140%">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="7" result="t"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="t" scale="1.7" xChannelSelector="R" yChannelSelector="G"/>' +
        '</filter></defs><g filter="url(#hbm-rough)">';
    for (i = 0; i < count; i++) {
      s += '<path pathLength="100" d="' + strokePath(i) + '" stroke-width="' +
           r1((isDiagonal(i) ? 4.4 : 3.6) + jit(i * 11, 0.6)) + '"' +
           (i === fresh ? ' class="hbm-fresh" style="stroke-dasharray:100"' : '') + '></path>';
    }
    s += '</g>';
    if (fresh >= 0) {
      var g = Math.floor(fresh / 5), k = fresh % 5;
      var cx = k < 4 ? g * GW + 12 + k * 15 : g * GW + 66;
      for (i = 0; i < 5; i++) {
        s += '<circle class="hbm-dust" cx="' + r1(cx + jit(i * 9, 6)) + '" cy="' + r1(18 + jit(i * 5, 8)) +
             '" r="' + r1(1 + rnd(i * 3) * 1.4) + '" style="--dx:' + r1(jit(i * 13, 10)) +
             'px;animation-delay:' + (0.18 + i * 0.05) + 's"></circle>';
      }
    }
    return s + '</svg>';
  }

  /* ── formatting ─────────────────────────────────────────────────────── */
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function on(ts) { var x = new Date(ts); return DAYS[x.getDay()] + ' ' + x.getDate() + ' ' + MON[x.getMonth()]; }
  function esc(s) { return String(s).replace(/&(?![a-z#]+;)/g, '&amp;').replace(/</g, '&lt;'); }

  w.Mornings = {
    KEY: KEY, STEPS: STEPS,
    read: read, write: write,
    dayNumber: dayNumber, stretchOver: stretchOver, outcome: outcome,
    words: words, strokePath: strokePath, isDiagonal: isDiagonal, dayKey: key
  };

  /* ══════════════════════════════════════════════════════════════════════
     THE UI

     Everything above is testable without a DOM and tools/mornings.test.js
     drives the clock on it. Everything below paints. If this half has a bug
     the worst case is an ugly panel; a bug in the half above would be a wall
     that disagrees with the page it borrows its dates from.
     ══════════════════════════════════════════════════════════════════════ */
  if (typeof d === 'undefined' || !d || !d.createElement) return;

  /* Literal colours, not hub.css variables: hub.css is deliberately NOT
     injected on every page (see inject.py), so a var() here would resolve to
     nothing on exactly the pages that never linked it. nav.js does the same. */
  var CSS = [
    /* THE BUTTON, AND THE THIRD SEAT IN THE LANE.

       The right edge above the fold is already a stack: nav.js's drawer
       control at 12 (52 tall, so it ends at 64) and capture.js's at 64 (44
       tall, ending at 108), flush, no gaps. Put at 74 — "just under the menu
       button", measured off the drawer alone — this landed squarely on the
       capture button on every desktop-width page, 34px of overlap, two
       controls one tap apart. On a phone capture.js sits above the tab bar
       instead, so the collision was invisible at the width it was drawn for.

       So: 108, which is where the stack actually continues. Only the seat
       moved — the control itself is the pill from the prototype, label and
       all, because the day number on the face of it is the point: you can
       see what day of the wait it is without opening anything. */
    ':root{--hb-morn-clear:calc(146px + var(--safe-right, env(safe-area-inset-right,0px)));}',
    '#hbm-btn{position:fixed;right:calc(12px + var(--safe-right, env(safe-area-inset-right,0px)));',
    'top:calc(108px + var(--safe-top, env(safe-area-inset-top,0px)));z-index:2147483180;',
    'display:flex;align-items:center;gap:9px;padding:9px 13px 9px 10px;border-radius:13px;',
    'border:1px solid #3E4240;background:linear-gradient(180deg,#363937,#2A2C2B);',
    'color:#E9E5DA;cursor:pointer;box-shadow:0 2px 4px rgba(26,27,26,.16),0 12px 26px rgba(26,27,26,.18);',
    '-webkit-tap-highlight-color:transparent;touch-action:manipulation;}',
    '#hbm-btn:hover{background:linear-gradient(180deg,#3D4240,#363937);}',
    '#hbm-btn .hbm-glyph{display:block;width:22px;height:20px;flex:none;}',
    '#hbm-btn .hbm-lab{font-family:"IBM Plex Mono",monospace;font-size:11px;',
    'letter-spacing:.06em;line-height:1.25;text-align:left;}',
    '#hbm-btn .hbm-lab b{display:block;font-weight:500;letter-spacing:.14em;',
    'text-transform:uppercase;font-size:9.5px;color:#938F85;}',
    '#hbm-btn .hbm-dot{width:7px;height:7px;border-radius:50%;background:#C9432A;flex:none;',
    'box-shadow:0 0 0 3px rgba(201,67,42,.22);}',
    '#hbm-btn .hbm-dot[hidden]{display:none;}',

    /* THE PILL NEEDS A LANE, AND ONE ROW DID NOT KNOW ABOUT IT.

       nav.js's button carves --hb-btn-clear out of the destination tab row
       for exactly this reason: a row that does not extend under a floating
       control cannot have a chip under it AT ANY SCROLL POSITION, which
       padding can never promise. That covers .hb-desttabs. It does not cover
       .hub-tabs — the bar a FOLDED page draws for itself — and that bar sits
       in the same band this pill occupies, so on Money two of its own tabs
       were underneath it, and which two depended on how far the row had been
       scrolled. Same bug, one row further down the page.

       So the same fix: the row gets shorter. Its bottom rule stops short with
       it, and the pill sits in the gap that leaves, which is the honest way
       to draw a control that owns that corner. Only while a wait is live —
       this whole stylesheet is injected on mount and there is no mount
       without a send date. */
    '.hub-tabs{width:calc(100% - var(--hb-morn-clear));}',
    '@keyframes hbm-nudge{0%,100%{transform:none;}30%{transform:translateY(-4px);}',
    '60%{transform:translateY(0);}}',
    '#hbm-btn.nudge{animation:hbm-nudge .7s ease 2;}',

    '#hbm-wrap{position:fixed;inset:0;z-index:2147483300;background:#191B1A;overflow:auto;',
    'overscroll-behavior:contain;font-family:"IBM Plex Sans",system-ui,-apple-system,sans-serif;',
    'font-size:15px;line-height:1.55;color:#E9E5DA;-webkit-font-smoothing:antialiased;}',
    '#hbm-wrap[hidden]{display:none;}',
    '#hbm-weather{position:fixed;inset:0;z-index:1;pointer-events:none;}',
    '#hbm-cell{position:relative;z-index:2;width:100%;max-width:780px;margin:0 auto;',
    'display:flex;flex-direction:column;gap:18px;padding:20px 20px 40px;',
    'padding-top:calc(20px + var(--safe-top, env(safe-area-inset-top,0px)));',
    'padding-bottom:calc(40px + var(--safe-bottom, env(safe-area-inset-bottom,0px)));}',
    '#hbm-wrap *{box-sizing:border-box;}',
    /* Belt and braces on a panel that is injected into thirty pages it did
       not write. The controls here are nearly transparent by design — 3%
       white over the panel, or nothing at all — which is the state where a
       UA that still wants to paint its own control face has room to do it.
       Turning appearance off costs a line and removes the question. */
    '#hbm-wrap button,#hbm-btn{-webkit-appearance:none;appearance:none;}',
    '#hbm-wrap button{font:inherit;color:inherit;}',
    '#hbm-wrap :focus-visible{outline:2px solid #C9432A;outline-offset:3px;}',

    '.hbm-bar{display:flex;align-items:center;gap:12px;}',
    '.hbm-bar .t{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.17em;',
    'text-transform:uppercase;color:#938F85;}',
    '.hbm-bar .t b{color:#E9E5DA;font-weight:500;}',
    '.hbm-bar .sp{flex:1;}',
    '.hbm-x{width:38px;height:38px;flex:none;border-radius:11px;border:1px solid #3E4240;',
    'background:rgba(255,255,255,.03);color:#938F85;font-size:17px;line-height:1;cursor:pointer;}',
    '.hbm-x:hover{color:#E9E5DA;background:rgba(255,255,255,.07);}',

    '.hbm-wall{position:relative;border-radius:6px;padding:28px 0 14px;border:1px solid #232625;',
    'overflow:hidden;background:radial-gradient(120% 80% at 22% 12%, rgba(52,56,54,0) 40%, rgba(0,0,0,.32) 100%),',
    'radial-gradient(60% 50% at 78% 86%, rgba(255,255,255,.035), rgba(255,255,255,0) 70%),',
    'linear-gradient(172deg,#313432 0%,#2A2C2B 46%,#232625 100%);',
    'box-shadow:inset 0 1px 0 rgba(255,255,255,.05),inset 0 -22px 40px rgba(0,0,0,.3),0 18px 40px rgba(0,0,0,.35);}',
    '.hbm-scroll{overflow-x:auto;padding:0 20px;display:flex;justify-content:center;justify-content:safe center;}',
    '.hbm-tally{display:block;height:154px;flex:none;}',
    /* The prototype was always seeded, so it never drew a wall with nothing
       on it — and a blank slab reads as a panel that failed to load rather
       than as a wait one day old. */
    '.hbm-empty{display:flex;align-items:center;justify-content:center;height:154px;',
    'font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.08em;',
    'text-transform:uppercase;color:#4A4D49;text-align:center;padding:0 24px;}',
    '.hbm-tally path{fill:none;stroke:#E9E5DA;stroke-linecap:round;stroke-linejoin:round;opacity:.93;}',
    '.hbm-tally path.hbm-fresh{animation:hbm-scratch .55s cubic-bezier(.2,.75,.3,1) both;}',
    '@keyframes hbm-scratch{from{stroke-dashoffset:100;}to{stroke-dashoffset:0;}}',
    '.hbm-dust{fill:#E9E5DA;opacity:0;animation:hbm-puff .8s ease-out both;}',
    '@keyframes hbm-puff{0%{opacity:.75;transform:translate(0,0) scale(1);}',
    '100%{opacity:0;transform:translate(var(--dx),16px) scale(.3);}}',
    '.hbm-cap{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline;padding:12px 20px 0;',
    'font-family:"IBM Plex Mono",monospace;font-size:10.5px;letter-spacing:.05em;color:#5C5F5B;}',
    '.hbm-cap b{color:#938F85;font-weight:400;}',

    '.hbm-today{border:1px solid #3E4240;border-radius:14px;background:rgba(255,255,255,.035);',
    'padding:20px 22px;display:flex;flex-direction:column;gap:14px;}',
    '.hbm-eye{font-family:"IBM Plex Mono",monospace;font-size:9.5px;font-weight:600;',
    'letter-spacing:.18em;text-transform:uppercase;color:#C9432A;}',
    '.hbm-line{font-family:"Newsreader",Georgia,serif;font-style:italic;font-weight:400;',
    'font-size:clamp(21px,3.6vw,27px);line-height:1.3;color:#E9E5DA;margin:0;max-width:34ch;}',
    '.hbm-adv{display:flex;gap:12px;align-items:flex-start;padding-top:2px;',
    'border-top:1px solid rgba(255,255,255,.07);}',
    '.hbm-adv .k{font-family:"IBM Plex Mono",monospace;font-size:9.5px;letter-spacing:.16em;',
    'text-transform:uppercase;color:#5C5F5B;flex:none;padding-top:5px;width:52px;}',
    '.hbm-adv .v{flex:1;min-width:0;color:#938F85;font-size:14.5px;line-height:1.5;}',
    '.hbm-mark{display:flex;align-items:center;justify-content:center;gap:11px;width:100%;',
    'min-height:62px;border-radius:13px;cursor:pointer;border:1px solid #C9432A;',
    'background:rgba(201,67,42,.14);color:#E9E5DA;font-family:"IBM Plex Mono",monospace;font-size:14px;}',
    '.hbm-mark:hover{background:rgba(201,67,42,.22);}',
    '.hbm-mark[disabled]{cursor:default;border-color:#3E4240;background:rgba(255,255,255,.03);color:#5C5F5B;}',

    '.hbm-outs{display:grid;gap:10px;grid-template-columns:1fr 1fr;}',
    '.hbm-out{text-align:left;padding:15px 17px;border-radius:13px;cursor:pointer;',
    'border:1px solid #3E4240;background:rgba(255,255,255,.035);color:#E9E5DA;',
    'display:flex;flex-direction:column;gap:3px;}',
    '.hbm-out .h{font-size:15px;font-weight:500;}',
    '.hbm-out .s{font-family:"IBM Plex Mono",monospace;font-size:10.5px;color:#5C5F5B;line-height:1.45;}',
    '.hbm-out.yes:hover{border-color:#D9A441;background:rgba(217,164,65,.12);}',
    '.hbm-out.yes .h{color:#D9A441;}',
    '.hbm-out.no:hover:not([disabled]){border-color:#7FA0AE;background:rgba(127,160,174,.1);}',
    '.hbm-out[disabled]{cursor:default;opacity:.5;}',
    '.hbm-foot{margin:0;font-family:"IBM Plex Mono",monospace;font-size:10.5px;line-height:1.6;',
    'letter-spacing:.03em;color:#5C5F5B;max-width:52ch;}',
    '.hbm-foot a{color:#938F85;text-decoration:underline;}',

    /* one layout, two temperatures — everything that differs is a token */
    '.hbm-res{--acc:#D9A441;--acc-deep:#8C6420;--acc-ln:#544017;',
    'display:flex;flex-direction:column;gap:20px;}',
    '.hbm-res.sad{--acc:#7FA0AE;--acc-deep:#3D5761;--acc-ln:#2E3F47;}',
    '.hbm-rh{display:flex;flex-direction:column;gap:9px;}',
    '.hbm-rh .hbm-eye{color:var(--acc);}',
    '.hbm-rh h2{font-family:"Newsreader",Georgia,serif;font-weight:500;margin:0;',
    'font-size:clamp(34px,7vw,52px);line-height:1.02;letter-spacing:-.02em;color:#E9E5DA;}',
    '.hbm-rh p{margin:0;color:#938F85;font-size:15.5px;line-height:1.55;max-width:56ch;}',
    '.hbm-rh p b{color:#E9E5DA;font-weight:500;}',
    '.hbm-ph{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding-bottom:9px;',
    'border-bottom:1px solid var(--acc-ln);}',
    '.hbm-ph .t{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.18em;',
    'text-transform:uppercase;color:var(--acc);}',
    '.hbm-ph .sp{flex:1;}',
    '.hbm-ph .n{font-family:"IBM Plex Mono",monospace;font-size:11px;color:#5C5F5B;',
    'font-variant-numeric:tabular-nums;}',
    '.hbm-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;}',
    '.hbm-step{display:flex;gap:14px;align-items:flex-start;padding:13px 4px;',
    'border-bottom:1px solid rgba(255,255,255,.07);cursor:pointer;}',
    '.hbm-step:last-child{border-bottom:none;}',
    '.hbm-step .n{font-family:"IBM Plex Mono",monospace;font-size:11px;color:#5C5F5B;flex:none;',
    'width:18px;padding-top:5px;font-variant-numeric:tabular-nums;}',
    '.hbm-step .bx{flex:none;width:24px;height:24px;margin-top:1px;border-radius:7px;',
    'border:1.5px solid #5C5F5B;display:grid;place-items:center;color:transparent;font-size:14px;line-height:1;}',
    '.hbm-step .b{flex:1;min-width:0;}',
    /* Both are spans, so both need saying: without it the detail ran on
       from the step it belongs to — "Eat it watching a film or a seriesThe
       Marshals." */
    '.hbm-step .b .w{display:block;font-size:16px;line-height:1.4;color:#E9E5DA;}',
    '.hbm-step .b .d{display:block;font-size:13.5px;color:#938F85;margin-top:3px;line-height:1.45;}',
    '.hbm-step:hover .bx{border-color:var(--acc);}',
    '.hbm-step.done .bx{border-color:var(--acc);background:var(--acc);color:#191B1A;}',
    '.hbm-step.done .b .w{color:#5C5F5B;text-decoration:line-through;text-decoration-color:var(--acc-deep);}',
    '.hbm-step.done .b .d{color:#5C5F5B;}',
    /* step one is not a list item, it is an instruction with a clock on it */
    '.hbm-step.urgent{background:rgba(201,67,42,.09);border-left:2px solid #C9432A;',
    'padding-left:12px;border-radius:3px;}',
    '.hbm-step.urgent .b .w{font-weight:500;}',
    '.hbm-step.urgent .now{display:inline-block;margin-left:8px;vertical-align:2px;',
    'font-family:"IBM Plex Mono",monospace;font-size:9px;letter-spacing:.16em;padding:2px 6px;',
    'border-radius:4px;background:#C9432A;color:#fff;}',
    '.hbm-step.urgent.done{background:transparent;border-left-color:var(--acc-deep);}',
    '.hbm-step.urgent.done .now{background:var(--acc-deep);}',
    '.hbm-closer{border:1px solid var(--acc-ln);border-radius:13px;padding:16px 18px;',
    'background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));}',
    '.hbm-closer[hidden]{display:none;}',
    '.hbm-closer .h{font-family:"Newsreader",Georgia,serif;font-size:22px;color:var(--acc);}',
    '.hbm-closer .s{color:#938F85;font-size:14px;margin-top:3px;}',
    '.hbm-rf{display:flex;gap:10px;flex-wrap:wrap;}',
    '.hbm-ghost{padding:11px 15px;border-radius:11px;border:1px solid #3E4240;background:transparent;',
    'color:#938F85;font-family:"IBM Plex Mono",monospace;font-size:11.5px;cursor:pointer;}',
    '.hbm-ghost:hover{color:#E9E5DA;border-color:#5C5F5B;}',

    '@media (max-width:560px){.hbm-outs{grid-template-columns:1fr;}',
    '.hbm-tally{height:122px;}.hbm-today{padding:17px 16px;}.hbm-adv .k{display:none;}}',
    '@media (prefers-reduced-motion:reduce){#hbm-wrap *,#hbm-wrap *::before{',
    'animation-duration:.001ms !important;animation-iteration-count:1 !important;}}'
  ].join('');

  var FACE =
    '<svg class="hbm-glyph" viewBox="0 0 22 20" aria-hidden="true">' +
    '<g fill="none" stroke="#E9E5DA" stroke-width="1.8" stroke-linecap="round">' +
    '<path d="M4 3.5 L3.4 16.5"/><path d="M8 3.2 L7.6 16.6"/><path d="M12 3.6 L11.5 16.4"/>' +
    '<path d="M16 3.3 L15.7 16.6"/><path d="M1.8 17 L18.4 3"/></g></svg>' +
    '<span class="hbm-lab"><b>The wait</b><span id="hbm-day">\u2014</span></span>' +
    '<span class="hbm-dot" id="hbm-dot"></span>';

  function ws() { return w.Wait ? w.Wait.read() : null; }
  function live() { var s = ws(); return !!(s && s.sent); }

  function ready(fn) {
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function mount() {
    if (!live()) return;                       /* no ask, no wall */
    if (d.getElementById('hbm-btn')) return;

    if (!d.getElementById('hbm-css')) {
      var st = d.createElement('style');
      st.id = 'hbm-css'; st.textContent = CSS;
      d.head.appendChild(st);
    }

    var btn = d.createElement('button');
    btn.id = 'hbm-btn'; btn.type = 'button';
    btn.setAttribute('aria-label', 'The mornings');
    btn.innerHTML = FACE;
    btn.addEventListener('click', open);
    d.body.appendChild(btn);

    var wrap = d.createElement('div');
    wrap.id = 'hbm-wrap'; wrap.hidden = true;
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'The mornings');
    wrap.innerHTML = '<canvas id="hbm-weather"></canvas><div id="hbm-cell"></div>';
    d.body.appendChild(wrap);

    paintBtn();
  }

  function paintBtn() {
    var dot = d.getElementById('hbm-dot'), lab = d.getElementById('hbm-day');
    if (!dot || !lab) return;
    var s = ws(), mine = read(), now = Date.now(), kind = outcome(s, mine, now);
    lab.textContent = kind ? (kind === 'yes' ? 'She wrote' : 'Answered')
                           : 'Day ' + dayNumber(s, now);
    /* The dot is the one thing on the face that is a demand rather than a
       report: this morning is not on the wall yet. */
    dot.hidden = !!kind || mine.marks.indexOf(key(now)) >= 0;
  }

  /* ── screens ──────────────────────────────────────────────────────────── */
  function render(fresh) {
    var cell = d.getElementById('hbm-cell');
    if (!cell) return;
    var s = ws(), mine = read(), now = Date.now();
    var kind = outcome(s, mine, now);
    if (kind) { cell.innerHTML = resultHTML(s, mine, kind, now); wireResult(kind); weather(kind); }
    else { cell.innerHTML = waitHTML(s, mine, now, fresh == null ? -1 : fresh); wireWait(); stopWeather(); }
    paintBtn();
  }

  function waitHTML(s, mine, now, fresh) {
    var n = dayNumber(s, now), m = mine.marks.length, wd = words(n);
    var marked = mine.marks.indexOf(key(now)) >= 0;
    var over = stretchOver(s, now);
    /* THE ONE PLACE A DAY NUMBER IS NOT ENOUGH. Wait counts its week from
       the LAST message, so the moment the bump is used the end of the wait
       stops being "day 7" and becomes a date two days further out. The
       caption keeps "of 7" while that is still true and drops it once a bump
       has moved the end; the locked box names the date either way, because
       "unlocks on day 7" is a promise the clock does not keep. */
    var gates = w.Wait ? w.Wait.gates(s) : null;
    var due = gates ? gates.callIt : null;

    return '' +
      '<div class="hbm-bar"><span class="t">Day <b>' + p2(n) + '</b> &nbsp;·&nbsp; ' + on(now) +
        '</span><span class="sp"></span>' +
        '<button class="hbm-x" id="hbm-close" type="button" aria-label="Close">✕</button></div>' +

      '<div class="hbm-wall"><div class="hbm-scroll">' +
        (m ? tallySVG(m, fresh)
           : '<div class="hbm-empty">The wall is bare. Mark it and it stops being.</div>') +
      '</div>' +
      '<div class="hbm-cap"><span><b>' + m + '</b> morning' + (m === 1 ? '' : 's') + ' marked</span>' +
        '<span>' + (over ? 'the stretch is done'
                  : s.bumped ? 'day ' + n            /* the bump moved the end; see below */
                  : 'day ' + n + ' of 7') + '</span>' +
        '<span>since ' + on(s.sent) + '</span></div></div>' +

      '<div class="hbm-today"><div class="hbm-eye">Today</div>' +
        '<p class="hbm-line">' + esc(wd.l) + '</p>' +
        '<div class="hbm-adv"><span class="k">Do this</span><span class="v">' + esc(wd.a) + '</span></div>' +
        '<button class="hbm-mark" id="hbm-mark" type="button"' + (marked ? ' disabled' : '') + '>' +
          (marked ? '✓ &nbsp;Marked. The wall has today on it.'
                  : '✎ &nbsp;I woke up. Mark the wall.') + '</button></div>' +

      '<div class="hbm-outs">' +
        '<button class="hbm-out yes" id="hbm-yes" type="button"><span class="h">She wrote back</span>' +
          '<span class="s">Any point, any day</span></button>' +
        '<button class="hbm-out no" id="hbm-no" type="button"' + (over ? '' : ' disabled') + '>' +
          '<span class="h">Seven mornings, no reply</span><span class="s">' +
          (over ? 'The week is up' : due ? 'Unlocks ' + on(due) : 'Unlocks when the week is up') +
          '</span></button></div>' +

      '<p class="hbm-foot">This panel sends nothing and never has. It counts the mornings and tells ' +
        'you what the day is for. The dates come from <a href="Wait.html">The Wait</a>.</p>';
  }

  function resultHTML(s, mine, kind, now) {
    var yes = kind === 'yes';
    var done = mine.steps.filter(Boolean).length;
    var when = yes ? s.replied : mine.acked;

    var list = mine.steps.map(function (tick, i) {
      var st = STEPS[i];
      return '<li class="hbm-step' + (tick ? ' done' : '') + (st.urgent ? ' urgent' : '') +
        '" data-i="' + i + '" tabindex="0" role="checkbox" aria-checked="' + (tick ? 'true' : 'false') + '">' +
        '<span class="n">' + p2(i + 1) + '</span><span class="bx">✓</span>' +
        '<span class="b"><span class="w">' + esc(st.w) +
        (st.urgent ? '<span class="now">NOW</span>' : '') + '</span>' +
        (st.d ? '<span class="d">' + esc(st.d) + '</span>' : '') + '</span></li>';
    }).join('');

    return '' +
      '<div class="hbm-bar"><span class="t">' + (yes ? 'Answered' : 'Unanswered') +
        ' &nbsp;·&nbsp; ' + on(when || now) + '</span><span class="sp"></span>' +
        '<button class="hbm-x" id="hbm-close" type="button" aria-label="Close">✕</button></div>' +

      '<div class="hbm-res' + (yes ? '' : ' sad') + '"><div class="hbm-rh">' +
        '<div class="hbm-eye">' + (yes ? 'Day ' + p2(dayNumber(s, when || now)) + ' · she wrote back'
                                       : 'Seven mornings · no reply') + '</div>' +
        '<h2>' + (yes ? 'She wrote back.' : 'That is the answer.') + '</h2>' +
        '<p>' + (yes
          ? 'Do not answer on impulse. What you are finding out is whether she wants to have the ' +
            'conversation — which is a different question from whether she typed something back. ' +
            '<b>Then do these eight anyway.</b> Today is a big day either way, and a big day needs a protocol.'
          : 'It arrived as silence, which is still an arrival. There is no message that turns it into a ' +
            'cleaner answer — every candidate is another ask wearing a coat. ' +
            '<b>So do these eight.</b> Not instead of feeling it. While feeling it.') + '</p></div>' +

      '<div><div class="hbm-ph"><span class="t">The eight</span><span class="sp"></span>' +
        '<span class="n" id="hbm-n">' + done + ' of 8</span></div>' +
        '<ul class="hbm-steps" id="hbm-list">' + list + '</ul></div>' +

      '<div class="hbm-closer" id="hbm-closer"' + (done === 8 ? '' : ' hidden') + '>' +
        '<div class="h">Eight for eight.</div><div class="s">Phone is downstairs. ' +
        (yes ? 'You handled the best version of today without rushing it. Goodnight.'
             : 'You got the answer and you still ate, trained and washed. That is the win available today. Goodnight.') +
        '</div></div>' +

      '<div class="hbm-rf"><button class="hbm-ghost" id="hbm-back" type="button">Back to the wall</button>' +
        '<button class="hbm-ghost" id="hbm-clear" type="button">Clear the eight</button></div></div>';
  }

  /* ── wiring ───────────────────────────────────────────────────────────── */
  function byId(id) { return d.getElementById(id); }

  function wireWait() {
    byId('hbm-close').onclick = close;
    var mk = byId('hbm-mark');
    if (mk && !mk.disabled) mk.onclick = function () {
      var mine = read(), k = key(Date.now());
      if (mine.marks.indexOf(k) >= 0) return;
      mine.marks.push(k); write(mine);
      render(mine.marks.length - 1);           /* only the new stroke animates */
    };
    /* Writes Wait's own field. A reply recorded here is a reply on the Wait
       page, and its phase changes with it — there is no second flag to fall
       out of step. */
    byId('hbm-yes').onclick = function () {
      if (w.Wait) w.Wait.set('replied', Date.now());
      render();
    };
    var no = byId('hbm-no');
    if (no && !no.disabled) no.onclick = function () {
      var mine = read(); mine.acked = Date.now(); write(mine); render();
    };
  }

  function wireResult(kind) {
    byId('hbm-close').onclick = close;
    byId('hbm-back').onclick = function () {
      var mine = read(); mine.acked = null; write(mine);
      if (w.Wait) { var s = ws(); if (s.replied) w.Wait.set('replied', null); }
      render();
    };
    byId('hbm-clear').onclick = function () {
      var mine = read();
      mine.steps = mine.steps.map(function () { return false; });
      write(mine); render();
    };
    var list = byId('hbm-list');
    function toggle(li) {
      var i = +li.getAttribute('data-i'), mine = read();
      mine.steps[i] = !mine.steps[i]; write(mine);
      li.classList.toggle('done', mine.steps[i]);
      li.setAttribute('aria-checked', mine.steps[i] ? 'true' : 'false');
      var n = mine.steps.filter(Boolean).length;
      byId('hbm-n').textContent = n + ' of 8';
      var c = byId('hbm-closer');
      if (n === 8) { c.hidden = false; if (kind === 'yes') burst(90); } else { c.hidden = true; }
    }
    list.addEventListener('click', function (e) {
      var li = e.target.closest ? e.target.closest('.hbm-step') : null;
      if (li) toggle(li);
    });
    list.addEventListener('keydown', function (e) {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      var li = e.target.closest ? e.target.closest('.hbm-step') : null;
      if (!li) return;
      e.preventDefault(); toggle(li);
    });
  }

  function open() { var el = byId('hbm-wrap'); if (!el) return; el.hidden = false; render(); }
  function close() {
    var el = byId('hbm-wrap');
    if (!el) return;
    el.hidden = true; stopWeather(); paintBtn();
    var b = byId('hbm-btn');
    if (b) { b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); }
  }

  /* ── weather ────────────────────────────────────────────────────────────
     Confetti one way. The other way is not rain — that is the obvious move
     and the wrong one. It is dust drifting down in a still room, which is
     what the day actually feels like. */
  var cv, cx, parts = [], raf = 0, mode = null, t0 = 0;
  var REDUCED = w.matchMedia ? w.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
  var GOLDS = ['#D9A441', '#E9E5DA', '#C9432A', '#B8862F', '#F2E7C9'];

  function ctx() {
    if (!cv) { cv = byId('hbm-weather'); cx = cv && cv.getContext ? cv.getContext('2d') : null; }
    return cx;
  }
  function sizeCanvas() {
    if (!ctx()) return;
    var r = Math.min(2, w.devicePixelRatio || 1);
    cv.width = w.innerWidth * r; cv.height = w.innerHeight * r;
    cv.style.width = w.innerWidth + 'px'; cv.style.height = w.innerHeight + 'px';
    cx.setTransform(r, 0, 0, r, 0, 0);
  }

  function burst(n) {
    if (REDUCED || mode !== 'yes' || !ctx()) return;
    for (var i = 0; i < n; i++) {
      parts.push({ x: w.innerWidth * (0.15 + Math.random() * 0.7),
        y: -20 - Math.random() * w.innerHeight * 0.4,
        vx: (Math.random() - 0.5) * 2.4, vy: 1.5 + Math.random() * 3,
        w: 5 + Math.random() * 7, h: 3 + Math.random() * 5,
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.22,
        c: GOLDS[(Math.random() * GOLDS.length) | 0] });
    }
    if (!raf) raf = w.requestAnimationFrame(tick);
  }

  function weather(kind) {
    mode = kind; parts = []; sizeCanvas();
    if (!ctx() || REDUCED) { if (cx) cx.clearRect(0, 0, w.innerWidth, w.innerHeight); return; }
    if (kind === 'yes') { burst(150); return; }
    for (var i = 0; i < 55; i++) {
      parts.push({ x: Math.random() * w.innerWidth, y: Math.random() * w.innerHeight,
        vy: 0.12 + Math.random() * 0.3, rad: 0.7 + Math.random() * 1.5,
        ph: Math.random() * 6.283,
        c: 'rgba(200,214,220,' + (0.1 + Math.random() * 0.22).toFixed(2) + ')' });
    }
    if (!raf) raf = w.requestAnimationFrame(tick);
  }

  function stopWeather() {
    mode = null; parts = [];
    if (raf) w.cancelAnimationFrame(raf);
    raf = 0;
    if (ctx()) cx.clearRect(0, 0, w.innerWidth, w.innerHeight);
  }

  function tick(ts) {
    if (!ctx()) { raf = 0; return; }
    t0 = ts / 1000;
    cx.clearRect(0, 0, w.innerWidth, w.innerHeight);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      if (mode === 'yes') {
        p.vy += 0.045; p.vx *= 0.995; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        if (p.y > w.innerHeight + 30) { parts.splice(i, 1); continue; }
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r);
        cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore();
      } else {
        p.y += p.vy; p.x += Math.sin(t0 * 0.5 + p.ph) * 0.22;
        if (p.y > w.innerHeight + 4) { p.y = -4; p.x = Math.random() * w.innerWidth; }
        cx.beginPath(); cx.arc(p.x, p.y, p.rad, 0, 6.283);
        cx.fillStyle = p.c; cx.fill();
      }
    }
    raf = parts.length ? w.requestAnimationFrame(tick) : 0;
  }

  w.addEventListener('resize', function () { if (mode) sizeCanvas(); });
  w.addEventListener('keydown', function (e) {
    var el = byId('hbm-wrap');
    if (e.key === 'Escape' && el && !el.hidden) close();
  });

  ready(function () {
    mount();
    /* A .dc.html page rebuilds itself a tick after boot. The button lives on
       <body> rather than inside that subtree so it normally survives — but a
       runtime that ever clears the body would take it, and a wall you cannot
       reach is worse than no wall. One idempotent re-check per mutation. */
    if (!w.MutationObserver) return;
    var o = new w.MutationObserver(function () {
      if (!d.getElementById('hbm-btn')) mount();
    });
    o.observe(d.body, { childList: true });
  });
})(typeof window !== 'undefined' ? window : this,
   typeof document !== 'undefined' ? document : null);
