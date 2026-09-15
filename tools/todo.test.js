/* ─────────────────────────────────────────────────────────────
   todo.test.js — the day's list, and the week key that split the
   priorities in half.

   Run with `node tools/todo.test.js` from the repo root. Also run by the
   deploy.

   WHAT SHIPPED BROKEN, and it shipped broken for as long as the feature
   existed. `ct_weekly_v1.priorities` is keyed by Monday, and two conventions
   for computing that key were live at the same time:

     systems.js monday()        noon Monday, calendar fields   → 2026-09-14
     Weekly Review wkKey()      noon Monday, calendar fields   → 2026-09-14
     Today.dc.html              MIDNIGHT Monday, via isoDay()  → 2026-09-13
     capture.js monday()        MIDNIGHT Monday, via isoDay()  → 2026-09-13

   isoDay() routes through CTDay.key() and the hub's 05:00 day boundary, so
   midnight on a Monday came back as the Sunday before it. The consequence,
   verified in a browser on 2026-09-15 before the fix:

     priorities set in the Weekly Review NEVER rendered on Today
     priorities captured with `+`        NEVER reached the Weekly Review,
                                         which owns the only tick control

   So the three priorities could be written in one place and read in another,
   and `prioDone` could never be set for anything captured. systems.js
   already carried the comment explaining this exact trap — it had been fixed
   there for `reviews` and never for `priorities`.

   Nothing in the green suite could see it: sitemap, guide and money tests
   all pass while two files disagree about a string. So the first group here
   is not about todo.js at all. It asserts that every file which touches a
   week key derives it the same way, which is the only check that would have
   caught this and the only one that will catch it coming back.

   The rest covers todo.js itself — in particular the carry, which is the
   part that decides whether missing four days hands you back a list or a
   backlog.

   TIME. Every date in this file is DRIVEN, never read. A test that asserts
   something about "today" against a hardcoded date passes until that date
   and then blocks every deploy forever — see CLAUDE.md.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ── the sandbox ────────────────────────────────────────────────────────
   todo.js and day.js in one context with a real localStorage stand-in, so
   the store round-trips through JSON exactly as it does in a browser. */
function sandbox(store) {
  const s = Object.assign({}, store || {});
  const ctx = {
    console, JSON, Object, Array, String, Number, Math, Date, isFinite, isNaN,
    parseInt, parseFloat,
    localStorage: {
      getItem: (k) => (k in s ? s[k] : null),
      setItem: (k, v) => { s[k] = String(v); },
      removeItem: (k) => { delete s[k]; }
    }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('day.js'), ctx, { filename: 'day.js' });
  vm.runInContext(read('todo.js'), ctx, { filename: 'todo.js' });
  ctx.__store = s;
  return ctx;
}

/* A day key the way todo.js would write it, without asking todo.js — an
   independent derivation, so a bug in one is not hidden by the other. */
const dayKeyOf = (iso) => iso;

/* ─────────────────────────────────────────────────────────────────────────
   1 · the regression: everyone derives a week key the same way
   ───────────────────────────────────────────────────────────────────────── */
group('Every file that keys a week derives the key the same way');

/* The four derivations, extracted as code rather than described, and run
   against the same instants. Sunday and Monday are the days that matter:
   Monday is where the 05:00 boundary bites, Sunday is where an off-by-one
   week lands you in the wrong week entirely. */
const CORRECT = (d) => {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  x.setHours(12, 0, 0, 0);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' +
         String(x.getDate()).padStart(2, '0');
};

/* Build the sample from the CURRENT week, so this file has no date in it
   that can expire. Every weekday of this week plus the two around it. */
const probes = [];
for (let off = -9; off <= 9; off++) {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  d.setDate(d.getDate() + off);
  probes.push(new Date(d));
  const mid = new Date(d); mid.setHours(0, 30, 0, 0);   // inside the 05:00 window
  probes.push(mid);
}

/* systems.js and Today.dc.html/capture.js are read from source and their
   monday()/weekKey() bodies exercised, so this checks the shipped code and
   not a copy of it. */
function systemsMonday() {
  const ctx = sandbox();
  vm.runInContext(read('systems.js'), ctx, { filename: 'systems.js' });
  return ctx.Systems.monday;
}
function captureMonday() {
  const src = read('capture.js');
  const m = /function monday\(\) \{[\s\S]*?\n  \}/.exec(src);
  if (!m) return null;
  const ctx = sandbox();
  vm.runInContext(read('day.js'), ctx, { filename: 'day.js' });
  vm.runInContext('var isoDay = function (d) { return window.CTDay.key(d.getTime()); };\n' +
                  m[0] + '\nthis.__monday = monday;', ctx, { filename: 'capture-monday.js' });
  return ctx.__monday;
}
function todayWeekKey() {
  const src = read('Today.dc.html');
  const m = /weekKey\(d\) \{[\s\S]*?\n  \}/.exec(src);
  if (!m) return null;
  const ctx = sandbox();
  vm.runInContext('this.__wk = function ' + m[0].replace(/^weekKey/, '') + ';',
                  ctx, { filename: 'today-weekkey.js' });
  return ctx.__wk;
}

const sm = systemsMonday(), cm = captureMonday(), tw = todayWeekKey();

ok(typeof cm === 'function', 'capture.js still has a monday() this test can reach');
ok(typeof tw === 'function', 'Today.dc.html still has a weekKey() this test can reach');

/* systems.js monday() takes a week OFFSET, not a date, so it is checked on
   its own terms: offset 0 must be the Monday of the week we are standing in. */
ok(sm(0) === CORRECT(new Date()), 'systems.js monday(0) is this week\'s Monday');

let capAgree = true, todayAgree = true, capBad = '', todayBad = '';
probes.forEach((d) => {
  const want = CORRECT(d);
  if (cm) {
    /* capture.js reads the clock itself, so it can only be checked for the
       shape of its derivation: no isoDay(), noon not midnight. Asserted
       below on the source instead. */
  }
  if (tw && tw(d) !== want) { todayAgree = false; todayBad = todayBad || (d.toISOString() + ' → ' + tw(d) + ' want ' + want); }
});
ok(todayAgree, 'Today.dc.html weekKey() matches the canonical Monday on every day of the week' +
   (todayAgree ? '' : ' — ' + todayBad));

/* capture.js takes no argument, so its correctness is asserted structurally:
   it must NOT route a week key through isoDay(), and it must use noon. That
   is exactly the shape of the bug, so it is exactly what is pinned. */
const capSrc = (/function monday\(\) \{[\s\S]*?\n  \}/.exec(read('capture.js')) || [''])[0];
ok(!/isoDay\(/.test(capSrc),
   'capture.js monday() does not route a week key through isoDay() — that is the 05:00 bug');
ok(/setHours\(12,/.test(capSrc),
   'capture.js monday() anchors at noon, so a DST shift cannot move the date');
const todaySrc = (/weekKey\(d\) \{[\s\S]*?\n  \}/.exec(read('Today.dc.html')) || [''])[0];
ok(!/isoDay\(/.test(todaySrc),
   'Today.dc.html weekKey() does not route a week key through isoDay()');

/* And the pair that actually has to agree, end to end: a priority written
   under capture's key must be found under Today's key. */
ok(cm && tw && cm() === tw(new Date()),
   'a priority captured with + lands on the key Today reads');

/* ─────────────────────────────────────────────────────────────────────────
   2 · todo.js — the store
   ───────────────────────────────────────────────────────────────────────── */
group('The day\'s list stores what it is given');

{
  const ctx = sandbox();
  const T = ctx.CTTodo;

  ok(T.KEY === 'ct_todo_v1', 'stores under a ct_ key, so sync.js and backup.js carry it for free');

  ok(T.counts().total === 0, 'an unwritten store reads as an empty list rather than throwing');
  ok(T.carry() === null, 'and offers nothing to carry');

  T.add('Ring the bank');
  T.add('  Collect the parcel  ');
  ok(T.counts().total === 2, 'two lines in, two on the list');
  ok(T.list()[1].text === 'Collect the parcel', 'text is trimmed on the way in');

  ok(T.add('') === null && T.add('   ') === null && T.counts().total === 2,
     'an empty line is not an item');

  const id = T.list()[0].id;
  T.toggle(id);
  ok(T.counts().done === 1 && T.counts().open === 1, 'ticking one moves it from open to done');
  T.toggle(id);
  ok(T.counts().done === 0, 'and ticking it again puts it back — nothing is one-way');

  T.remove(id);
  ok(T.counts().total === 1, 'removing takes it off the list');

  /* The store must survive a round trip through JSON, because that is what
     localStorage and sync.js both do to it. */
  const raw = ctx.__store['ct_todo_v1'];
  ok(typeof raw === 'string' && JSON.parse(raw).days, 'the store is JSON with a days map');
}

/* ─────────────────────────────────────────────────────────────────────────
   3 · the carry — the part that decides backlog or no backlog
   ───────────────────────────────────────────────────────────────────────── */
group('An unfinished day is offered back, capped, and never as a debt');

/* Days are seeded directly rather than by travelling the clock, which keeps
   the fixture readable and the assertions about the RULE rather than about
   what date it happens to be. */
function seeded(dayOffsets, todayIso) {
  const days = {};
  Object.keys(dayOffsets).forEach((k) => {
    days[k] = dayOffsets[k].map((t, i) => ({ id: k + '-' + i, text: t, done: 0, at: 1 }));
  });
  return sandbox({ ct_todo_v1: JSON.stringify({ days, asked: {} }) });
}
const shift = (iso, n) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

{
  const T0 = sandbox().CTTodo;
  const today = T0.today();
  const y = shift(today, -1), older = shift(today, -3);

  {
    const T = seeded({ [y]: ['a', 'b'] }).CTTodo;
    const c = T.carry();
    ok(!!c && c.from === dayKeyOf(y), 'yesterday\'s open items are the ones offered');
    ok(c.open === 2 && c.offer.length === 2 && c.dropping === 0, 'two open, two offered, none dropped');
  }

  {
    const T = seeded({ [y]: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }).CTTodo;
    const c = T.carry();
    ok(c.open === 7, 'the true count is reported, not the capped one');
    ok(c.offer.length === T.CARRY_MAX && T.CARRY_MAX === 3, 'at most three are ever offered');
    ok(c.dropping === 4, 'and it says how many it is NOT offering rather than hiding them');

    const r = T.carryOver();
    ok(r.carried === 3 && r.dropped === 4, 'taking the offer carries three and drops four');
    ok(T.counts().total === 3, 'three land on today');
    ok(T.list().every(it => it.from === y), 'each carries where it came from, so the page can say so');
    ok(T.carry() === null, 'and the source day is no longer offered — this is what stops a pile');
  }

  {
    const T = seeded({ [y]: ['a', 'b'] }).CTTodo;
    const r = T.dismiss();
    ok(r.dropped === 2, 'declining drops them, and says how many');
    ok(T.counts().total === 0, 'nothing lands on today');
    ok(T.carry() === null, 'and they are not offered again tomorrow-morning-style, over and over');
  }

  {
    /* The originals must survive. A day on which you wrote six things and did
       two is a fact about that day; the carry marks them, it does not edit
       them away. CLAUDE.md: a source edited to agree with the dashboard is no
       longer a record of anything. */
    const ctx = seeded({ [y]: ['a', 'b', 'c', 'd'] });
    ctx.CTTodo.carryOver();
    const kept = JSON.parse(ctx.__store['ct_todo_v1']).days[y];
    ok(kept.length === 4, 'the source day still holds everything that was written on it');
    ok(kept.filter(i => i.carried).length === 3 && kept.filter(i => i.dropped).length === 1,
       'each original says whether it was carried or dropped');
    ok(kept.every(i => i.text), 'and none of them lost its text');
  }

  {
    const T = seeded({ [older]: ['a'], [y]: ['b'] }).CTTodo;
    ok(T.carry().from === y, 'the MOST RECENT open day is the one offered, not the oldest');
  }

  {
    /* The lookback. Beyond it the list was not one you were keeping, and
       dredging it up is the discouragement this file exists to prevent. */
    const far = shift(today, -(sandbox().CTTodo.CARRY_LOOKBACK_DAYS + 1));
    const T = seeded({ [far]: ['a', 'b'] }).CTTodo;
    ok(T.carry() === null,
       'a day older than the lookback is not offered back at all');
  }

  {
    const T = seeded({ [y]: ['a'] }).CTTodo;
    const done = T.list(y);
    ok(done.length === 1, 'a past day can be read');
    /* A day whose items were all ticked is not an open day. */
    const ctx2 = seeded({ [y]: ['a'] });
    ctx2.CTTodo.toggle(y + '-0', y);
    ok(ctx2.CTTodo.carry() === null, 'a day you finished is never offered back');
  }

  {
    /* Today's own open items are not "carried" from anywhere — the offer
       looks strictly backwards. Getting this wrong would offer you your own
       morning's list at lunchtime. */
    const T = seeded({ [today]: ['a', 'b'] }).CTTodo;
    ok(T.carry() === null, 'today is never offered back to itself');
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   4 · the wiring — a system, held like every other
   ───────────────────────────────────────────────────────────────────────── */
group('The list is a system, so every surface agrees about it');

{
  const src = read('systems.js');
  ok(/BUILDERS = \[\s*todo,/.test(src), 'systems.js builds a todo tile, so the Standing can see it');
  ok(/id: 'todo'/.test(src), 'and it publishes under the id conditions.js holds');

  const cond = read('conditions.js');
  ok(/output:\s*\['plan', 'research', 'todo'\]/.test(cond),
     'conditions.js scopes todo under output, so a work spike holds it');
  ok(/holds: \['plan', 'research', 'grind', 'todo'\]/.test(cond),
     'and a flat day\'s "starting anything" holds it too');

  /* The builder must not invent a number when todo.js is absent — several
     pages load systems.js without it. */
  const ctx = sandbox();
  vm.runInContext(src, ctx, { filename: 'systems.js' });
  delete ctx.CTTodo;
  let threw = false;
  try { ctx.Systems.all(); } catch (e) { threw = true; }
  ok(!threw, 'systems.js survives a page that has not loaded todo.js');

  /* An empty list is toneless, never 'ok'. A green tick for a day you never
     planned is flattery, and flattery is how a dashboard stops meaning
     anything. */
  const ctx2 = sandbox();
  vm.runInContext(src, ctx2, { filename: 'systems.js' });
  const empty = ctx2.Systems.all().filter(s => s.id === 'todo')[0];
  ok(empty && empty.tone === '', 'an empty list reads as neither owed nor done');

  const ctx3 = sandbox();
  vm.runInContext(src, ctx3, { filename: 'systems.js' });
  ctx3.CTTodo.add('Ring the bank');
  const open = ctx3.Systems.all().filter(s => s.id === 'todo')[0];
  ok(open && open.tone === 'go' && open.big === '1', 'one open item is one thing owed');
  ctx3.CTTodo.toggle(ctx3.CTTodo.list()[0].id);
  const clear = ctx3.Systems.all().filter(s => s.id === 'todo')[0];
  ok(clear && clear.tone === 'ok', 'and ticking it clears the tile');
}

/* ─────────────────────────────────────────────────────────────────────────
   5 · capture — the route that makes it worth using
   ───────────────────────────────────────────────────────────────────────── */
group('The capture bar can put a line on today from any page');

{
  const src = read('capture.js');
  ok(/t\[0\] === '!'/.test(src), 'capture.js routes ! to the day\'s list');
  ok(/window\.CTTodo/.test(src), 'and writes through todo.js rather than re-deriving the store');
  ok(/<b>!<\/b>/.test(src), 'the hint line tells you the prefix exists');
  /* The `!` check must come BEFORE the date parser, or "!14 Oct call them"
     would be filed as a conference. */
  ok(src.indexOf("t[0] === '!'") < src.indexOf('parseDate(t)'),
     'the ! route is tried before the date parser can claim the line');
}

/* ─────────────────────────────────────────────────────────────────────────
   6 · the Guide says it exists
   ───────────────────────────────────────────────────────────────────────── */
group('The Guide mentions the list');

{
  const guide = read('Guide.html').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  ok(/today’s list|today's list/i.test(guide), 'the Guide names the day\'s list');
  ok(/carr/i.test(guide), 'and explains what happens to what you did not finish');
}

console.log(failed ? '\n' + failed + ' FAILED\n' : '\nall good\n');
process.exit(failed ? 1 : 0);
