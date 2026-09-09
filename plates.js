/* plates.js — the pictures, and the slots they fall into.

   Thirty public-domain works ship in plates/: Joseph Maclise's `Surgical
   Anatomy` (1859) for the thorax and the heart, Matejko and Chelmonski and
   their contemporaries for the Polish half of the brief, and the Hudson
   River School — Cole's `Course of Empire` among it — for the American half.

   Wikimedia and every museum's open-access API answer 403 at this machine's
   gateway, so none of these came from where you would expect. They came from
   public GitHub repositories that had already committed the Commons scans —
   the one image source the egress policy allows — and each was opened and
   looked at before it was kept. One candidate set turned out to be
   AI-generated illustrations passed off as history painting; it was thrown
   away rather than shipped.

   A slot asks for pictures in order of preference:

     <div class="hub-marginal hub-plate" data-plate="maclise-thorax cole-oxbow">

   The first name whose file is installed wins, and it is captioned from the
   catalogue below. If none is installed the element keeps the engraved
   figure hub.css draws for it, so a missing file is a quieter picture rather
   than an empty box. Adding one is only ever a matter of putting the file in
   plates/ — there is no CSS to edit and no list to update.  */
(function () {
  'use strict';

  /* Every one is public domain: the painters and the anatomist have been dead
     well over a century, so there is no licence to honour and nothing owed
     beyond good manners. The captions below are the good manners.

     Three groups, because the brief asked for three things.

     THE ANATOMY is Joseph Maclise's `Surgical Anatomy` (1859) — hand-tinted
     lithographs of the opened thorax, drawn from dissection at a time when
     nobody could yet operate inside one. The heart in Plate I is the organ
     this whole hub is pointed at, drawn eighty years before anyone stopped
     it and started it again.

     THE POLISH PAINTINGS and THE AMERICAN ones are what the brief asked to
     be mixed: Matejko's history painting and Chelmonski's field beside the
     Hudson River School's long view.

     `short` is what fits under a plate in the margin; the full credit goes
     to the screen reader and the tooltip. */
  var CATALOGUE = {
    /* ── cardiothoracic and anatomy ─────────────────────────────────── */
    'maclise-thorax': {
      title: 'The thorax opened: the heart, the lungs and the great vessels',
      short: 'the thorax opened', who: 'Joseph Maclise', year: 1859,
      group: 'anatomy', from: 'Surgical Anatomy', plate: 'I' },
    'maclise-thorax-ii': {
      title: 'The form of the thorax and the position of its contained parts',
      short: 'the form of the thorax', who: 'Joseph Maclise', year: 1859,
      group: 'anatomy', from: 'Surgical Anatomy', plate: 'II' },
    'maclise-aortic-arch': {
      title: 'The episternal region: the arch of the aorta and its branches',
      short: 'the aortic arch', who: 'Joseph Maclise', year: 1859,
      group: 'anatomy', from: 'Surgical Anatomy', plate: 'IX' },
    'maclise-heart-deep': {
      title: 'The deeper organs of the thorax: the heart in situ',
      short: 'the heart in situ', who: 'Joseph Maclise', year: 1859,
      group: 'anatomy', from: 'Surgical Anatomy', plate: 'XXIII' },
    'maclise-great-vessels': {
      title: 'The great vessels of the thoracico-abdominal cavity',
      short: 'the great vessels', who: 'Joseph Maclise', year: 1859,
      group: 'anatomy', from: 'Surgical Anatomy', plate: 'XXIV' },
    'maclise-vessels-skeleton': {
      title: 'The vessels of the thorax in relation to the skeleton',
      short: 'the vessels and the skeleton', who: 'Joseph Maclise', year: 1859,
      group: 'anatomy', from: 'Surgical Anatomy', plate: 'XXV' },
    'maclise-pericardium': {
      title: 'The internal parts referred to the surface: pleura and pericardium',
      short: 'pleura and pericardium', who: 'Joseph Maclise', year: 1859,
      group: 'anatomy', from: 'Surgical Anatomy', plate: 'XXVI' },

    /* ── Polish ──────────────────────────────────────────────────────── */
    'matejko-grunwald': {
      title: 'The Battle of Grunwald', short: 'Grunwald',
      who: 'Jan Matejko', year: 1878, group: 'polish' },
    'chelmonski-autumn': {
      title: 'Babie Lato (Indian Summer)', short: 'Babie Lato',
      who: 'J\u00f3zef Che\u0142mo\u0144ski', year: 1875, group: 'polish' },
    'malczewski-armour': {
      title: 'Self-Portrait in Armour', short: 'Self-Portrait in Armour',
      who: 'Jacek Malczewski', year: 1914, group: 'polish' },
    'boznanska-chrysanthemums': {
      title: 'Girl with Chrysanthemums', short: 'Girl with Chrysanthemums',
      who: 'Olga Bozna\u0144ska', year: 1894, group: 'polish' },
    'wyspianski-god-father': {
      title: 'God the Father: Let It Be', short: 'Let It Be',
      who: 'Stanis\u0142aw Wyspia\u0144ski', year: 1904, group: 'polish' },

    /* ── American, the Hudson River School ───────────────────────────────
       The Course of Empire is kept in its own order — Cole painted the five
       as one argument about a republic that grows, gorges, and is pulled
       down, and shuffling them alphabetically would throw the argument
       away. Everything after them is loose. */
    'cole-empire-savage': {
      title: 'The Savage State', short: 'The Savage State',
      who: 'Thomas Cole', year: 1834, group: 'american', from: 'The Course of Empire' },
    'cole-empire-arcadian': {
      title: 'The Arcadian or Pastoral State', short: 'The Arcadian State',
      who: 'Thomas Cole', year: 1834, group: 'american', from: 'The Course of Empire' },
    'cole-empire-consummation': {
      title: 'The Consummation of Empire', short: 'The Consummation',
      who: 'Thomas Cole', year: 1836, group: 'american', from: 'The Course of Empire' },
    'cole-empire-destruction': {
      title: 'Destruction', short: 'Destruction',
      who: 'Thomas Cole', year: 1836, group: 'american', from: 'The Course of Empire' },
    'cole-empire-desolation': {
      title: 'Desolation', short: 'Desolation',
      who: 'Thomas Cole', year: 1836, group: 'american', from: 'The Course of Empire' },

    'cole-oxbow': {
      title: 'View from Mount Holyoke after a Thunderstorm (The Oxbow)',
      short: 'The Oxbow', who: 'Thomas Cole', year: 1836, group: 'american' },
    'cole-kaaterskill': {
      title: 'Kaaterskill Falls', short: 'Kaaterskill Falls',
      who: 'Thomas Cole', year: 1826, group: 'american' },
    'cole-expulsion': {
      title: 'Expulsion from the Garden of Eden', short: 'The Expulsion',
      who: 'Thomas Cole', year: 1828, group: 'american' },
    'church-andes': {
      title: 'The Heart of the Andes', short: 'The Heart of the Andes',
      who: 'Frederic Edwin Church', year: 1859, group: 'american' },
    'church-twilight': {
      title: 'Twilight in the Wilderness', short: 'Twilight in the Wilderness',
      who: 'Frederic Edwin Church', year: 1860, group: 'american' },
    'church-icebergs': {
      title: 'The Icebergs', short: 'The Icebergs',
      who: 'Frederic Edwin Church', year: 1861, group: 'american' },
    'church-cotopaxi': {
      title: 'Cotopaxi', short: 'Cotopaxi',
      who: 'Frederic Edwin Church', year: 1862, group: 'american' },
    'bierstadt-rockies': {
      title: "The Rocky Mountains, Lander's Peak", short: "Lander's Peak",
      who: 'Albert Bierstadt', year: 1863, group: 'american' },
    'bierstadt-storm-rosalie': {
      title: 'A Storm in the Rocky Mountains, Mt. Rosalie', short: 'Mt. Rosalie',
      who: 'Albert Bierstadt', year: 1866, group: 'american' },
    'bierstadt-sierra-nevada': {
      title: 'Among the Sierra Nevada, California', short: 'Among the Sierra Nevada',
      who: 'Albert Bierstadt', year: 1868, group: 'american' },
    'durand-kindred-spirits': {
      title: 'Kindred Spirits', short: 'Kindred Spirits',
      who: 'Asher Brown Durand', year: 1849, group: 'american' },
    'gifford-hunter-mountain': {
      title: 'Hunter Mountain, Twilight', short: 'Hunter Mountain',
      who: 'Sanford Robinson Gifford', year: 1866, group: 'american' },
    'cropsey-starrucca': {
      title: 'Starrucca Viaduct, Pennsylvania', short: 'Starrucca Viaduct',
      who: 'Jasper Francis Cropsey', year: 1865, group: 'american' }
  };

  /* Whatever the export dialog happened to be set to. Tried in this order. */
  var EXTS = ['jpg', 'jpeg', 'png', 'webp'];

  var DIR = './plates/';

  /* base -> url, or null for "looked, not there". One lookup per name for the
     life of the page; deliberately not persisted, because a file you add
     should show up on the next reload rather than whenever a cache expires. */
  var found = {};
  var pending = {};

  /* The build writes plates/index.json listing what is actually in the
     directory, so the deployed site knows the answer without asking. When it
     is there — and it always is on the real site — nothing is probed and no
     404 is ever requested. The probe below is the fallback for opening these
     files straight off disk, before any build has run. */
  var index = null;
  var indexAsked = null;

  function loadIndex() {
    if (indexAsked) return indexAsked;
    indexAsked = fetch(DIR + 'index.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (list) {
        index = Array.isArray(list) ? list : null;
        return index;
      })
      .catch(function () { index = null; return null; });
    return indexAsked;
  }

  /* Ask one image whether it exists, by trying to load it. */
  function sniff(base) {
    return new Promise(function (resolve) {
      var i = 0;
      function next() {
        if (i >= EXTS.length) { resolve(null); return; }
        var url = DIR + base + '.' + EXTS[i++];
        var img = new Image();
        img.onload  = function () { resolve(url); };
        img.onerror = next;
        img.src = url;
      }
      next();
    });
  }

  function probe(base) {
    if (Object.prototype.hasOwnProperty.call(found, base)) {
      return Promise.resolve(found[base]);
    }
    if (pending[base]) return pending[base];

    pending[base] = loadIndex().then(function (list) {
      if (list) {
        /* Answered from the manifest — no request for a file that is not there. */
        for (var i = 0; i < EXTS.length; i++) {
          var name = base + '.' + EXTS[i];
          if (list.indexOf(name) !== -1) { found[base] = DIR + name; return found[base]; }
        }
        found[base] = null;
        return null;
      }
      return sniff(base).then(function (url) { found[base] = url; return url; });
    });
    return pending[base];
  }

  /* ── the rotation ──────────────────────────────────────────────────────
     Thirty pictures and six slots meant twenty-four of them were never on
     the site, and the six that were never changed — which is the same as
     wallpaper, and wallpaper stops being looked at within a week.

     So a slot may name a GROUP rather than a picture, and the choice turns
     over daily. Three things it has to be at once:

       STABLE WITHIN A DAY. A picture that changed on every render would
       flicker as the page redrew, and you would never get to look at one.
       The day is the hub's own day — day.js puts the boundary at 05:00, so
       a page open at 02:00 is still yesterday's, which is what the rest of
       the site believes too.

       DIFFERENT ON EVERY PAGE. Each slot mixes its own name into the
       position, so Monday's Standing and Monday's Week are not the same
       painting.

       A ROTATION RATHER THAN A DRAW. Random-with-replacement shows you the
       same canvas twice in a week and hides another for a month. This deals
       from a shuffled deck and advances one card a day, so ANY run of days
       as long as the group covers every picture in it exactly once. The
       shuffle is seeded by the slot, so each page has its own order and no
       two pages march in step; it is the same order on the next pass, which
       is what the word rotation means and is the price of the guarantee.

     No storage: the same day and the same slot always give the same answer,
     on every device, with nothing written down. */
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < String(str).length; i++) {
      h ^= String(str).charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
  }
  /* Deterministic PRNG — mulberry32. Same seed, same shuffle, anywhere. */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(list, seed) {
    var out = list.slice(), r = rng(seed);
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }
  /* Which day it is, by the hub's reckoning rather than the clock's. */
  function dayNumber() {
    var iso = null;
    try {
      if (window.CTDay && typeof window.CTDay.today === 'function') iso = window.CTDay.today();
    } catch (e) {}
    var ms = iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)
      ? Date.parse(iso + 'T00:00:00Z')
      : Date.now();
    return Math.floor(ms / 86400000);
  }
  /* The catalogue, or one group of it. 'any' — or nothing — is everything. */
  function inGroup(want) {
    var groups = String(want || 'any').toLowerCase().split(/[\s,]+/).filter(Boolean);
    var all = Object.keys(CATALOGUE).sort();
    if (!groups.length || groups.indexOf('any') > -1) return all;
    return all.filter(function (k) { return groups.indexOf(CATALOGUE[k].group) > -1; });
  }
  /* The order this slot will see its group in, and where in it today sits. */
  function rotation(want, slot, day) {
    var pool = inGroup(want);
    if (!pool.length) return [];
    day = day == null ? dayNumber() : day;
    var key = String(want || 'any') + '|' + String(slot || 'slot');
    var offset = hash(key);
    var step = (((day + offset) % pool.length) + pool.length) % pool.length;
    var deck = shuffled(pool, offset);
    /* Today's card first, then the rest of the deck as the fallback order —
       so a name whose file is missing costs you the next one along rather
       than the whole slot. */
    return deck.slice(step).concat(deck.slice(0, step));
  }

  /* The first installed painting from a preference list. */
  function pick(names) {
    var list = (names || []).slice();
    function step() {
      if (!list.length) return Promise.resolve(null);
      var base = list.shift();
      return probe(base).then(function (url) {
        return url ? { base: base, url: url, art: CATALOGUE[base] || null } : step();
      });
    }
    return step();
  }

  /* Under a plate in the margin there is room for a line, not a credit. */
  function shortCap(hit) {
    var a = hit.art;
    if (!a) return hit.base;
    var parts = a.who.split(' ');
    return parts[parts.length - 1] + ', ' + (a.short || a.title) + ', ' + a.year;
  }

  /* What a screen reader hears, and what the tooltip says: the whole credit,
     including the book and the plate number where there is one. An engraving
     without its plate number is half a citation. */
  function fullCap(hit) {
    var a = hit.art;
    if (!a) return hit.base;
    var s = a.who + ', ' + String.fromCharCode(8220) + a.title +
            String.fromCharCode(8221);
    if (a.from) s += ', ' + a.from + (a.plate ? ', Plate ' + a.plate : '');
    return s + ', ' + a.year;
  }

  /* Dress one slot. The engraving stays until a painting is actually loaded,
     so a slow file never leaves an empty box on the page. */
  /* What names this slot asks for: an explicit list, or the rotation. */
  function wanted(el) {
    var fixed = (el.getAttribute('data-plate') || '').split(/\s+/).filter(Boolean);
    if (!el.hasAttribute('data-plate-rotate')) return fixed;
    var want = el.getAttribute('data-plate-rotate') || 'any';
    var slot = el.getAttribute('data-plate-slot') || el.id ||
               (location.pathname.split('/').pop() || 'page') + '|' + fixed.join('-');
    /* The rotation leads; an explicit list is what it falls back to. Putting
       the fixed names first would have meant a slot that names a picture it
       already has never rotates at all — which is the thing being fixed. */
    var deck = rotation(want, slot);
    return deck.concat(fixed.filter(function (n) { return deck.indexOf(n) < 0; }));
  }

  function dress(el, used) {
    var names = wanted(el);
    /* Two slots on one page must not land on the same painting — that reads
       as a bug, not as a coincidence. The rotation offers the whole group in
       order, so taking the first one this page has not already used costs
       nothing and cannot run out. */
    if (used) {
      var free = names.filter(function (n) { return !used[n]; });
      if (free.length) names = free;
    }
    if (!names.length) return Promise.resolve(false);
    /* Already dressed — a re-render creates a new element, so this only ever
       short-circuits the one that is genuinely finished. It still declares
       what it took: the slots added to a long page are dressed in a second
       pass, and without this they could pick the painting already hanging at
       the foot of the same page. */
    if (el.classList.contains('has-plate') &&
        el.style.getPropertyValue('--plate-figure')) {
      if (used) used[el.getAttribute('data-plate-picked') || ''] = true;
      return Promise.resolve(true);
    }

    return pick(names).then(function (hit) {
      if (!hit) return false;
      if (used) used[hit.base] = true;
      el.setAttribute('data-plate-picked', hit.base);
      el.style.setProperty('--plate-figure', 'url("' + hit.url + '")');
      el.classList.add('has-plate');

      /* Give the frame the picture's own proportions rather than a square.
         Maclise's plates are tall; the Hudson River canvases are wide, and
         squaring either one cuts the half that matters. Clamped, because a
         margin note that runs the length of the page is no longer a note. */
      var probeImg = new Image();
      probeImg.onload = function () {
        if (!probeImg.naturalWidth || !probeImg.naturalHeight) return;
        var ar = probeImg.naturalWidth / probeImg.naturalHeight;
        el.style.setProperty('--plate-ar',
          Math.min(1.5, Math.max(0.66, ar)).toFixed(3));
        el.style.setProperty('--plate-ar-true', ar.toFixed(3));
      };
      probeImg.src = hit.url;
      el.setAttribute('title', fullCap(hit));

      /* A picture with a name on it is content, not decoration. */
      if (el.getAttribute('aria-hidden') === 'true') el.removeAttribute('aria-hidden');
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', fullCap(hit));

      /* The lettering, for a slot that wants it. `data-plate-cap` is how a
         page with its own stylesheet — the Grind board, the Week — asks for
         one without having to import the hub's. */
      if ((el.classList.contains('hub-marginal') || el.hasAttribute('data-plate-cap')) &&
          !el.querySelector('.plate-cap')) {
        var cap = document.createElement('span');
        cap.className = 'plate-cap';
        cap.textContent = shortCap(hit);
        el.appendChild(cap);
      }
      return true;
    });
  }

  /* In document order, one after another, so each slot can see what the ones
     above it took. */
  function dressAll(root) {
    var els = Array.prototype.slice.call(
      (root || document).querySelectorAll('[data-plate],[data-plate-rotate]'));
    var used = {};
    /* What this page has already hung, before anything is chosen: the second
       pass over a long page runs in document order, so without this the slot
       near the top could take the painting already at the foot — which it
       would not learn about until it had passed it. */
    els.forEach(function (el) {
      var had = el.getAttribute('data-plate-picked');
      if (had) used[had] = true;
    });
    return els.reduce(function (chain, el) {
      return chain.then(function (acc) {
        return dress(el, used).then(function (r) { acc.push(r); return acc; });
      });
    }, Promise.resolve([]));
  }

  /* What is installed and what is still wanted. The Guide reports this, so
     the answer comes from probing the directory rather than from a list
     someone has to remember to update — the same reason the backup stopped
     keeping a list of keys. */
  function inventory() {
    var bases = Object.keys(CATALOGUE);
    return Promise.all(bases.map(probe)).then(function (urls) {
      return bases.map(function (base, i) {
        var a = CATALOGUE[base];
        return {
          base: base, url: urls[i], have: !!urls[i],
          title: a.title, who: a.who, year: a.year,
          from: a.from || null, plate: a.plate || null,
          /* Straight off the entry. This used to be worked out from the file
             name and a hardcoded list of the Polish ones, which meant every
             painting added landed in "American" by default and silently. */
          group: a.group || 'american',
          file: base + '.jpg'
        };
      });
    });
  }

  /* ── the break, dressed by this file rather than by each page ──────────
     A picture at the foot of a page needs eight lines of CSS, and there are
     fourteen stylesheets on this site — six pages carry hub.css and the rest
     each have their own, which is how the Rest page ended up with a slot in
     its markup, a painting on disk, and no rule anywhere to draw it. So the
     class travels with the code that fills it: put
     `<div class="plate-break" data-plate-rotate="anatomy"></div>` at the end
     of any page and it works, hub.css or no hub.css.

     Neutral colours on purpose — this sheet is shared by fourteen palettes
     and must not assume any of them. */
  /* THE SIZE IS THE WHOLE PROBLEM. A plate sized by the text column looks
     right until the picture is a portrait: Maclise's plates are taller than
     they are wide, so 34rem of column became nearly 900px of painting — a
     full laptop screen — and at browser zoom it became two. A picture you
     have to scroll past is not a break in the page, it is an obstacle.

     So the height is capped against the VIEWPORT and the width follows from
     it: about a quarter of the screen tall whatever the picture's shape, and
     never wider than the column or 32rem. Because the cap is in vh it
     survives zoom — a quarter of the screen is a quarter of the screen at
     any magnification — with a floor and a ceiling in px so it stays a
     picture rather than a thumbnail on a short window or a poster on a tall
     one. The width follows the true aspect ratio, so nothing is cropped to
     fit: a tall plate simply comes out narrow. */
  var BREAK_CSS =
    '.plate-break{display:none;--plate-h:clamp(150px,26vh,300px);margin:40px auto 12px;' +
      'width:min(100%,32rem,calc(var(--plate-h) * var(--plate-ar-true,1.333)));}' +
    '.plate-break.has-plate{display:block;}' +
    '.plate-break.has-plate::before{content:"";display:block;' +
      'aspect-ratio:var(--plate-ar-true,4/3);max-height:var(--plate-h);' +
      'background-image:var(--plate-figure);' +
      'background-size:cover;background-position:center;' +
      'border:1px solid rgba(127,110,80,.34);box-shadow:0 2px 10px rgba(20,16,10,.13);}' +
    '.plate-break .plate-cap{display:block;margin-top:8px;text-align:center;' +
      'font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10.5px;' +
      'letter-spacing:.06em;color:#8A8B82;line-height:1.45;}' +
    '@media print{.plate-break{display:none!important;}}';

  /* ── one at the end is one you never see ───────────────────────────────
     The Plan is eleven thousand pixels tall. A single plate at the foot of it
     is a picture nobody will ever scroll to, which is the same as not having
     one — and it is why the only painting anybody could find on a laptop was
     the small one in the margin.

     So a long page gets its plates spread through it, at the boundaries it
     already has: roughly one every three screens, to a maximum of four, each
     placed before a top-level section rather than in the middle of one. They
     rotate independently, so a page shows several different pictures rather
     than the same one four times.

     Deliberately timid about where it will do this. Only into a block-level
     parent (never a grid or a flex row, where an extra child moves
     everything), only before a child that is in the normal flow and actually
     has height, and only when the page is more than three screens long. If
     any of that does not hold it does nothing at all and the foot plate is
     what you get. */
  function spread() {
    try {
      var seed = document.querySelector('.plate-break');
      if (!seed || !seed.parentNode || seed.getAttribute('data-plate-extra')) return;
      var parent = seed.parentNode;
      if (getComputedStyle(parent).display !== 'block') return;

      var vh = window.innerHeight || 800;
      var docH = document.documentElement.scrollHeight;
      var want = Math.min(4, Math.floor(docH / (vh * 3)) - 1);
      if (want < 1) return;
      if (document.querySelectorAll('.plate-break[data-plate-extra]').length >= want) return;

      var slot = seed.getAttribute('data-plate-slot') || 'foot';
      var want_group = seed.getAttribute('data-plate-rotate') || 'any';
      var gap = docH / (want + 1);

      /* WHERE THE PAGE ACTUALLY DIVIDES. On a folded page — the Plan, the
         Money page — <main> holds a handful of panels and one of them is the
         whole eleven thousand pixels, so its own children are all in the
         first screen and there is nothing to insert between. Descend into
         the tall one until the boundaries span the page, then stop. */
      var usable = function (el) {
        return Array.prototype.filter.call(el.children, function (k) {
          if (k === seed || k.classList.contains('plate-break')) return false;
          var cs = getComputedStyle(k);
          if (cs.position === 'fixed' || cs.position === 'absolute' || cs.display === 'none') return false;
          return k.getBoundingClientRect().height > 40;
        });
      };
      var scan = parent, kids = usable(scan);
      for (var depth = 0; depth < 3; depth++) {
        var last = kids.length ? kids[kids.length - 1].getBoundingClientRect().top + (window.pageYOffset || 0) : 0;
        if (kids.length >= 3 && last > docH * 0.45) break;
        var tallest = kids.slice().sort(function (a, b) {
          return b.getBoundingClientRect().height - a.getBoundingClientRect().height;
        })[0];
        if (!tallest || getComputedStyle(tallest).display !== 'block') break;
        var deeper = usable(tallest);
        if (deeper.length < 3) break;
        scan = tallest; kids = deeper;
      }
      parent = scan;
      var made = 0;
      for (var n = 1; n <= want; n++) {
        var mark = gap * n;
        for (var i = 0; i < kids.length; i++) {
          var top = kids[i].getBoundingClientRect().top + (window.pageYOffset || 0);
          if (top < mark) continue;
          if (kids[i].previousElementSibling &&
              kids[i].previousElementSibling.classList.contains('plate-break')) break;
          var el2 = document.createElement('div');
          el2.className = 'plate-break';
          el2.setAttribute('data-plate-extra', '1');
          el2.setAttribute('data-plate-cap', '1');
          el2.setAttribute('data-plate-slot', slot + '-' + n);
          el2.setAttribute('data-plate-rotate', want_group);
          parent.insertBefore(el2, kids[i]);
          made++;
          break;
        }
      }
      if (made) dressAll();
    } catch (e) {}
  }

  function styleOnce() {
    try {
      if (document.getElementById('plate-break-css')) return;
      var st = document.createElement('style');
      st.id = 'plate-break-css';
      st.textContent = BREAK_CSS;
      (document.head || document.documentElement).appendChild(st);
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      styleOnce(); dressAll().then(spread);
    });
  } else {
    styleOnce();
    dressAll().then(spread);
  }

  /* A PAGE THAT DRAWS ITSELF AFTER LOAD. The design-canvas pages — the Grind
     board, Today, the Life Log — render their whole body from React once the
     runtime has booted, which is after this file has run and long after
     DOMContentLoaded. A slot inside one of them was never dressed: the plate
     was in the markup, the file was in plates/, and nothing appeared. Worse,
     every re-render replaces the node, taking the dressing with it.

     So new slots are watched for. Only ADDED nodes carrying data-plate are
     reacted to, and dressing one adds a caption that carries none, so this
     cannot feed itself. */
  if (window.MutationObserver && document.documentElement) {
    var queued = false;
    var soon = function () {
      if (queued) return;
      queued = true;
      setTimeout(function () { queued = false; styleOnce(); dressAll().then(spread); }, 60);
    };
    new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var added = recs[i].addedNodes || [];
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if ((n.hasAttribute && n.hasAttribute('data-plate')) ||
              (n.querySelector && n.querySelector('[data-plate]'))) { soon(); return; }
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  window.Plates = {
    spread: spread,
    catalogue: CATALOGUE,
    dir: DIR,
    rotation: rotation, inGroup: inGroup, dayNumber: dayNumber,
    caption: fullCap,
    dress: dress,
    dressAll: dressAll,
    inventory: inventory
  };
})();
