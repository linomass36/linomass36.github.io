/* ─────────────────────────────────────────────────────────────
   study-control.test.js — a term spent studying is not a rut.

   Run with `node tools/study-control.test.js` from the repo root. Also run
   by the deploy.

   WHAT WAS BROKEN. Study Control was a standalone page that kept its data
   under `studyControl.v1` and its rules in an inline script. For the first
   month of Year 2 it was the only thing in use. Systems.drift() read the
   Life Log and the season board, saw neither touched, and would have opened
   the Standing on a floor day — "N days down" — over weeks of logged quizzes
   and ticked prep. The season board's bug (tools/rut.test.js) again, with a
   new owner nobody told drift about.

   So: StudyControl owns the term and answers lastTold(); drift asks it. These
   assertions DRIVE THE CLOCK, per CLAUDE.md.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

function hub(stores) {
  const store = Object.assign({}, stores || {});
  const ctx = {
    console, JSON, Object, Array, String, Number, Boolean, RegExp, Date, Math, Intl,
    isNaN, isFinite, parseInt, parseFloat,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      get length() { return Object.keys(store).length; },
      key: (i) => Object.keys(store)[i]
    }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  ['day.js', 'season.js', 'study-control.js', 'plan-v2-data.js', 'plan-v2.js', 'systems.js']
    .forEach((f) => vm.runInContext(read(f), ctx, { filename: f }));
  ctx.__store = store;
  return ctx;
}

/* Wednesday 14 October 2026, 21:00 local: the evening this was written for,
   set here rather than read. */
const NOW = new Date(2026, 9, 14, 21, 0, 0, 0).getTime();
const DAY = 86400000;
const keyAt = (() => { const c = hub({}); return (ms) => c.CTDay.key(ms); })();
const daysAgo = (n) => keyAt(NOW - n * DAY);
const lifelog = (...days) => JSON.stringify({
  days: days.reduce((o, k) => { o[k] = { screen: { total: '5.0' } }; return o; }, {})
});

/* ── 1. the bug ────────────────────────────────────────────────────────── */
group('Studying is the hub being told about the day');
{
  const stale = lifelog(daysAgo(30));
  const before = hub({ ct_lifelog_v1: stale });
  ok(before.Systems.drift(NOW) === 30 && before.Systems.floorDay(NOW) === true,
     'a month since the last Life Log day is a floor day, with nothing else to go on');

  const after = hub({ ct_lifelog_v1: stale });
  const s = after.StudyControl.read();
  s.events['phy-2026-10-16'].prep = { p0: 1 };
  after.StudyControl.write(s, NOW);
  ok(after.Systems.drift(NOW) === 0, 'ticking prep tonight in Study Control is tonight reported');
  ok(after.Systems.floorDay(NOW) === false, 'so the Standing does not call a study night a rut');
}

/* ── 2. what counts, and what does not ─────────────────────────────────── */
group('lastTold is the day something was written, never later than today');
{
  const c = hub({});
  ok(c.StudyControl.lastTold(null, NOW) === null, 'a store never written is silence, not day zero');
  ok(c.Systems.drift(NOW) === 0, 'and silence alone does not invent drift');

  const d = hub({ ct_studycontrol_v1: JSON.stringify({ results: {
    r: { date: daysAgo(6), subject: 'histology', kind: 'quiz', score: 5, max: 9, createdAt: new Date(NOW - 2 * DAY).toISOString() }
  } }) });
  ok(d.StudyControl.lastTold(null, NOW) === daysAgo(2),
     'a quiz sat six days ago and logged two days ago counts on the day it was logged');

  const e = hub({ ct_studycontrol_v1: JSON.stringify({ told: { [daysAgo(5)]: 1, [daysAgo(-3)]: 1 } }) });
  ok(e.StudyControl.lastTold(null, NOW) === daysAgo(5), 'a day key after today is stepped over, not trusted');
}

/* ── 3. moving in from the standalone page ─────────────────────────────── */
group('The old page\'s data is copied across, and opening is not reporting');
{
  const legacy = JSON.stringify({ events: {}, results: { x: { date: '2026-10-01', subject: 'anatomy', kind: 'quiz', score: 9, max: 10 } }, anki: {}, actions: {} });
  const c = hub({ studyControl: 1, 'studyControl.v1': legacy });
  ok(c.StudyControl.summary(NOW) === null, 'the Standing shows nothing before the page has been opened here');
  ok(c.StudyControl.adopt() === true, 'opening the page adopts the old key');
  const s = JSON.parse(c.__store.ct_studycontrol_v1);
  ok(s.results.x && s.results.x.score === 9, 'with its results intact');
  ok('studyControl.v1' in c.__store, 'and the original is left where it was');
  ok(Object.keys(s.told).length === 0, 'without stamping a day — opening a page is not telling the hub anything');
  ok(c.StudyControl.adopt() === false, 'and adopting twice does nothing');
}

/* ── 4. the rules, on the term as written ──────────────────────────────── */
group('The rules give the page\'s answer for 14 October');
{
  const c = hub({});
  const F = c.StudyControl.flags(c.StudyControl.SEED, NOW);
  const rules = (r) => F.filter((f) => f.rule === r);
  ok(rules('R1').length === 1 && /67%/.test(rules('R1')[0].title), 'R1: the 6/9 histology quiz is under 70%');
  ok(rules('R6').some((f) => f.lvl === 'change' && /W2/.test(f.title)), 'R6: no cards two days after the W2 lab is a change');
  ok(rules('R5').length === 3, 'R5: today’s seminar, tomorrow’s lab and Friday’s test are under-prepped');
  ok(rules('R8').length === 2, 'R8: anatomy and histology recall under 80% are warnings, physiology is not');
  ok(rules('R10').length === 0, 'R10: last week’s Anki row exists');
  ok(F[0].lvl === 'change', 'changes sort ahead of warnings');

  const n = c.StudyControl.nextGraded(c.StudyControl.SEED, NOW);
  ok(n && n.subject === 'physiology' && n.days === 2, 'next graded is Friday’s physiology entrance test');

  const tue = new Date(2026, 9, 20, 9, 0, 0, 0).getTime();
  ok(c.StudyControl.flags(c.StudyControl.SEED, tue).some((f) => f.rule === 'R10'),
     'R10: by Tuesday 20 October with no row for the week of 12 October, the export is owed');
}

/* ── 5. it is a place in the hub ───────────────────────────────────────── */
group('Study lands on it');
{
  const ctx = { console, JSON, Object, Array, String, RegExp, Date, Math };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('sitemap.js'), ctx);
  const d = ctx.SITEMAP.destinations().find((x) => x.id === 'study');
  ok(d && d.lands === 'Study Control.html', 'the Study destination opens on Study Control');
  ok(/study-control\.js/.test(read('Standing.html')), 'the Standing loads the owner it asks');
  ok(!/localStorage\.getItem\(['"]ct_studycontrol/.test(read('Standing.html') + read('systems.js')),
     'and nothing outside the owner reads its key');
}

/* ── 6. a result can be corrected ──────────────────────────────────────
   SHIPPED BROKEN: results and classes could be added and never changed. The
   official histology and physiology scores came back different from the
   estimates logged on the day, and the only way to record that was a second
   result beside the wrong one, which the rules then counted twice. And the
   three forms were never hidden by their tabs at all: `form{display:flex}`
   outranks the browser's own [hidden] rule. */
group('Results and classes can be edited and deleted');
{
  const src = read('Study Control.html');
  ok(/data-edit-res=/.test(src) && /data-edit-ev=/.test(src), 'every result and every class has an Edit control');
  ok(/db\.doc\("results\/"\+editRes\)\.set\(Object\.assign\(\{\},old,fields/.test(src),
     'an edited result keeps what the form does not show (when it was logged, whether its cards are made)');
  ok(/db\.doc\("events\/"\+editEv\)\.set\(Object\.assign\(\{\},old,fields,\{prep:old\.prep/.test(src),
     'an edited class keeps its ticked prep');
  ok(/db\.doc\("results\/"\+editRes\)\.delete\(\)/.test(src) && /db\.doc\("events\/"\+editEv\)\.delete\(\)/.test(src),
     'both can be deleted');
  ok(/dataset\.armed/.test(src), 'and a delete asks twice, since nothing here can be undone');
  ok(/\[hidden\]\{display:none!important\}/.test(src), 'a hidden form is actually hidden');

  /* The rules read the corrected figure, not the first one typed. */
  const c = hub({});
  const s = c.StudyControl.read();
  s.results['r-his-1012'] = Object.assign({}, s.results['r-his-1012'], { score: 7, estimate: false });
  c.StudyControl.write(s, NOW);
  ok(!c.StudyControl.flags(c.StudyControl.read(), NOW).some((f) => f.rule === 'R1' && /histology|W2/i.test(f.title)),
     'correcting 6/9 to an official 7/9 clears the under-70% flag');
}

/* ── 7. the study group ────────────────────────────────────────────────
   From the Year 2 Study Group Manual: three sessions a week, each the day
   before what it prepares, and you lead anatomy. Written as events so each
   can be edited; a deleted one must stay deleted. */
group('The study group\'s sessions are in the term, once each');
{
  const c = hub({});
  const SC = c.StudyControl;
  SC.adopt();
  const n = SC.ensureGroup();
  ok(n > 40, 'a session a week per subject from 11 October to January (' + n + ')');
  ok(SC.ensureGroup() === 0, 'and opening the page again adds none');
  const ev = SC.read().events;
  ok(ev['grp-histology-2026-10-11'] && ev['grp-anatomy-2026-10-14'] && ev['grp-physiology-2026-10-15'],
     'Sunday histology, Wednesday anatomy, Thursday physiology');
  ok(ev['grp-anatomy-2026-10-14'].lead && !ev['grp-physiology-2026-10-15'].lead, 'you lead anatomy, not the others');
  ok(/Crunch week/.test(ev['grp-anatomy-2026-10-28'].note), 'a session in a crunch week carries the manual\'s note');
  ok(Object.keys(c.__store).length && JSON.parse(c.__store.ct_studycontrol_v1).told &&
     Object.keys(JSON.parse(c.__store.ct_studycontrol_v1).told).length === 0,
     'writing the schedule is not you reporting a day');

  const s = SC.read(); delete s.events['grp-anatomy-2026-10-21']; s.dismissed['grp-anatomy-2026-10-21'] = 1; SC.write(s, NOW);
  SC.ensureGroup();
  ok(!SC.read().events['grp-anatomy-2026-10-21'], 'a session you deleted is not put back');

  const tue = new Date(2026, 9, 13, 20, 0, 0, 0).getTime();   // the evening before Wednesday 14th
  const F = SC.flags(SC.read(), tue);
  ok(F.some((f) => f.rule === 'R11' && /tomorrow/.test(f.title)), 'the evening before, the prompt card and key are a heads-up');
  ok(SC.headsUp(SC.read(), tue).some((f) => f.rule === 'R11'), 'and reach the front door');
  ok(!F.some((f) => /^(prep|after):grp-/.test(f.id)), 'a session raises no class prep or cards-after flags');
  const s2 = SC.read(); s2.events['grp-anatomy-2026-10-28'].prep = { p0: true }; SC.write(s2, NOW);
  const wed = new Date(2026, 9, 27, 20, 0, 0, 0).getTime();
  ok(!SC.flags(SC.read(), wed).some((f) => f.id === 'card:grp-anatomy-2026-10-28'), 'ticking the card clears it');
  ok(SC.prepFor(ev['grp-anatomy-2026-10-14'])[0] === 'Prompt card and key written' &&
     SC.prepFor(ev['grp-physiology-2026-10-15']).length === 2, 'a session\'s prep is the card when you lead, then own study and the Fix list');
}

/* ── 8. the Anki week from the Mac ─────────────────────────────────────── */
group('The Anki week the Mac sends is filed, newest first');
{
  const c = hub({});
  const SC = c.StudyControl;
  SC.adopt();
  const weeks = { '2026-10-12': { days: 4, subjects: { anatomy: { min: 40, recall: 82, newc: 12, backlog: 300, reviews: 400 } } } };
  ok(SC.ingestWeeks(weeks, '2026-10-15T18:00:00Z', NOW).length === 1, 'a synced week is filed');
  const w = SC.read().anki['w2026-10-12'];
  ok(w.anatomy.min === 40 && w.anatomy.recall === 82 && /Synced from Anki/.test(w.note), 'with its numbers and a note saying where they came from');
  ok(SC.ingestWeeks({ '2026-10-12': { days: 3, subjects: { anatomy: { min: 1 } } } }, '2026-10-15T09:00:00Z', NOW).length === 0,
     'an older reading arriving late does not overwrite a newer one');
  SC.ingestWeeks({ '2026-10-12': { days: 5, subjects: { anatomy: { min: 45, recall: 80, newc: 10, backlog: null } } } }, '2026-10-16T18:00:00Z', NOW);
  ok(SC.read().anki['w2026-10-12'].anatomy.backlog === 300, 'a value the sync leaves blank keeps what was there');

  /* The URL route: anki_sync.py --open puts the reading in the fragment. */
  const payload = { at: '2026-10-17T10:00:00Z', due: 3, weeks: { '2026-10-12': { days: 6, subjects: { histology: { min: 9, recall: 90 } } } } };
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  c.location = { hash: '#anki=' + b64, pathname: '/Almanac.html', search: '' };
  c.history = { replaceState: () => { c.location.hash = ''; } };
  c.atob = (x) => Buffer.from(x, 'base64').toString('binary');
  c.escape = escape;
  c.decodeURIComponent = decodeURIComponent;
  vm.runInContext(read('feeds.js'), c, { filename: 'feeds.js' });
  const got = c.Feeds.fromHash();
  ok(got && got.due === 3 && c.location.hash === '', 'the hub reads the reading off the URL and wipes it from the address bar');
  ok(SC.read().anki['w2026-10-12'].histology && SC.read().anki['w2026-10-12'].histology.min === 9,
     'and the study week reaches Study Control through Feeds, not a second parser');
}

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
