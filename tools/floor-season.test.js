/* ─────────────────────────────────────────────────────────────
   floor-season.test.js — the season board is the way back in, and what
   it is told is told everywhere.

   Run with `node tools/floor-season.test.js` from the repo root. Also run
   by the deploy.

   WHAT SHIPPED BROKEN, twice over, reported in one message:

     * "The season to-do list isn't showing up when I haven't done anything
       for a couple of days. It's acting as a barrier that makes it harder
       to get back in." Three quiet days make a floor day, and the Standing
       skipped the season checklist on a floor day by design. rut.test.js
       fixed the number feeding that rule; the rule itself was the barrier.
       A tick is the cheapest way back, and the page removed it exactly when
       it was the thing needed.

     * "When I check that I did Anki and worked out, they aren't registered
       as done because I didn't fill them in on their own pages." A season
       tick lived in ct_season_v1 and nowhere else. The season board had
       been taught to READ the grind board; the grind board, the Week and
       the Anki tile had never been taught to hear the season.

   Every assertion DRIVES THE CLOCK: Date is replaced in the context, so
   this passes on any day it is run.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);

/* Wednesday 16 September 2026, 21:00 local — week 2 of the grind block
   (which starts Monday 7 September), in a season's evening and well clear
   of the 05:00 day boundary. */
const NOW = new Date(2026, 8, 16, 21, 0, 0, 0).getTime();
const DAY = 86400000;
const WED = '2026-09-16';

function hub(stores) {
  const map = {};
  Object.keys(stores || {}).forEach((k) => { map[k] = JSON.stringify(stores[k]); });
  const R = Date;
  class D extends R {
    constructor(...a) { if (a.length) super(...a); else super(NOW); }
    static now() { return NOW; }
  }
  const ctx = {
    console, JSON, Object, Array, String, Number, Boolean, RegExp, Math, Intl, Error,
    isNaN, isFinite, parseInt, parseFloat, Date: D,
    localStorage: {
      getItem: (k) => (k in map ? map[k] : null),
      setItem: (k, v) => { map[k] = String(v); },
      removeItem: (k) => { delete map[k]; },
      get length() { return Object.keys(map).length; },
      key: (i) => Object.keys(map)[i]
    }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  ['day.js', 'grind-data.js', 'calendar.js', 'training.js', 'season.js',
   'plan-v2-data.js', 'plan-v2.js', 'systems.js']
    .forEach((f) => vm.runInContext(read(f), ctx, { filename: f }));
  const get = (k) => { try { return JSON.parse(map[k]); } catch (e) { return null; } };
  return { ctx, get, S: ctx.Season, T: ctx.CTTraining, Y: ctx.Systems };
}

const season = (extra) => Object.assign({
  started: NOW - 10 * DAY, days: 90, rules: ['no contact'], ended: null
}, extra || {});

/* ── 1. the floor day does not take the checklist away ─────────────────── */
group('The season checklist is on the Standing on a floor day');
{
  const st = read('Standing.html');
  const at = st.indexOf('<div class="szc">');
  ok(at > 0, 'the Standing still renders the season card');
  /* The nearest `if (SZ && seasonDay` above the card is the gate on it. */
  const gate = st.slice(0, at).match(/if \(SZ && seasonDay[^{]*\{/g) || [];
  const last = gate[gate.length - 1] || '';
  ok(!!last, 'and it is gated on a season being there');
  ok(!/floorDay/.test(last), 'but NOT on the floor day — that gate was the barrier');
  ok(/stops being a floor day/.test(st),
     'and on a floor day it says a tick is the way out of one');
}

/* ── 2. a tick is how the floor day lifts ──────────────────────────────── */
group('Ticking a row tonight ends the floor day it was shown on');
{
  const { S, Y } = hub({ ct_season_v1: season({ ticks: { '2026-09-11': { prayer_am: 1 } } }) });
  ok(Y.floorDay(NOW) === true, 'five quiet days is a floor day');
  S.tick('prayer_am', true, NOW);
  ok(Y.drift(NOW) === 0 && Y.floorDay(NOW) === false,
     'one tick on the card and it is not, on the repaint');
}

/* ── 3. a training tick is filed on the board, the Week and the log ────── */
group('Ticking Training on the season files the session everywhere');
{
  const { S, T, get } = hub({ ct_season_v1: season() });
  ok(T.isDone(WED) === false, 'before: the grind board has nothing for Wednesday');
  S.tick('train', true, NOW);
  const g = get('ct_grind_v1'), wk = get('ct_week_v1'), ll = get('ct_lifelog_v1');
  ok(T.isDone(WED) === true, 'after: CTTraining calls Wednesday trained');
  ok(!!(g && g.sessions && g.sessions['2|wed']),
     'the board files it under this block week, as the programme’s Wednesday session');
  ok(!!(wk && wk.days && wk.days[WED] && wk.days[WED].done), 'the Week has the date done');
  ok(!!(ll && ll.days && ll.days[WED] && ll.days[WED].gym && ll.days[WED].gym.on),
     'and the Life Log carries the gym tick the day’s totals read');

  S.tick('train', false, NOW);
  const g2 = get('ct_grind_v1');
  ok(!g2.sessions['2|wed'] && T.isDone(WED) === false,
     'un-ticking takes back exactly what the tick filed');
}

group('Every page that can tick the season can file a session');
{
  /* The write-through asks window.CTTraining. A page without it would keep
     the tick to itself again — the bug, silently back. */
  const inject = read('.github/inject.py');
  ok(/<script src="\.\/training\.js"><\/script>/.test(inject),
     'inject.py puts training.js in the shim every hub page gets');
}

group('A session already on the board is never taken back by the season');
{
  const { S, T, get } = hub({ ct_season_v1: season() });
  T.setDone(WED, true, { slot: 'wed' });           // recorded on the board itself
  S.tick('train', true, NOW);
  S.tick('train', false, NOW);
  ok(!!get('ct_grind_v1').sessions['2|wed'] && T.isDone(WED) === true,
     'ticking and un-ticking on the season leaves the board’s own record alone');
}

group('The session a tick is filed under is training.js’s call');
{
  const planned = hub({ ct_week_v1: { days: { [WED]: { session: 'Strength A', slot: 'mon' } } } });
  ok(planned.T.pickSlot(WED) === 'mon', 'the week’s own plan for the date wins');

  const taken = hub({ ct_grind_v1: { week: 2, sessions: { '2|wed': true, '2|mon': true } } });
  ok(taken.T.pickSlot(WED) === 'tue',
     'Wednesday’s session already done: the first session of the week still open');

  const full = {};
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].forEach((s) => { full['2|' + s] = true; });
  const all = hub({ ct_grind_v1: { week: 2, sessions: full } });
  ok(all.T.pickSlot(WED) === null, 'and nothing, rather than a double, when the week is full');
}

/* ── 4. an Anki tick is heard by the Recall tile ───────────────────────
   The tile that counts the Anki queue on the Standing. A reading only moves
   when the Mac sync runs, so without the season's word the day you did
   your reviews still read as Anki owed. */
group('Ticking Anki on the season stops Anki reading as owed');
{
  const reading = { due: 40, backlog: 0, streak: 3, repsToday: 0, at: '2026-09-12T08:00:00Z' };
  const tile = (h) => h.Y.all().filter((t) => t.id === 'recall')[0];

  const before = hub({ ct_season_v1: season(), ct_anki_v1: reading });
  ok(tile(before).tone === 'go' && /anki 40/.test(tile(before).line),
     'before: forty cards read as owed today');

  const after = hub({ ct_season_v1: season(), ct_anki_v1: reading });
  after.S.tick('anki', true, NOW);
  const t = tile(after);
  ok(t.tone === 'ok', 'after: the tile is not owed');
  ok(/anki done today \(Season\)/.test(t.line), 'and says who said so');
  ok(after.get('ct_anki_v1').repsToday === 0 && after.get('ct_anki_v1').due === 40,
     'no rep count is invented and the queue is not zeroed in the Anki store');

  const none = hub({ ct_season_v1: season() });
  none.S.tick('anki', true, NOW);
  ok(tile(none).tone === 'ok', 'with no reading at all, the tick still counts');

  const recall = read('Recall.html');
  ok(/Season\.said\('anki'/.test(recall) && /<script src="\.\/season\.js"><\/script>/.test(recall),
     'the Recall page asks the Season too, and loads it rather than hoping the shim did');
}

console.log('\n' + (failed ? failed + ' FAILED' : 'all passed'));
process.exit(failed ? 1 : 0);
