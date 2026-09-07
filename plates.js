/* plates.js — the paintings, when they are there.

   The brief asks for Matejko, Chelmonski, the Hudson River School and Eakins
   on these pages. The machine that built this hub has no route to Wikimedia
   or to any museum's open-access API — every image host answers 403 at the
   gateway — so the files could not be fetched and written in. What is here
   instead is the other half of that job: the site adopts the paintings by
   itself the moment the files exist.

   Drop `gross-clinic.jpg` into plates/ and The Plan carries The Gross Clinic,
   captioned, in the margin. Nothing to edit. Take the file away again and the
   drawn engraving comes back. That is the whole contract.

   A slot asks for paintings in order of preference:

     <div class="hub-marginal hub-plate" data-plate="gross-clinic agnew-clinic">

   The first name whose file is installed wins. If none is, the element keeps
   the engraved figure hub.css draws for it and nothing looks unfinished.  */
(function () {
  'use strict';

  /* Every one is public domain: the painters have been dead well over a
     century, so there is no licence to honour and nothing to attribute
     beyond good manners. The captions below are the good manners. */
  var CATALOGUE = {
    'gross-clinic':        { title: 'The Gross Clinic',   who: 'Thomas Eakins',     year: 1875 },
    'agnew-clinic':        { title: 'The Agnew Clinic',   who: 'Thomas Eakins',     year: 1889 },
    'matejko-stanczyk':    { title: 'Stańczyk',      who: 'Jan Matejko',       year: 1862 },
    'matejko-grunwald':    { title: 'Battle of Grunwald', who: 'Jan Matejko',       year: 1878 },
    'matejko-rejtan':      { title: 'Rejtan',             who: 'Jan Matejko',       year: 1866 },
    'chelmonski-czworka':  { title: 'Czwórka',       who: 'Józef Chełmoński', year: 1881 },
    'chelmonski-autumn':   { title: 'Indian Summer',      who: 'Józef Chełmoński', year: 1875 },
    'church-andes':        { title: 'The Heart of the Andes', who: 'Frederic Edwin Church', year: 1859 },
    'bierstadt-rockies':   { title: "The Rocky Mountains, Lander's Peak", who: 'Albert Bierstadt', year: 1863 },
    'cole-oxbow':          { title: 'The Oxbow',          who: 'Thomas Cole',       year: 1836 },
    'vesalius-fabrica':    { title: 'De humani corporis fabrica', who: 'Andreas Vesalius', year: 1543 }
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

  function caption(hit) {
    var a = hit.art;
    if (!a) return hit.base;
    return a.who + ', ' + a.title + ', ' + a.year;
  }

  /* Dress one slot. The engraving stays until a painting is actually loaded,
     so a slow file never leaves an empty box on the page. */
  function dress(el) {
    var names = (el.getAttribute('data-plate') || '').split(/\s+/).filter(Boolean);
    if (!names.length) return Promise.resolve(false);

    return pick(names).then(function (hit) {
      if (!hit) return false;
      el.style.setProperty('--plate-figure', 'url("' + hit.url + '")');
      el.classList.add('has-plate');
      el.setAttribute('title', caption(hit));

      /* A picture with a name on it is content, not decoration. */
      if (el.getAttribute('aria-hidden') === 'true') el.removeAttribute('aria-hidden');
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', caption(hit));

      if (el.classList.contains('hub-marginal') && !el.querySelector('.plate-cap')) {
        var cap = document.createElement('span');
        cap.className = 'plate-cap';
        cap.textContent = caption(hit);
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

  window.Plates = {
    catalogue: CATALOGUE,
    dir: DIR,
    dress: dress,
    dressAll: dressAll,
    inventory: inventory
  };
})();
