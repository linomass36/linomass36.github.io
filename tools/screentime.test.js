/* ─────────────────────────────────────────────────────────────
   screentime.test.js — the phone is logged in three buckets, and every
   surface adds them up the same way.

   Run with `node tools/screentime.test.js` from the repo root. Also run by
   the deploy.

   The day-close used to ask for one "social / fun" figure. It now asks for
   social, games and entertainment separately, which is a better question and
   a worse risk: five places read that number — the Today card, the Life
   Log's form and its correlation panel, systems.js for the board's sentence,
   and facts.js for the fact table — and nothing stops each of them summing
   the buckets slightly differently. That is the failure this repo has
   already had once, with five hand-written copies of the site map.

   So screen.js owns the arithmetic and these are the checks that keep it
   owning it:

     1. the sum itself, including the case that makes it subtle — a blank
        bucket is "not told", not zero, and a day logged before the split
        carries its whole off-duty hour in `social`;
     2. the fact table and the board read that sum rather than one bucket, so
        a day spent entirely on games is not read as a day off the phone;
     3. every page that loads facts.js or systems.js also loads screen.js —
        without it those two lose the column silently rather than throwing;
     4. the day-close card actually writes the three keys, run out of the
        shipped page rather than described here.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function load(files, store) {
  const mem = Object.assign({}, store || {});
  const ctx = { console, JSON, Object, Array, Math, String, Number, Date,
    parseFloat, parseInt, isNaN, isFinite, RegExp, Error,
    localStorage: { getItem: (k) => (k in mem ? mem[k] : null),
                    setItem: (k, v) => { mem[k] = String(v); },
                    removeItem: (k) => { delete mem[k]; } } };
  ctx.globalThis = ctx; ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  files.forEach((f) => vm.runInContext(read(f), ctx, { filename: f }));
  ctx.__mem = mem;
  return ctx;
}

const lifelog = (days) => ({ ct_lifelog_v1: JSON.stringify({ days: days }) });

group('Off duty is the three buckets, and a blank one is not a zero');
{
  const S = load(['screen.js']).window.CTScreen;
  ok(S.offDuty({ social: 2, games: 1, ent: 0.5 }) === 3.5, 'the three add up');
  ok(S.offDuty({ social: '2', games: '1.25' }) === 3.25, 'strings off an input are numbers');
  ok(S.offDuty({ games: 2 }) === 2, 'games alone is a reading');
  ok(S.offDuty({}) === null, 'nothing logged is null, not 0 — the day was not answered');
  ok(S.offDuty({ total: 6 }) === null, 'a total with no breakdown is still null');
  ok(S.offDuty({ social: 0, games: 0, ent: 0 }) === 0, 'a deliberate nothing is 0');
  ok(S.offDuty({ social: 1, games: 'x' }) === 1, 'an unparseable box is ignored, not NaN');

  /* The whole point of keeping the key: every day logged before the split
     put its social AND its games AND its television in this one box. */
  ok(S.offDuty({ social: 3.5 }) === 3.5, 'a day logged before the split reads exactly as it did');
}

group('The share is of the phone, and cannot exceed it');
{
  const S = load(['screen.js']).window.CTScreen;
  ok(S.share({ total: 8, social: 2, games: 2 }) === 50, 'four hours off duty of eight is half');
  ok(S.share({ total: 4, social: 3, games: 3 }) === 100,
     'hand-typed buckets over the total cap at 100 rather than reading 150%');
  ok(S.share({ social: 2 }) === null, 'no total, no share');
  ok(S.share({ total: 0, social: 0 }) === null, 'a zero total is not a division');
  ok(S.split({ social: 2, games: 1 }) === '2h social · 1h games', 'the split names the buckets');
  ok(S.split({ social: 2 }) === '',
     'one bucket gets no breakdown — repeating a figure back as its own split says nothing');
  ok(S.split({ social: 2, games: 0 }) === '', 'and a zero bucket is not worth a clause');
}

group('The fact table carries the split and the sum');
{
  const F = load(['screen.js', 'facts.js'], lifelog({
    '2026-08-20': { screen: { total: 7, social: 2, games: 1.5, ent: 0.5 } },
    '2026-08-21': { screen: { total: 5, social: 3 } }
  })).window.CTFacts;
  const t = F.all();
  const a = t['2026-08-20'];
  ok(a.social === 2 && a.games === 1.5 && a.ent === 0.5,
     'each bucket is its own column, which is the point of asking separately');
  ok(a.offDuty === 4, 'and their sum is a column too (' + a.offDuty + ')');
  ok(a.screen === 7, 'the phone total is untouched');
  ok(t['2026-08-21'].offDuty === 3, 'a pre-split day still reports its off-duty hours');
  ok(t['2026-08-21'].games === undefined, 'without inventing buckets it never had');
}

group('The board correlates against off duty, not social alone');
{
  /* Ten days on games and nothing else. Reading only `social` would find no
     figure at all and the board would say "keep logging" while a fortnight
     of evenings sat in the store. */
  const days = {};
  for (let i = 0; i < 10; i++) {
    const k = '2026-08-' + String(10 + i).padStart(2, '0');
    days[k] = { screen: { total: 6, games: 4 - i * 0.3 }, sleep: { asleep: 6 + i * 0.2 } };
  }
  const S = load(['day.js', 'screen.js', 'systems.js'], lifelog(days)).window.Systems;
  const tr = S.trends();
  ok(tr.days === 10, 'ten days of games are ten days of data (' + tr.days + ')');
  ok(tr.ready, 'which is enough to read');
  const sleep = tr.rows.find((r) => r.key === 'sleep');
  ok(sleep && sleep.r != null && sleep.r < -0.9,
     'and the reading is the one in the data — more games, less sleep (r ' +
     (sleep && sleep.r != null ? sleep.r.toFixed(2) : '—') + ')');
  ok(/off-duty/.test(tr.sentence), 'the sentence says off-duty, not social (' + tr.sentence + ')');
}

group('Nothing reads the sum without the file that defines it');
{
  /* facts.js and systems.js both degrade quietly when CTScreen is missing —
     a lost column rather than a thrown page — which is the right behaviour
     and exactly why it needs a test. The build shim puts screen.js on every
     hub page; a page that names facts.js or systems.js in its own head must
     name screen.js there too, or it is broken when opened from the repo. */
  const pages = fs.readdirSync(ROOT).filter((f) => /\.html$/i.test(f));
  const needs = pages.filter((f) => /src="\.\/(facts|systems)\.js"/.test(read(f)));
  const missing = needs.filter((f) => !/src="\.\/screen\.js"/.test(read(f)));
  ok(needs.length > 0, 'the check found the pages that read the record (' + needs.length + ')');
  ok(missing.length === 0, 'every one of them loads screen.js first' +
     (missing.length ? ' — missing: ' + missing.join(', ') : ''));

  const shim = read('.github/inject.py');
  const iScreen = shim.indexOf('screen.js'), iFacts = shim.indexOf('facts.js');
  ok(iScreen > 0 && iScreen < iFacts, 'and the build shim ships it ahead of facts.js');
}

group('The day-close card writes all three, out of the shipped page');
{
  /* The class off the page itself: the DC runtime gives it state, setState
     and props and this card touches no DOM. */
  function card(file, store) {
    const ctx = load(['day.js', 'screen.js'], store);
    const m = read(file).match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/);
    if (!m) throw new Error('no logic class in ' + file);
    vm.runInContext('class DCLogic { constructor() { this.state = {}; this.props = {}; } ' +
                    'setState(u) { Object.assign(this.state, typeof u === "function" ? u(this.state) : u); } }',
                    ctx, { filename: 'DCLogic stub' });
    vm.runInContext(m[1] + '\nglobalThis.__Component = Component;', ctx, { filename: file });
    return { c: vm.runInContext('new __Component()', ctx), mem: ctx.__mem };
  }

  /* The card writes to the hub's day, which is day.js's — 05:00, not
     midnight — so the fixture has to be keyed the same way rather than to a
     date picked here. */
  const day = load(['day.js']).window.CTDay.today();
  const { c, mem } = card('Today.dc.html', lifelog({ [day]: { screen: { total: 7, social: 2, games: 1, ent: 0.5 } } }));
  const v = c.closeDayVals();
  ok(v.scrSocial === 2 && v.scrGames === 1 && v.scrEnt === 0.5,
     'the three boxes come back filled in from the store');
  ok(/50% of your screen was off duty/.test(v.scrLine),
     'the line reads the share off their sum (' + v.scrLine + ')');
  ok(/2h social · 1h games · 0\.5h entertainment/.test(v.scrLine), 'and breaks it down');

  v.setScrGames({ target: { value: '3' } });
  const saved = JSON.parse(mem.ct_lifelog_v1).days[day].screen;
  ok(saved.games === '3', 'typing in the games box writes screen.games');
  ok(saved.social === 2 && saved.ent === 0.5, 'and leaves the other two alone');
  ok(/79% of your screen was off duty/.test(c.closeDayVals().scrLine),
     'and the share moves with it (' + c.closeDayVals().scrLine + ')');

  /* The Life Log's form is the same three boxes on any day, and it says the
     same thing about them — two pages agreeing because they ask one file. */
  const ll = card('Life Log.dc.html', lifelog({ [day]: { screen: { total: 7, social: 2, games: 1, ent: 0.5 } } }));
  const lv = ll.c.renderVals();
  ok(lv.scrSocial === 2 && lv.scrGames === 1 && lv.scrEnt === 0.5,
     'the Life Log shows the same three boxes');
  ok(/^50% off duty — 2h social · 1h games · 0\.5h entertainment$/.test(lv.scrVerdict),
     'and reads the same share off them (' + lv.scrVerdict + ')');
}

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
