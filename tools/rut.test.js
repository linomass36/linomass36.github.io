/* ─────────────────────────────────────────────────────────────
   rut.test.js — a day the season was told about is never a day of drift.

   Run with `node tools/rut.test.js` from the repo root. Also run by the
   deploy.

   WHAT SHIPPED BROKEN, and it is the nastiest shape a bug in this hub can
   take: the page hid its own evidence.

   Systems.drift() is "days since anything was logged". At three it makes a
   floor day, the Standing prints "N days down", the board collapses to one
   ask — and the floor day's own rule skips the season checklist, because
   nine rows under a single instruction would undo the only thing a floor day
   does. That is a good rule and it was standing on a broken number: drift
   read ct_lifelog_v1 and nothing else, on the stated grounds that the Life
   Log "is the one store that gets written on any kind of day".

   The season board ended that and nothing noticed. Its nine rows write
   ct_season_v1. So a fortnight of keeping the season every evening without
   closing a single Life Log day came back as a fortnight of silence, the
   front door declared a rut, and the surface holding the ticks that
   disproved it was the one thing the rut hid. Reported, exactly, as "the
   season checklist is missing from the main page and it says I'm in a rut".

   Every assertion here DRIVES THE CLOCK — drift(now) and floorDay(now) take
   one for that reason. Per CLAUDE.md, a test that read Date.now() to decide
   what today's stores should say would pass until the date it was written
   against and then block every deploy forever.

   day.js is loaded into the context so both files key their days through
   CTDay. Without it season.js keys locally and systems.js keys in UTC, and
   this file would pass in London and fail on a runner in Auckland.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function sitemap() {
  const ctx = { window: {}, console, JSON, Object, Array, String, RegExp, Date, Math };
  ctx.globalThis = ctx; ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('sitemap.js'), ctx, { filename: 'sitemap.js' });
  return ctx.window.SITEMAP;
}

/* A hub with the stores you hand it and nothing else. season.js is loaded
   alongside systems.js exactly as a built page has them. */
function hub(stores) {
  const store = Object.assign({}, stores || {});
  const ctx = {
    console, JSON, Object, Array, String, Number, Boolean, RegExp, Date, Math, Intl,
    isNaN, isFinite, parseInt, parseFloat,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
      get length() { return Object.keys(store).length; },
      key: (i) => Object.keys(store)[i]
    }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  ['day.js', 'season.js', 'plan-v2-data.js', 'plan-v2.js', 'systems.js']
    .forEach((f) => vm.runInContext(read(f), ctx, { filename: f }));
  return ctx;
}

/* The clock this file is run against. A Wednesday at 21:00 local, which is
   inside a season's evening and well clear of the 05:00 day boundary at
   both ends — so nothing below depends on which side of midnight it is. */
const NOW = new Date(2026, 8, 16, 21, 0, 0, 0).getTime();
const DAY = 86400000;

/* Day keys the way day.js makes them, so the stores below are keyed the way
   the hub would have keyed them on those evenings. */
const keyAt = (() => {
  const c = hub({});
  return (ms) => c.CTDay.key(ms);
})();
const daysAgo = (n) => keyAt(NOW - n * DAY);

const lifelog = (...days) => JSON.stringify({
  days: days.reduce((o, k) => { o[k] = { screen: { total: '5.0' } }; return o; }, {})
});
const season = (ticks) => JSON.stringify({
  started: NOW - 20 * DAY, days: 90, rules: ['no contact'], ended: null, ticks: ticks
});

/* ── 1. the bug, in one assertion ──────────────────────────────────────── */
group('The season board is evidence that a day was reported');

{
  const stale = lifelog(daysAgo(14), daysAgo(13), daysAgo(12));

  const before = hub({ ct_lifelog_v1: stale });
  ok(before.Systems.drift(NOW) === 12,
     'twelve days since the last closed Life Log day reads as twelve days down');
  ok(before.Systems.floorDay(NOW) === true,
     'and that is a floor day, which is what hides the checklist');

  const after = hub({
    ct_lifelog_v1: stale,
    ct_season_v1: season({ [daysAgo(0)]: { prayer_am: 1, manuscript: 1, phone: 1 } })
  });
  ok(after.Systems.drift(NOW) === 0,
     'ticking the season board tonight is the hub being told about tonight');
  ok(after.Systems.floorDay(NOW) === false,
     'so it is not a floor day, and the checklist is not hidden by its own ticks');
}

/* ── 2. it is the most recent of the two, never a preference ───────────── */
group('Whichever store heard from you last is the one that counts');

{
  const c = hub({
    ct_lifelog_v1: lifelog(daysAgo(1)),
    ct_season_v1: season({ [daysAgo(9)]: { prayer_am: 1 } })
  });
  ok(c.Systems.drift(NOW) === 1, 'a fresh Life Log day wins over a stale season tick');

  const d = hub({
    ct_lifelog_v1: lifelog(daysAgo(9)),
    ct_season_v1: season({ [daysAgo(2)]: { prayer_am: 1 } })
  });
  ok(d.Systems.drift(NOW) === 2, 'and a fresh season tick wins over a stale Life Log day');

  const e = hub({
    ct_lifelog_v1: lifelog(daysAgo(14)),
    ct_season_v1: season({ [daysAgo(4)]: { heavy: 3 } })
  });
  ok(e.Systems.drift(NOW) === 4 && e.Systems.floorDay(NOW) === true,
     'the heaviness tap counts too — somebody sat down with that day — and four is still a rut');
}

/* ── 3. a store this cannot see is silence, not a zero ─────────────────── */
group('Nothing is invented from an absent or empty store');

{
  const none = hub({ ct_lifelog_v1: lifelog(daysAgo(6)) });
  ok(none.Systems.drift(NOW) === 6,
     'with no season declared the arithmetic is exactly what it always was');

  const empty = hub({
    ct_lifelog_v1: lifelog(daysAgo(6)),
    ct_season_v1: season({ [daysAgo(0)]: {} })
  });
  ok(empty.Systems.drift(NOW) === 6,
     'a day key with no ticks under it was never told anything — it is not evidence');

  const blank = hub({});
  ok(blank.Systems.drift(NOW) === 0,
     'a hub that has never been written to is not in a rut, it is new');
}

/* ── 4. a tick dated ahead of today cannot clear a rut ──────────────────
   A clock skewed across the 05:00 boundary, or a backup restored from a
   device a day ahead, must not be able to report that today was logged. */
group('Tomorrow is not evidence about today');

{
  const c = hub({
    ct_lifelog_v1: lifelog(daysAgo(11)),
    ct_season_v1: season({ [daysAgo(-1)]: { prayer_am: 1 } })
  });
  ok(c.Systems.drift(NOW) === 11, 'a tick carrying tomorrow’s key is stepped over');
  ok(c.Systems.floorDay(NOW) === true, 'so the floor day it should have called still stands');

  const S = hub({ ct_season_v1: season({ [daysAgo(-1)]: { prayer_am: 1 }, [daysAgo(3)]: { phone: 1 } }) });
  ok(S.Season.lastTold(null, NOW) === daysAgo(3),
     'lastTold() returns the newest key that is not in the future');
  ok(S.Season.lastTold(null, NOW - 9 * DAY) === null,
     'and null rather than day zero when it had not been told anything yet');
}

/* ── 5. one number, on every page that prints it ───────────────────────
   The oldest failure in this repo is two pages answering the same question
   differently. drift() now asks window.Season, so a page carrying
   systems.js WITHOUT season.js would compute a smaller board's answer and
   print a different number of days down from the page beside it. */
group('Every page that can compute drift can see the season');

{
  const inject = read('.github/inject.py');
  ok(/<script src="\.\/season\.js"><\/script>/.test(inject),
     'inject.py puts season.js in the shim every hub page gets');
  ok(/season\.js\?v=__APP_VERSION__/.test(inject),
     'and in the bundler head the .dc.html exports get');

  /* The shim is the guarantee, but a page that names systems.js in its own
     head and not season.js is a page whose source does not say what it
     reads — and the shim is exactly the thing somebody edits next. Archived
     pages are exempt: they are frozen records, not surfaces. */
  const S = sitemap();
  const pages = fs.readdirSync(ROOT)
    .filter((f) => /\.html$/.test(f) && !S.isArchived(f));
  const offenders = pages.filter((f) => {
    const html = read(f);
    return /src="\.\/systems\.js"/.test(html) && !/src="\.\/season\.js"/.test(html);
  });
  ok(offenders.length === 0,
     'every live page that links systems.js links season.js beside it' +
     (offenders.length ? ' — ' + offenders.join(', ') : ''));
}

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
