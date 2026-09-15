/* ─────────────────────────────────────────────────────────────
   onething.test.js — the floor day's one ask has to name something
   you can actually go and do.

   Run with `node tools/onething.test.js` from the repo root. Also run by the
   deploy.

   WHAT SHIPPED BROKEN. On a floor day — three or more days down, or a
   declared condition that stops you — Standing.html folds the whole board
   away and prints a single instruction. That instruction came from a static
   table in conditions.js which had never, in any version, read a store. For
   the drift case it read:

       Pick the smallest open loop and shut it.

   Reported, and correctly: "the problem is that I don't know what that
   means. And there is nothing saying what to do or what the loops are."

   Three separate failures in one sentence:

     · "open loop" is a TERM OF ART. anatomy-core.js defines it precisely —
       a block whose status is open, repeat or stale — and the ramp used it
       as though it were plain English, with no gloss anywhere on the page.
     · It named nothing and counted nothing. The hub knew which loops were
       open and what they were called, and said none of it.
     · It linked nowhere. The one day the page is reduced to one instruction
       is the day it also made you go and find the place yourself.

   And it could be impossible. With no open loops — the state of a brand new
   install, and of anyone who is not using the closure log — the page asked
   for something that did not exist.

   THE FIX is conditions.js offers()/onething(): candidates resolved against
   real stores, smallest-first, each naming a real item and carrying the
   address where it is done. This file pins the properties that matter:
   that it is always answerable, that it never returns bare jargon, that it
   skips what a condition holds, and that it calls anatomy-core correctly —
   which the first draft of the fix did not.

   A SECOND BUG, found while writing this. Standing.html called
   `C().ramp(all, holding)` — an Array as `opts` — so `opts.reentry` was
   never true and the re-entry ramp was unreachable from the only page that
   renders it. ramp() now asks anatomy-core itself.

   A THIRD, also found here rather than in review: the first draft called
   `AnatomyCore.openLoops()` and `.dueList()` with no argument. Both need the
   state and throw inside peek() on `s.blocks` without it, and both calls sit
   inside a try/catch — so the two most specific asks in the file were
   silently unreachable. That is this suite's whole reason for existing:
   a swallowed exception looks exactly like an empty store.

   TIME is driven, never read.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const iso = (off) => {
  const d = new Date();
  d.setDate(d.getDate() - (off || 0));
  return d.toISOString().slice(0, 10);
};

/* conditions.js + todo.js in one context, with whatever fakes a case needs
   standing in for the modules that are loaded beside them in a page. */
function ctxWith(opts) {
  opts = opts || {};
  const s = Object.assign({}, opts.store || {});
  const ctx = {
    console, JSON, Object, Array, String, Number, Math, Date, RegExp,
    isFinite, isNaN, parseInt, parseFloat,
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
  vm.runInContext(read('conditions.js'), ctx, { filename: 'conditions.js' });
  if (opts.anatomy) ctx.AnatomyCore = opts.anatomy;
  if (opts.resurface) ctx.Resurface = opts.resurface;
  ctx.__store = s;
  return ctx;
}

/* A stand-in for anatomy-core that behaves like the real one in the way that
   matters here: openLoops and dueList REQUIRE the state and throw without
   it, exactly as peek() does on `s.blocks`. */
function fakeAnatomy(cfg) {
  const need = (s) => { if (!s || !s.blocks) throw new TypeError("Cannot read properties of undefined (reading 'blocks')"); };
  return {
    read: () => ({ blocks: {}, days: {} }),
    openLoops: (s) => { need(s); return cfg.loops || []; },
    dueList: (s) => { need(s); return cfg.due || []; },
    inReentry: () => !!cfg.reentry
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   1 · the sentence that started this
   ───────────────────────────────────────────────────────────────────────── */
group('The ask never hands you a term it has not explained');

{
  const src = read('conditions.js');
  ok(!/ask: 'Pick the smallest open loop and shut it\.'/.test(src),
     'the drift ramp no longer asks for "the smallest open loop"');
  ok(!/ask: 'Two loops today, and log it\.'/.test(src),
     'and the re-entry ramp no longer counts in "loops" either');

  /* Checked on the OUTPUT rather than the source. Grepping the file matched
     this fix's own comments explaining the jargon, which is the wrong thing
     to assert about anyway: what matters is that no sentence the user is
     shown uses the term without defining it in the same breath. Every
     candidate is generated and inspected, whatever wording it was given. */
  const c = ctxWith({
    anatomy: fakeAnatomy({
      loops: [{ id: 'b1', name: 'Root of the neck' }],
      due: [{ b: { id: 'b2', name: 'Posterior triangle' }, k: 'd14', dd: iso(1) }]
    }),
    store: {
      ct_anki_v1: JSON.stringify({ due: 4, backlog: 0, at: iso(0) }),
      ct_todo_v1: JSON.stringify({ days: { [iso(0)]: [{ id: 'a', text: 'Ring the bank', done: 0, at: 1 }] }, asked: {} })
    }
  });
  const shown = c.Conditions.offers();
  let jargon = 0, glossed = 0;
  shown.forEach((o) => {
    const sentence = o.do + ' ' + o.kind;
    if (!/open loop/i.test(sentence)) return;
    jargon++;
    if (/studied but never scored/.test(sentence)) glossed++;
  });
  ok(jargon === glossed, 'every option that says "open loop" defines it in the same sentence (' +
     glossed + '/' + jargon + ')');
  ok(shown.every(o => !/\bloop\b/i.test(o.do) || /studied but never scored/.test(o.kind)),
     'and no ask uses the word without its gloss sitting under it');
}

/* ─────────────────────────────────────────────────────────────────────────
   2 · there is always an answer
   ───────────────────────────────────────────────────────────────────────── */
group('Something is always askable, whatever is in the stores');

{
  const bare = ctxWith({});
  const one = bare.Conditions.onething();
  ok(!!one.pick, 'an empty hub still resolves a concrete thing to do');
  ok(!!one.ask && one.ask.length > 4, 'and the ask is a sentence, not a blank');
  ok(!/open loop/i.test(one.ask), 'which does not fall back to the jargon');
  ok(!!one.pick.href && !!one.pick.cta, 'it carries somewhere to go and a label for the way there');
  ok(!!one.pick.kind, 'and a line saying what kind of thing it is');

  /* The last two candidates need no store, so the list can never empty. */
  const offers = bare.Conditions.offers();
  ok(offers.length >= 2, 'at least two store-free options always remain (' + offers.length + ')');
  ok(offers.every(o => o.do && o.href && o.kind), 'every option names a thing, a place and a kind');
}

/* ─────────────────────────────────────────────────────────────────────────
   3 · smallest first, and it is YOUR thing first
   ───────────────────────────────────────────────────────────────────────── */
group('The order is smallest-first, and your own list outranks the systems');

{
  const c = ctxWith({
    store: {
      ct_todo_v1: JSON.stringify({ days: { [iso(0)]: [
        { id: 'a', text: 'Ring the bank about the transfer', done: 0, at: 1 }] }, asked: {} }),
      ct_anki_v1: JSON.stringify({ due: 41, backlog: 102, at: iso(0) })
    },
    anatomy: fakeAnatomy({ loops: [{ id: 'b1', name: 'Root of the neck' }] })
  });
  const one = c.Conditions.onething();
  ok(one.pick.do === 'Ring the bank about the transfer',
     'a thing you wrote yourself is picked over anything a system wants');
  ok(one.pick.sys === 'todo', 'and it is attributed to the right system');
  ok(one.also.length === 2, 'two alternatives are offered, so it reads as a choice not an order');
  ok(one.also.every(o => o.do !== one.pick.do), 'and neither repeats the pick');
}

{
  /* No list of your own → the named anatomy loop, which is where the word
     gets its gloss. */
  const c = ctxWith({
    store: { ct_anki_v1: JSON.stringify({ due: 41, backlog: 102, at: iso(0) }) },
    anatomy: fakeAnatomy({ loops: [{ id: 'b1', name: 'Root of the neck' }] })
  });
  const one = c.Conditions.onething();
  ok(/Root of the neck/.test(one.pick.do), 'with nothing of your own, the open loop is named');
  ok(/studied but never scored/.test(one.pick.kind), 'and the term is explained beside it');
}

{
  /* A retest outranks a bare open loop, and dueList's { b, k, dd } shape is
     read correctly — the first draft read due[0].name and got undefined. */
  const c = ctxWith({
    anatomy: fakeAnatomy({
      due: [{ b: { id: 'b2', name: 'Posterior triangle' }, k: 'd45', dd: iso(2) }],
      loops: [{ id: 'b1', name: 'Root of the neck' }]
    })
  });
  const one = c.Conditions.onething();
  ok(/Posterior triangle/.test(one.pick.do), 'a due retest names its block, from dueList\'s .b');
  ok(!/undefined/.test(one.pick.do + one.pick.kind), 'and nothing in it reads "undefined"');
  ok(/forty-five/.test(one.pick.kind), 'it says which retest has come round');
}

{
  const c = ctxWith({ store: { ct_anki_v1: JSON.stringify({ due: 41, backlog: 102, at: iso(0) }) } });
  const one = c.Conditions.onething();
  ok(/143/.test(one.pick.do), 'the queue is given as a number you can see, not as "the queue"');
  ok(/Twenty/.test(one.pick.do), 'and the ask is twenty of them, not all of them');
}

/* ─────────────────────────────────────────────────────────────────────────
   4 · the anatomy calls are made correctly — the swallowed-exception bug
   ───────────────────────────────────────────────────────────────────────── */
group('anatomy-core is called with the state it requires');

{
  /* If offers() calls openLoops()/dueList() bare, the fake throws exactly as
     the real one does, the try/catch swallows it, and the loop candidate
     silently vanishes. Asserting the loop IS offered is what catches that. */
  const c = ctxWith({ anatomy: fakeAnatomy({ loops: [{ id: 'b1', name: 'Femoral triangle' }] }) });
  const offers = c.Conditions.offers();
  ok(offers.some(o => /Femoral triangle/.test(o.do)),
     'the open-loop option survives, so the call passed the state');

  const src = read('conditions.js');
  ok(/openLoops\(st\)/.test(src), 'openLoops is called with the state');
  ok(/dueList\(st\)/.test(src), 'dueList is called with the state');
  ok(!/openLoops\(\)/.test(src) && !/dueList\(\)/.test(src),
     'and neither is ever called bare, which throws inside peek()');

  /* A module that throws for any other reason must not take the page down. */
  const boom = ctxWith({ anatomy: { read: () => { throw new Error('boom'); } } });
  let threw = false;
  try { boom.Conditions.onething(); } catch (e) { threw = true; }
  ok(!threw, 'a broken anatomy module costs the option, never the page');
}

/* ─────────────────────────────────────────────────────────────────────────
   5 · a condition still holds what it holds
   ───────────────────────────────────────────────────────────────────────── */
group('Nothing held is ever proposed');

{
  const c = ctxWith({
    store: {
      ct_todo_v1: JSON.stringify({ days: { [iso(0)]: [
        { id: 'a', text: 'Ring the bank', done: 0, at: 1 }] }, asked: {} })
    }
  });
  /* "Flat — nothing in the tank", with "starting anything" ticked, holds
     todo (conditions.js SCOPES/areas). The list must stop being offered. */
  c.Conditions.declare('flat', { grade: 'stop', areas: ['start'] });
  ok(c.Conditions.isHeld('todo'), 'the condition holds the day\'s list');
  const offers = c.Conditions.offers();
  ok(!offers.some(o => o.sys === 'todo'),
     'so the list is not offered as the one thing while it is held');
  ok(offers.length >= 1, 'and there is still something left to ask for');
}

/* ─────────────────────────────────────────────────────────────────────────
   6 · the re-entry ramp is reachable again
   ───────────────────────────────────────────────────────────────────────── */
group('The re-entry ramp can be reached from the page that renders it');

{
  const c = ctxWith({ anatomy: fakeAnatomy({ reentry: true }) });
  const r = c.Conditions.ramp();
  ok(/Two small things/.test(r.ask), 'mid-re-entry, ramp() returns the re-entry ramp unprompted');

  const c2 = ctxWith({ anatomy: fakeAnatomy({ reentry: false }) });
  ok(!/Two small things/.test(c2.Conditions.ramp().ask), 'and does not when you are not');

  const st = read('Standing.html');
  ok(!/C\(\)\.ramp\(all, holding\)/.test(st),
     'Standing.html no longer passes an Array where an options object was expected');
  ok(/onething\(\)/.test(st), 'and asks for the resolved ask instead');
}

/* ─────────────────────────────────────────────────────────────────────────
   7 · the page shows what was resolved
   ───────────────────────────────────────────────────────────────────────── */
group('Standing.html renders the name, the way there, and the alternatives');

{
  const st = read('Standing.html');
  ok(/one\.pick\.href/.test(st), 'the link to the thing is rendered');
  ok(/one\.pick\.kind/.test(st), 'and the line saying what kind of thing it is');
  ok(/one\.also/.test(st), 'and the alternatives, so "what else counts" is answered on the page');
  ok(/\.floor \.go\{/.test(st), 'the link has a style, so it is a control rather than blue text');
  ok(/\.floor \.orelse/.test(st), 'and so does the alternatives list');

  /* Every address the resolver can hand out must be a page that exists. A
     floor-day link to a 404 is worse than no link. */
  const c = ctxWith({
    store: {
      ct_todo_v1: JSON.stringify({ days: { [iso(0)]: [{ id: 'a', text: 'x', done: 0, at: 1 }] }, asked: {} }),
      ct_anki_v1: JSON.stringify({ due: 3, backlog: 0, at: iso(0) })
    },
    anatomy: fakeAnatomy({ loops: [{ id: 'b', name: 'n' }], due: [{ b: { id: 'c', name: 'm' }, k: 'd14', dd: iso(1) }] }),
    resurface: { pick: () => ({ text: 'a note worth keeping', head: 'from the journal' }) }
  });
  const hrefs = c.Conditions.offers().map(o => o.href)
    .filter((h, i, a) => a.indexOf(h) === i);
  hrefs.forEach((h) => {
    ok(fs.existsSync(path.join(ROOT, h)), 'the option pointing at ' + h + ' points at a page that exists');
  });
  ok(hrefs.length >= 4, 'several distinct destinations are reachable (' + hrefs.length + ')');
}

console.log(failed ? '\n' + failed + ' FAILED\n' : '\nall good\n');
process.exit(failed ? 1 : 0);
