/* ─────────────────────────────────────────────────────────────
   facts.test.js — the daily table joins the right things to the right days.

   Run with `node tools/facts.test.js` from the repo root.

   Two of these pin bugs that were shipped and found by reading:

     * `closures` was counted as Object.keys(dayRecord).length — the number of
       FIELDS in a day record, which is about twelve every single day. A
       closure is an anatomy BLOCK whose gate scored 80 or better on both
       halves, so it comes from `blocks`, on the date of its gate.
     * The Anki history arrives as parallel arrays keyed off a start date. An
       off-by-one there silently shifts a year of reps against every other
       measure, which would show up as nothing but slightly worse
       correlations.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

function load(store) {
  const mem = Object.assign({}, store || {});
  const ctx = { window: {}, console, JSON, Object, Array, Math, String, Number, Date,
    parseFloat, parseInt, isNaN, isFinite, RegExp, Error,
    localStorage: { getItem: (k) => (k in mem ? mem[k] : null),
                    setItem: (k, v) => { mem[k] = String(v); },
                    removeItem: (k) => { delete mem[k]; } } };
  ctx.globalThis = ctx; ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'facts.js'), 'utf8'), ctx, { filename: 'facts.js' });
  return ctx.window.CTFacts;
}

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);

group('A closure is a block closed, not a day record with fields in it');
{
  const F = load({ ct_anatomy_v1: JSON.stringify({
    schema: 3,
    blocks: {
      nk1:  { inv: 92, topo: 88, gate: '2026-08-20', studied: '2026-08-14' },
      nk2:  { inv: 74, topo: 90, gate: '2026-08-20', studied: '2026-08-15' },
      tx10: { inv: 85, topo: 81, gate: '2026-08-22' },
      tx11: { inv: 95, topo: 95, gate: '2026-08-22' },
      tx12: { inv: 95, topo: 95 }
    },
    days: { '2026-08-20': { tier: 'full', minRead: 45, minDraw: 30, cardsNew: 6,
                            cardsFixed: 2, note: 'x', pick: 'a', rand: 1, p0: 1 } }
  }) });
  const t = F.all();
  ok(t['2026-08-20'].closures === 1, 'a block failing one half is not closed (' + t['2026-08-20'].closures + ')');
  ok(t['2026-08-22'].closures === 2, 'two blocks gated the same day count twice');
  ok(!Object.keys(t).some((k) => t[k].closures > 2),
     'no day reports more closures than blocks gated on it');
  ok(t['2026-08-20'].anatRead === 45 && t['2026-08-20'].anatDraw === 30,
     'the day record still contributes its own minutes');
  ok(t['2026-08-20'].cardsMade === 8, 'cards made is new plus fixed');
}

group('The Anki history lands on the right days');
{
  const F = load({ ct_anki_v1: JSON.stringify({
    repsToday: 40, at: '2099-01-01T00:00:00Z',
    history: { from: '2026-08-18', days: 5,
               reps: [10, 20, 30, 40, 50], cards: [5, 6, 7, 8, 9],
               again: [1, 2, 3, 4, 5], secs: [600, 1200, 1800, 2400, 3000] }
  }) });
  const t = F.all();
  ok(t['2026-08-18'] && t['2026-08-18'].ankiReps === 10, 'index 0 is the `from` date');
  ok(t['2026-08-22'] && t['2026-08-22'].ankiReps === 50, 'the last index is `from` + days - 1');
  ok(!t['2026-08-17'] && !t['2026-08-23'], 'nothing lands outside the window');
  ok(t['2026-08-18'].ankiMins === 10, 'seconds become minutes (' + t['2026-08-18'].ankiMins + ')');
  const s = F.series('ankiReps');
  ok(s.length === 5 && s[0].day === '2026-08-18', 'the series is ordered oldest first');
  /* A stale reading must not be stamped on today as if it were done today. */
  ok(t[F.today()] === undefined || t[F.today()].ankiReps !== 40,
     'a reading dated 2099 is not taken as today\'s work');
}

group('Correlation honours the eight-day floor');
{
  const days = {};
  for (let i = 0; i < 10; i++) {
    const d = new Date(2026, 7, 1 + i);
    const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    days[k] = { sleep: { asleep: 6 + i * 0.2 }, screen: { social: 5 - i * 0.2 } };
  }
  const F = load({ ct_lifelog_v1: JSON.stringify({ days }) });
  const full = F.correlate('sleep', 'social');
  ok(full.ready && full.n === 10, 'ten paired days is enough (n=' + full.n + ')');
  ok(full.r < -0.9, 'and the inverse relation is found (r=' + full.r.toFixed(2) + ')');

  const few = {};
  Object.keys(days).slice(0, 5).forEach((k) => { few[k] = days[k]; });
  const F2 = load({ ct_lifelog_v1: JSON.stringify({ days: few }) });
  const thin = F2.correlate('sleep', 'social');
  ok(!thin.ready && thin.r === null, 'five days reports nothing rather than a shape');
  ok(thin.n === 5, 'but still says how many it had');
}

group('A flat column correlates with nothing, rather than dividing by zero');
{
  const days = {};
  for (let i = 0; i < 10; i++) {
    const k = '2026-08-' + String(1 + i).padStart(2, '0');
    days[k] = { sleep: { asleep: 7 }, screen: { social: 3 + i } };
  }
  const F = load({ ct_lifelog_v1: JSON.stringify({ days }) });
  const r = F.correlate('sleep', 'social');
  ok(r.r === null, 'a constant series yields null, not NaN');
}

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
