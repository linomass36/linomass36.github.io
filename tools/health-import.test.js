/* ─────────────────────────────────────────────────────────────
   health-import.test.js — a Health Auto Export file lands.

   Run with `node tools/health-import.test.js` from the repo root. Nothing to
   install: health-data.js is a plain script, run here in a vm context with a
   window and a localStorage stub, the same way day-boundary.test.js does it.

   What is being pinned is the shape of a real export, because every one of
   these failed silently. Health Auto Export stamps each sample `start` and
   `end` — there is no `date` field — and the importer read `date`, so every
   sample of every mapped metric parsed to null and was dropped. Nothing threw.
   The panel reported success. A week of readings became one row dated
   1970-01-01, because new Date(null) is the epoch rather than Invalid Date.

   Sleep is the other half: it arrives as hourly SEGMENTS with `asleep` and
   `totalSleep` left at 0 and the real minutes in core/deep/rem, so the night
   has to be summed rather than assigned, or the last hour overwrites it.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

function load(store) {
  const mem = Object.assign({}, store || {});
  const ctx = { window: {}, console, Date, JSON, Object, Array, Math, String, Number,
    parseFloat, parseInt, isNaN, isFinite, RegExp, Error,
    localStorage: { getItem: (k) => (k in mem ? mem[k] : null),
                    setItem: (k, v) => { mem[k] = String(v); },
                    removeItem: (k) => { delete mem[k]; } } };
  ctx.globalThis = ctx; ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'health-data.js'), 'utf8'), ctx,
                  { filename: 'health-data.js' });
  ctx.__mem = mem;
  return ctx;
}

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);

/* An export in the shape Health Auto Export actually writes: `start`/`end`
   on every sample, an offset with no colon, and sleep in hourly pieces. */
const hae = {
  data: {
    metrics: [
      { name: 'step_count', units: 'count', data: [
        { start: '2026-08-24 09:00:00 -0700', end: '2026-08-24 09:59:59 -0700', qty: 1200, sources: '' },
        { start: '2026-08-24 10:00:00 -0700', end: '2026-08-24 10:59:59 -0700', qty: 800,  sources: '' },
        { start: '2026-08-25 09:00:00 -0700', end: '2026-08-25 09:59:59 -0700', qty: 500,  sources: '' }
      ] },
      { name: 'heart_rate', units: 'count/min', data: [
        { start: '2026-08-24 09:00:00 -0700', end: '2026-08-24 09:59:59 -0700', Avg: 70, Min: 58, Max: 96 },
        { start: '2026-08-24 12:00:00 -0700', end: '2026-08-24 12:59:59 -0700', Avg: 90, Min: 62, Max: 130 }
      ] },
      { name: 'sleep_analysis', units: 'hr', data: [
        { start: '2026-08-24 23:00:00 -0700', end: '2026-08-24 23:59:59 -0700',
          asleep: 0, totalSleep: 0, inBed: 0, core: 0.5, deep: 0.4, rem: 0 },
        { start: '2026-08-25 00:00:00 -0700', end: '2026-08-25 00:59:59 -0700',
          asleep: 0, totalSleep: 0, inBed: 0, core: 1.0, deep: 0.0, rem: 0.0 },
        { start: '2026-08-25 01:00:00 -0700', end: '2026-08-25 01:59:59 -0700',
          asleep: 0, totalSleep: 0, inBed: 0, core: 0.1, deep: 0.0, rem: 0.6 }
      ] }
    ],
    workouts: []
  }
};

group('A Health Auto Export file lands');
{
  const H = load().window.Health;
  const rep = H.ingest(JSON.stringify(hae), 'test');
  ok(rep.ok, 'the import reports success');
  ok(rep.days >= 2, 'more than one day lands (' + rep.days + ')');
  ok(rep.error === '', 'and says nothing went wrong');
}

group('Samples are stamped start, not date');
{
  const ctx = load();
  ctx.window.Health.ingest(JSON.stringify(hae), 'test');
  const days = JSON.parse(ctx.__mem.ct_health_v1).days;
  const keys = Object.keys(days).sort();
  ok(keys.indexOf('1970-01-01') < 0, 'nothing lands on the epoch');
  ok(keys.length >= 2, 'the days are separate, not collapsed into one');
  const d24 = days['2026-08-24'] || {};
  ok(d24.steps === 2000, 'the day\'s steps are summed (' + d24.steps + ')');
  ok(d24.hr === 80, 'heart rate averages its samples (' + d24.hr + ')');
}

group('Sleep segments are summed into a night');
{
  const ctx = load();
  ctx.window.Health.ingest(JSON.stringify(hae), 'test');
  const days = JSON.parse(ctx.__mem.ct_health_v1).days;
  const night = Object.keys(days).map((k) => days[k].sleep).filter(Boolean)[0];
  ok(!!night, 'a night is stored');
  ok(night.segments === 3, 'all three segments counted, not just the last');
  ok(Math.abs(night.core - 1.6) < 0.01, 'core is the sum (' + night.core + ')');
  ok(Math.abs(night.rem - 0.6) < 0.01, 'rem is the sum (' + night.rem + ')');
  /* The export left asleep and totalSleep at 0, so the stages have to answer
     for it — otherwise a night reads as no sleep at all. */
  ok(Math.abs(night.asleep - 2.6) < 0.01,
     'asleep falls back to core+deep+rem when the export says 0 (' + night.asleep + ')');
}

group('A Shortcut payload still works');
{
  /* anki_sync.py and the Shortcut send `date`, which must keep winning. */
  const ctx = load();
  const rep = ctx.window.Health.ingest({ data: { metrics: [
    { name: 'step_count', units: 'count',
      data: [{ date: '2026-08-26 09:00:00 +0200', qty: 1500 }] },
    { name: 'sleep_analysis', units: 'hr', data: [{ date: '2026-08-26', asleep: 7.4, core: 4, deep: 1.2, rem: 2.2 }] }
  ] } }, 'shortcut');
  ok(rep.ok && rep.days === 1, 'a date-stamped payload still lands');
  const days = JSON.parse(ctx.__mem.ct_health_v1).days;
  ok(days['2026-08-26'].steps === 1500, 'its samples are read');
  ok(days['2026-08-26'].sleep.asleep === 7.4,
     'a stated asleep figure is kept, not replaced by the stage sum');
}

group('Nothing fails silently');
{
  const H = load().window.Health;
  const noDate = H.ingest({ data: { metrics: [{ name: 'step_count', data: [{ qty: 5 }] }] } }, 't');
  ok(!noDate.ok && /no readable date/.test(noDate.error),
     'samples with no timestamp say so rather than reporting nothing');
  const unmapped = H.ingest({ data: { metrics: [
    { name: 'zzz_nonsense', data: [{ start: '2026-08-26 09:00:00 +0200', qty: 5 }] }] } }, 't');
  ok(!unmapped.ok && /has a home/.test(unmapped.error),
     'a file of unmapped metrics names them');
  ok(H.ingest('{not json', 't').error !== '', 'malformed JSON is reported');
  ok(H.ingest({}, 't').error !== '', 'an empty payload is reported');
}

group('Re-importing the same file does not double a day');
{
  const ctx = load();
  ctx.window.Health.ingest(JSON.stringify(hae), 'test');
  ctx.window.Health.ingest(JSON.stringify(hae), 'test');
  const days = JSON.parse(ctx.__mem.ct_health_v1).days;
  ok(days['2026-08-24'].steps === 2000,
     'the day is rebuilt from its samples, not added to (' + days['2026-08-24'].steps + ')');
}

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
