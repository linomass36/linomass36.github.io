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
  function dress(el) {
    var names = (el.getAttribute('data-plate') || '').split(/\s+/).filter(Boolean);
    if (!names.length) return Promise.resolve(false);
    /* Already dressed — a re-render creates a new element, so this only ever
       short-circuits the one that is genuinely finished. */
    if (el.classList.contains('has-plate') &&
        el.style.getPropertyValue('--plate-figure')) return Promise.resolve(true);

    return pick(names).then(function (hit) {
      if (!hit) return false;
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

  function dressAll(root) {
    var els = (root || document).querySelectorAll('[data-plate]');
    return Promise.all(Array.prototype.map.call(els, dress));
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { dressAll(); });
  } else {
    dressAll();
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
      setTimeout(function () { queued = false; dressAll(); }, 60);
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
    catalogue: CATALOGUE,
    dir: DIR,
    caption: fullCap,
    dress: dress,
    dressAll: dressAll,
    inventory: inventory
  };
})();
