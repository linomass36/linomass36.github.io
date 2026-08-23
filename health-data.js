/* ─────────────────────────────────────────────────────────────────────────
   health-data.js — the body's own record, at three grains.

   Every other store in this hub keeps one row per day, and for most of what
   it tracks that is the right grain: you either ran the queue or you did
   not. The body does not work like that. "I felt sharp at four despite being
   ill" is a fact about a moment, and no daily row can hold it — a line
   reading `7.1h slept, 2400 kcal` cannot tell you what the four hours before
   four o'clock looked like, which is the only thing that could answer the
   question.

   So this keeps three grains, and they do different jobs:

     days     one rollup per date. What a glance wants: slept, ate, trained.
     events   timestamped things that happened — a meal at 13:40, a lift at
              11:00, a night that ended at 07:10. This is the grain that
              makes an antecedent computable at all.
     moments  what you felt, when you felt it. Energy, mood, focus, symptoms
              and a note, stamped to the minute.

   The whole design rests on `events`. Without it a moment is an orphan; with
   it, a moment at 16:00 can be rendered as the twelve hours that led to it,
   which is useful on the first day and needs no statistics whatever.

   ── on where the data comes from ─────────────────────────────────────────
   HealthKit cannot be read by a web page — there is no browser API, and
   there is no HealthKit on macOS either. Something on the phone has to
   extract, and then hand the file over. This file therefore refuses to care
   which one did: `ingest` sniffs the shape and normalises. Health Auto
   Export's JSON is the shape it knows best; a plainer object written by a
   Shortcut works too. If one route stops being available the page does not
   change, which is the point of normalising here rather than at the door.

   ── on not lying about patterns ──────────────────────────────────────────
   Correlating a dozen features against a handful of moments will produce a
   "finding" every week, and every one of them will be noise. Three rules are
   enforced in code rather than left to the reader:

     · A feature must be strictly ANTECEDENT. Whole-day totals are excluded
       from the pattern table on purpose — step count for the day includes
       the hours after the moment, so it leaks the future into the past and
       any correlation it produces is partly circular.
     · Nothing is shown until there are CORR_MIN moments carrying it. The
       precedent is systems.js, which already gates its trends the same way.
     · A standing condition is carried as a feature of its own, because it is
       the most likely explanation of any pattern found during a bad week and
       ought to be visible competing with the others rather than hiding.

   Stored under ct_health_v1. archive.js splits it, sync.js carries it.
   ───────────────────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  var KEY = 'ct_health_v1';

  /* The same gate systems.js uses for its own correlations. One number, one
     meaning, in both places. */
  var CORR_MIN = 8;

  /* A correlation below this is not worth a sentence, however many moments
     stand behind it. Deliberately high: with ten features on n≈10, the
     largest |r| in a table of pure noise lands around 0.5 more often than
     anyone expects. */
  var STRONG = 0.45;

  /* ── the metric map ──────────────────────────────────────────────────────
     Health Auto Export names its metrics for humans ("Resting Heart Rate"),
     so the key is the name with everything but letters and digits removed —
     which survives the punctuation and capitalisation drifting between app
     versions. `agg` says how a day's samples combine; `event` marks the ones
     that are punctate enough to be worth keeping as their own timestamped
     record rather than only a daily total. */
  var METRICS = {
    dietaryenergy:      { field: 'kcal',      agg: 'sum',  meal: true,  label: 'calories' },
    protein:            { field: 'protein',   agg: 'sum',  meal: true,  label: 'protein' },
    carbohydrates:      { field: 'carbs',     agg: 'sum',  meal: true,  label: 'carbs' },
    totalfat:           { field: 'fat',       agg: 'sum',  meal: true,  label: 'fat' },
    fiber:              { field: 'fibre',     agg: 'sum',  meal: true,  label: 'fibre' },
    dietarysugar:       { field: 'sugar',     agg: 'sum',  meal: true,  label: 'sugar' },
    dietarywater:       { field: 'water',     agg: 'sum',               label: 'water' },
    water:              { field: 'water',     agg: 'sum',               label: 'water' },
    dietarycaffeine:    { field: 'caffeine',  agg: 'sum',  event: 'caffeine', label: 'caffeine' },
    caffeine:           { field: 'caffeine',  agg: 'sum',  event: 'caffeine', label: 'caffeine' },
    stepcount:          { field: 'steps',     agg: 'sum',               label: 'steps' },
    activeenergy:       { field: 'activeKcal', agg: 'sum',              label: 'active energy' },
    appleexercisetime:  { field: 'exerciseMin', agg: 'sum',             label: 'exercise minutes' },
    weightbodymass:     { field: 'weight',    agg: 'last',              label: 'weight' },
    weight:             { field: 'weight',    agg: 'last',              label: 'weight' },
    bodyfatpercentage:  { field: 'bodyFat',   agg: 'last',              label: 'body fat' },
    restingheartrate:   { field: 'rhr',       agg: 'avg',               label: 'resting HR' },
    heartratevariability: { field: 'hrv',     agg: 'avg',               label: 'HRV' },
    respiratoryrate:    { field: 'respRate',  agg: 'avg',               label: 'respiratory rate' },
    bloodoxygen:        { field: 'spo2',      agg: 'avg',               label: 'blood oxygen' },
    vo2max:             { field: 'vo2',       agg: 'last',              label: 'VO₂ max' },
    mindfulminutes:     { field: 'mindfulMin', agg: 'sum',              label: 'mindful minutes' }
  };

  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

  /* ── time ────────────────────────────────────────────────────────────────
     Health Auto Export stamps its samples "2026-08-23 10:30:00 Z" — a space
     where ISO 8601 wants a T, and an offset that may be bare. Safari and
     Chrome disagree about that string, and the disagreement shows up as
     Invalid Date rather than as an error, so it would sit in the store for a
     month before anyone noticed. Parse it explicitly. */
  var TS_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/;

  function parseTs(s) {
    if (typeof s === 'number' && isFinite(s)) return s;
    var m = TS_RE.exec(String(s || '').trim());
    if (!m) { var t = Date.parse(s); return isNaN(t) ? null : t; }
    var iso = m[1] + '-' + m[2] + '-' + m[3] +
              'T' + (m[4] || '00') + ':' + (m[5] || '00') + ':' + (m[6] || '00');
    var tz = m[7];
    if (tz) iso += tz === 'Z' ? 'Z' : (tz.indexOf(':') > 0 ? tz : tz.slice(0, 3) + ':' + tz.slice(3));
    var v = Date.parse(iso);
    return isNaN(v) ? null : v;
  }

  // The local date a timestamp belongs to. Local, because a day is a thing
  // you live in, not a UTC window.
  function dayOf(ms) {
    var d = new Date(ms);
    if (isNaN(d)) return null;
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }
  function today() { return dayOf(Date.now()); }
  function num(v) { var n = typeof v === 'object' && v ? +v.qty : +v; return isFinite(n) ? n : null; }

  /* ── the store ───────────────────────────────────────────────────────────
     Every read is defensive; a page that throws on a malformed store is a
     page you cannot use to fix the store. */
  function blank() { return { days: {}, events: [], moments: [], meta: {} }; }

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY));
      if (!v || typeof v !== 'object') return blank();
      return {
        days: (v.days && typeof v.days === 'object') ? v.days : {},
        events: Array.isArray(v.events) ? v.events : [],
        moments: Array.isArray(v.moments) ? v.moments : [],
        meta: (v.meta && typeof v.meta === 'object') ? v.meta : {}
      };
    } catch (e) { return blank(); }
  }

  function write(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); return true; }
    catch (e) { return false; }
  }

  /* ── ingest ──────────────────────────────────────────────────────────────
     Sniffs the shape rather than being told it. Returns a report, because an
     import that silently does nothing is the worst possible outcome and the
     page has to be able to say what landed.

     Unrecognised metrics are counted and NAMED rather than dropped quietly:
     the map above will always trail whatever the exporter learns to emit,
     and the only way that gets fixed is if the page says out loud that
     "Blood Glucose" arrived and went nowhere. */
  function ingest(raw, src) {
    var rep = { days: 0, events: 0, moments: 0, dupes: 0, unknown: [], from: src || 'import', ok: false, error: '' };
    var payload = raw;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); }
      catch (e) { rep.error = 'that is not JSON the hub can read'; return rep; }
    }
    if (!payload || typeof payload !== 'object') { rep.error = 'nothing to import'; return rep; }

    // Health Auto Export wraps everything in `data`; a Shortcut may not.
    var body = (payload.data && typeof payload.data === 'object') ? payload.data : payload;
    var store = read();

    var metrics  = Array.isArray(body.metrics) ? body.metrics : [];
    var workouts = Array.isArray(body.workouts) ? body.workouts : [];
    var symptoms = Array.isArray(body.symptoms) ? body.symptoms : [];
    var minds    = Array.isArray(body.stateOfMind) ? body.stateOfMind : [];

    if (!metrics.length && !workouts.length && !symptoms.length && !minds.length &&
        !body.days && !body.moments) {
      rep.error = 'no metrics, workouts or moments in that file';
      return rep;
    }

    var touched = {};
    function day(k) {
      if (!k) return null;
      touched[k] = true;
      if (!store.days[k]) store.days[k] = {};
      return store.days[k];
    }

    // Sums need to survive re-import, so an aggregate is rebuilt from the
    // samples of that day rather than added to what is already there.
    var sums = {};   // day → field → { total, n, last }
    function collect(k, field, v, agg) {
      if (v == null) return;
      var b = (sums[k] = sums[k] || {});
      var f = (b[field] = b[field] || { total: 0, n: 0, last: null, agg: agg });
      f.total += v; f.n++; f.last = v;
    }

    var nutrition = [];   // for clustering into meals

    metrics.forEach(function (m) {
      var name = slug(m && m.name);
      var pts = (m && Array.isArray(m.data)) ? m.data : [];

      if (name === 'sleepanalysis') {
        pts.forEach(function (p) {
          var k = (typeof p.date === 'string' && p.date.length >= 10) ? p.date.slice(0, 10) : dayOf(parseTs(p.date));
          var dd = day(k);
          if (!dd) return;
          var start = parseTs(p.sleepStart || p.inBedStart);
          var end   = parseTs(p.sleepEnd || p.inBedEnd);
          dd.sleep = {
            asleep: num(p.asleep) != null ? num(p.asleep) : num(p.totalSleep),
            total: num(p.totalSleep), inBed: num(p.inBed),
            core: num(p.core), deep: num(p.deep), rem: num(p.rem), awake: num(p.awake),
            start: start, end: end
          };
          /* A night is an event as well as a rollup: "how long ago did you
             get up" is antecedent to everything that happens after it. */
          if (end) pushEvent(store, {
            id: 'sleep|' + k, ts: end, kind: 'sleep', name: 'woke',
            dur: dd.sleep.asleep != null ? dd.sleep.asleep * 60 : null,
            v: { asleep: dd.sleep.asleep, deep: dd.sleep.deep, rem: dd.sleep.rem, start: start },
            src: src || 'import'
          }, rep);
          return;
        });
        return;
      }

      var def = METRICS[name];
      if (!def) {
        if (pts.length && rep.unknown.indexOf(m.name) < 0) rep.unknown.push(m.name);
        return;
      }
      pts.forEach(function (p) {
        var ts = parseTs(p.date), v = num(p.qty != null ? p.qty : p.Avg != null ? p.Avg : p.avg);
        if (ts == null || v == null) return;
        var k = dayOf(ts);
        day(k);
        collect(k, def.field, v, def.agg);
        if (m.units && !store.meta.units) store.meta.units = {};
        if (m.units) (store.meta.units || (store.meta.units = {}))[def.field] = m.units;
        if (def.meal) nutrition.push({ ts: ts, field: def.field, v: v });
        if (def.event) pushEvent(store, {
          id: def.event + '|' + Math.round(ts / 60000), ts: ts, kind: def.event,
          name: def.label, v: { qty: v, units: m.units || '' }, src: src || 'import'
        }, rep);
      });
    });

    // Apply the day aggregates.
    Object.keys(sums).forEach(function (k) {
      var dd = day(k);
      Object.keys(sums[k]).forEach(function (field) {
        var f = sums[k][field];
        dd[field] = f.agg === 'avg' ? Math.round((f.total / f.n) * 10) / 10
                  : f.agg === 'last' ? f.last
                  : Math.round(f.total * 10) / 10;
      });
    });

    /* Meals, reconstructed. Fitatu writes one sample per nutrient per entry,
       all stamped within a minute of each other, so a meal is a cluster in
       time rather than a record of its own. Ten minutes is wide enough to
       hold a plate logged item by item and narrow enough not to swallow
       lunch into breakfast. */
    nutrition.sort(function (a, b) { return a.ts - b.ts; });
    var cluster = null;
    nutrition.forEach(function (s) {
      if (!cluster || s.ts - cluster.ts > 10 * 60000) {
        if (cluster) emitMeal(store, cluster, src, rep);
        cluster = { ts: s.ts, v: {} };
      }
      cluster.v[s.field] = (cluster.v[s.field] || 0) + s.v;
    });
    if (cluster) emitMeal(store, cluster, src, rep);

    workouts.forEach(function (wo) {
      var start = parseTs(wo.start), end = parseTs(wo.end);
      if (start == null) return;
      day(dayOf(start));
      pushEvent(store, {
        id: 'workout|' + (wo.id || (slug(wo.name) + '|' + Math.round(start / 60000))),
        ts: start, kind: 'workout', name: wo.name || 'workout',
        dur: num(wo.duration) != null ? num(wo.duration) : (end ? Math.round((end - start) / 1000) : null),
        v: {
          km: num(wo.distance), kcal: num(wo.activeEnergyBurned) != null ? num(wo.activeEnergyBurned) : num(wo.totalEnergy),
          hrAvg: wo.heartRate ? num(wo.heartRate.avg) : null,
          hrMax: wo.heartRate ? num(wo.heartRate.max) : null,
          end: end
        },
        src: src || 'import'
      }, rep);
    });

    // Health's own symptom log, which saves typing the part it already knows.
    symptoms.forEach(function (s) {
      var ts = parseTs(s.start || s.date);
      if (ts == null) return;
      day(dayOf(ts));
      pushEvent(store, {
        id: 'symptom|' + slug(s.name) + '|' + Math.round(ts / 60000), ts: ts, kind: 'symptom',
        name: s.name || 'symptom', v: { severity: s.severity || '' }, src: src || 'import'
      }, rep);
    });

    /* State of Mind is Apple's own momentary mood log. It is a moment by any
       other name, so it lands as one — flagged by source so it is never
       confused with something you sat down and wrote. */
    minds.forEach(function (s) {
      var ts = parseTs(s.start || s.date);
      if (ts == null) return;
      var valence = num(s.valence);          // −1 … +1
      var id = 'mind|' + Math.round(ts / 60000);
      if (store.moments.some(function (x) { return x.id === id; })) { rep.dupes++; return; }
      store.moments.push({
        id: id, ts: ts,
        mood: valence == null ? null : Math.round((valence + 1) * 2) + 1,   // → 1..5
        energy: null, focus: null,
        symptoms: [], tags: (s.labels || s.associations || []).slice(0, 6),
        note: '', src: 'health'
      });
      rep.moments++;
    });

    // A re-import of the hub's own export, or a Shortcut writing hub shape.
    if (body.days && typeof body.days === 'object') {
      Object.keys(body.days).forEach(function (k) {
        var dd = day(k), inc = body.days[k] || {};
        Object.keys(inc).forEach(function (f) { if (inc[f] != null) dd[f] = inc[f]; });
      });
    }
    if (Array.isArray(body.moments)) {
      body.moments.forEach(function (m) {
        if (!m || m.ts == null) return;
        if (store.moments.some(function (x) { return x.id === m.id; })) { rep.dupes++; return; }
        store.moments.push(m); rep.moments++;
      });
    }

    store.events.sort(function (a, b) { return a.ts - b.ts; });
    store.moments.sort(function (a, b) { return a.ts - b.ts; });
    store.meta.lastImport = Date.now();
    store.meta.lastSource = src || 'import';
    rep.days = Object.keys(touched).length;
    rep.ok = write(store);
    if (!rep.ok) rep.error = 'the browser refused to store that — the file may be too large';
    return rep;
  }

  function emitMeal(store, c, src, rep) {
    if (!c.v.kcal && !c.v.protein && !c.v.carbs && !c.v.fat) return;
    pushEvent(store, {
      id: 'meal|' + Math.round(c.ts / 60000), ts: c.ts, kind: 'meal', name: 'meal',
      v: c.v, src: src || 'import'
    }, rep);
  }

  // Newer wins on a re-import: the same id arriving again replaces rather
  // than duplicates, so overlapping export windows are harmless.
  function pushEvent(store, ev, rep) {
    for (var i = 0; i < store.events.length; i++) {
      if (store.events[i].id === ev.id) { store.events[i] = ev; if (rep) rep.dupes++; return; }
    }
    store.events.push(ev);
    if (rep) rep.events++;
  }

  /* ── moments ─────────────────────────────────────────────────────────── */
  function logMoment(m) {
    var store = read();
    var ts = m && m.ts != null ? m.ts : Date.now();
    var rec = {
      id: 'm|' + ts + '|' + Math.random().toString(36).slice(2, 7),
      ts: ts,
      energy: m.energy != null ? +m.energy : null,
      mood: m.mood != null ? +m.mood : null,
      focus: m.focus != null ? +m.focus : null,
      symptoms: Array.isArray(m.symptoms) ? m.symptoms.slice() : [],
      tags: Array.isArray(m.tags) ? m.tags.slice() : [],
      note: (m.note || '').slice(0, 2000),
      src: 'me'
    };
    store.moments.push(rec);
    store.moments.sort(function (a, b) { return a.ts - b.ts; });
    write(store);
    return rec;
  }

  function removeMoment(id) {
    var store = read();
    store.moments = store.moments.filter(function (m) { return m.id !== id; });
    write(store);
    return store.moments;
  }

  function moments() { return read().moments.slice().sort(function (a, b) { return b.ts - a.ts; }); }
  function events() { return read().events; }
  function days() { return read().days; }
  function meta() { return read().meta; }

  /* ── the antecedent window ───────────────────────────────────────────────
     Everything a moment could have been caused by, and nothing it could not.
     Each value is computed from records strictly BEFORE the moment; a
     whole-day total would include the hours after it and quietly turn the
     arrow of time around. */
  var H = 3600000;

  function featuresAt(ts, store) {
    store = store || read();
    var ev = store.events, f = {};
    var before = ev.filter(function (e) { return e.ts <= ts; });

    function lastOf(kind, withinH) {
      for (var i = before.length - 1; i >= 0; i--) {
        if (before[i].kind !== kind) continue;
        if (withinH && ts - before[i].ts > withinH * H) return null;
        return before[i];
      }
      return null;
    }
    function sumSince(kind, hours, pick) {
      var cut = ts - hours * H, t = 0, any = false;
      before.forEach(function (e) {
        if (e.kind !== kind || e.ts < cut) return;
        var v = pick(e);
        if (v != null) { t += v; any = true; }
      });
      return any ? Math.round(t * 10) / 10 : (kind === 'caffeine' || kind === 'meal' ? 0 : null);
    }

    var sleep = lastOf('sleep', 24);
    f.sleepH   = sleep && sleep.v.asleep != null ? Math.round(sleep.v.asleep / 6) / 10 : null;
    f.deepH    = sleep && sleep.v.deep != null ? Math.round(sleep.v.deep / 6) / 10 : null;
    f.remH     = sleep && sleep.v.rem != null ? Math.round(sleep.v.rem / 6) / 10 : null;
    f.awakeH   = sleep ? Math.round((ts - sleep.ts) / H * 10) / 10 : null;

    var meal = lastOf('meal', 24);
    f.sinceMealH = meal ? Math.round((ts - meal.ts) / H * 10) / 10 : null;
    f.kcal6h     = sumSince('meal', 6, function (e) { return e.v.kcal; });
    f.protein6h  = sumSince('meal', 6, function (e) { return e.v.protein; });
    f.carbs6h    = sumSince('meal', 6, function (e) { return e.v.carbs; });
    f.caffeine8h = sumSince('caffeine', 8, function (e) { return e.v.qty; });

    var wo = lastOf('workout', 48);
    f.sinceTrainH = wo ? Math.round((ts - wo.ts) / H * 10) / 10 : null;

    /* The competing explanation, made to compete in the open. A week spent
       ill will move every other number in this table, and a pattern found
       inside it belongs to the illness until proven otherwise. */
    f.condition = 0;
    try {
      var C = w.Conditions;
      if (C && C.active().length) f.condition = 1;
    } catch (e) {}
    var sym = lastOf('symptom', 12);
    if (sym) f.condition = 1;

    return f;
  }

  /* What the twelve hours before a moment actually held, in order. The part
     of this file that earns its keep on day one, before any pattern exists. */
  function timeline(ts, hours) {
    hours = hours || 12;
    var cut = ts - hours * H;
    return read().events
      .filter(function (e) { return e.ts >= cut && e.ts <= ts; })
      .sort(function (a, b) { return a.ts - b.ts; });
  }

  /* ── patterns ────────────────────────────────────────────────────────────
     Association, gated. Reuses the hub's own pearson where systems.js is on
     the page and falls back to a local copy where it is not, so this file
     works on a page that loads nothing else. */
  /* `phrase` is the "more X" half of the sentence a row prints. It is stated
     rather than derived from the label, because deriving it produced things
     like "more since training, more energy". */
  var FEATURES = [
    { key: 'sleepH',      label: 'Hours asleep the night before',  unit: 'h',    phrase: 'more sleep' },
    { key: 'deepH',       label: 'Deep sleep the night before',    unit: 'h',    phrase: 'more deep sleep' },
    { key: 'remH',        label: 'REM the night before',           unit: 'h',    phrase: 'more REM' },
    { key: 'awakeH',      label: 'Hours awake by then',            unit: 'h',    phrase: 'longer awake' },
    { key: 'sinceMealH',  label: 'Hours since eating',             unit: 'h',    phrase: 'a longer gap since eating' },
    { key: 'kcal6h',      label: 'Calories in the last 6h',        unit: 'kcal', phrase: 'more calories recently' },
    { key: 'protein6h',   label: 'Protein in the last 6h',         unit: 'g',    phrase: 'more protein recently' },
    { key: 'carbs6h',     label: 'Carbs in the last 6h',           unit: 'g',    phrase: 'more carbs recently' },
    { key: 'caffeine8h',  label: 'Caffeine in the last 8h',        unit: 'mg',   phrase: 'more caffeine recently' },
    { key: 'sinceTrainH', label: 'Hours since training',           unit: 'h',    phrase: 'a longer gap since training' },
    { key: 'condition',   label: 'A condition was standing',       unit: '',     phrase: 'a condition standing', flag: true }
  ];

  function pearson(xs, ys) {
    var S = w.Systems;
    if (S && typeof S.pearson === 'function') return S.pearson(xs, ys);
    var n = xs.length;
    if (n < 2) return null;
    var mx = 0, my = 0, i;
    for (i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
    mx /= n; my /= n;
    var acc = 0, dx = 0, dy = 0;
    for (i = 0; i < n; i++) {
      var a = xs[i] - mx, b = ys[i] - my;
      acc += a * b; dx += a * a; dy += b * b;
    }
    var den = Math.sqrt(dx * dy);
    return den ? acc / den : null;
  }

  /* `against` is which felt score to explain: energy, mood or focus. Moments
     with no score for it are not counted — a moment logged for its note
     alone should not read as a zero. */
  function patterns(against) {
    against = against || 'energy';
    var store = read();
    var ms = store.moments.filter(function (m) { return m[against] != null; });
    var out = { against: against, n: ms.length, min: CORR_MIN, tested: 0,
                ready: ms.length >= CORR_MIN, rows: [] };
    if (!ms.length) return out;

    var feats = ms.map(function (m) { return featuresAt(m.ts, store); });
    var ys = ms.map(function (m) { return +m[against]; });

    FEATURES.forEach(function (F) {
      var xs = [], yy = [], hi = [], lo = [];
      feats.forEach(function (f, i) {
        var v = f[F.key];
        if (v == null) return;
        xs.push(v); yy.push(ys[i]);
        if (ys[i] >= 4) hi.push(v); else if (ys[i] <= 2) lo.push(v);
      });
      if (xs.length < CORR_MIN) {
        out.rows.push({ key: F.key, label: F.label, unit: F.unit, phrase: F.phrase,
                        n: xs.length, r: null, thin: true });
        return;
      }
      /* A feature that held the same value at every moment cannot correlate
         with anything, and pearson returns null for it — which is the same
         null as "no relationship" and means something completely different.
         Separate them here so the page can say which it is. */
      var flat = xs.every(function (v) { return v === xs[0]; });
      out.tested += flat ? 0 : 1;
      var r = flat ? null : pearson(xs, yy);
      out.rows.push({
        key: F.key, label: F.label, unit: F.unit, phrase: F.phrase,
        n: xs.length, r: r, flat: flat, only: flat ? xs[0] : null,
        hi: hi.length ? mean(hi) : null, lo: lo.length ? mean(lo) : null,
        nHi: hi.length, nLo: lo.length,
        strong: r != null && Math.abs(r) >= STRONG, flag: !!F.flag
      });
    });

    out.rows.sort(function (a, b) {
      return (b.r == null ? -1 : Math.abs(b.r)) - (a.r == null ? -1 : Math.abs(a.r));
    });
    out.strongest = out.rows.filter(function (r) { return r.strong; })[0] || null;
    return out;
  }

  function mean(a) { var t = 0; a.forEach(function (v) { t += v; }); return Math.round((t / a.length) * 10) / 10; }

  /* The day's rollup, with the pieces the page shows named once here so the
     page never has to know a field name. */
  function summary(k) {
    k = k || today();
    var d = read().days[k] || {};
    var sl = d.sleep || {};
    return {
      day: k, has: Object.keys(d).length > 0,
      kcal: d.kcal, protein: d.protein, carbs: d.carbs, fat: d.fat, water: d.water,
      steps: d.steps, activeKcal: d.activeKcal, weight: d.weight,
      rhr: d.rhr, hrv: d.hrv, caffeine: d.caffeine,
      sleepH: sl.asleep != null ? Math.round(sl.asleep / 6) / 10 : null,
      deepH: sl.deep != null ? Math.round(sl.deep / 6) / 10 : null,
      remH: sl.rem != null ? Math.round(sl.rem / 6) / 10 : null,
      coreH: sl.core != null ? Math.round(sl.core / 6) / 10 : null,
      sleepStart: sl.start, sleepEnd: sl.end,
      workouts: read().events.filter(function (e) {
        return e.kind === 'workout' && dayOf(e.ts) === k;
      })
    };
  }

  function clear() { write(blank()); }

  w.Health = {
    KEY: KEY, CORR_MIN: CORR_MIN, STRONG: STRONG, METRICS: METRICS, FEATURES: FEATURES,
    read: read, write: write, ingest: ingest, clear: clear,
    logMoment: logMoment, removeMoment: removeMoment,
    moments: moments, events: events, days: days, meta: meta,
    featuresAt: featuresAt, timeline: timeline, patterns: patterns, summary: summary,
    parseTs: parseTs, dayOf: dayOf, today: today
  };
})(window);
