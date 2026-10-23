/* ─────────────────────────────────────────────────────────────
   anki-bridge.test.js — the add-on's day is the Almanac's day, and a tick or
   a moved class counts once, in both places.

   Run with `node tools/anki-bridge.test.js` from the repo root. Also run by
   the deploy.

   WHAT THIS PINS. The Year 2 Hub add-on publishes its days; anki-bridge.js
   files them, shows them as the checklist, and sends back what happened
   here. The payload is not hand-written below: it is made by the add-on's
   own bridge.py from its real plan.json, so a change to either side's idea
   of the format fails here rather than on the phone.

   The ways it can go wrong are the house's usual two-writer ones: a stale
   tick undoing a fresh one; a class moved in Study Control, then put back
   by the add-on's older date; a page holding the store in memory writing a
   moved class back over itself. Each is a case below.

   Every date is SET, never read (CLAUDE.md).
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* The add-on's own code makes the payload: Monday 26 Oct 2026, nothing ticked. */
const PAYLOAD = JSON.parse(cp.execFileSync('python3', ['-I', '-c', `
import sys, json, types, importlib.util, os, datetime
P = sys.argv[1]
pkg = types.ModuleType("year2_hub"); pkg.__path__ = [P]; sys.modules["year2_hub"] = pkg
def load(n):
    s = importlib.util.spec_from_file_location("year2_hub." + n, os.path.join(P, n + ".py"))
    m = importlib.util.module_from_spec(s); sys.modules["year2_hub." + n] = m; s.loader.exec_module(m); return m
load("tasks"); BR = load("bridge")
plan = json.load(open(os.path.join(P, "plan.json")))
st = {"checks": {}, "overrides": {}, "hub_start": "2026-10-20",
      "day": {"date": "2026-10-26", "target": {"anking": 21, "slides": 8}, "mode": {"anking": "on track", "slides": "catching up"}}}
out = BR.build_outbound(plan, st, datetime.date(2026, 10, 26))
out["at"] = "2026-10-26T07:00:00Z"
print(json.dumps(out))
`, path.join(ROOT, 'tools', 'anki-addon', 'year2_hub')]).toString());

function hub(stores, extra) {
  const store = Object.assign({}, stores || {});
  const timers = [];
  const ctx = {
    console, JSON, Object, Array, String, Number, Boolean, RegExp, Date, Math, Intl, Promise,
    isNaN, isFinite, parseInt, parseFloat, encodeURIComponent, unescape, btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout: () => {},
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; }
    }
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  Object.assign(ctx, extra || {});
  vm.createContext(ctx);
  ['day.js', 'study-control.js', 'anki-bridge.js'].forEach((f) => vm.runInContext(read(f), ctx, { filename: f }));
  ctx.__store = store; ctx.__timers = timers;
  ctx.StudyControl.adopt();
  return ctx;
}
const at = (m, d, h) => new Date(2026, m - 1, d, h == null ? 12 : h).getTime();
const MON = at(10, 26);

/* ── 1. the add-on's day, as the checklist ─────────────────────────────── */
group('The add-on\'s day is filed and read back as the day\'s checklist');
{
  const c = hub(), B = c.AnkiBridge;
  ok(B.today(MON) === null, 'before anything arrives there is no add-on day, and the Almanac keeps the protocol rows');
  ok(B.ingest(PAYLOAD, MON) === true, 'the payload bridge.py makes is accepted');
  ok(B.ingest(PAYLOAD, MON) === false, 'the same one twice is not filed twice');
  const t = B.today(MON);
  ok(t && t.date === '2026-10-26' && t.tasks.length > 3, 'Monday has the add-on\'s tasks (' + (t && t.tasks.length) + ')');
  ok(t.tasks.some((x) => x.subject === 'histo' && /Histology lab/.test(x.title)), 'including Monday\'s histology lab, as the add-on words it');
  ok(t.card && t.card.target.anking === 21, 'and today\'s card plan');
  ok(B.today(at(10, 27)).card === null, 'a card plan for Monday is not shown as Tuesday\'s');
  ok(B.today(at(11, 9)) && B.today(at(11, 10)) === null, 'the phone has two weeks of plan ahead, and nothing past it');
  const raw = JSON.parse(c.__store[B.KEY]);
  ok(!raw.anki.days && Object.keys(raw.days).length === 22, 'days are kept apart from the rest, so history outlives the next sync');
}

/* ── 2. two writers: the newer tick wins ───────────────────────────────── */
group('A tick here and a tick in Anki: the newer counts, un-ticking included');
{
  const c = hub(), B = c.AnkiBridge;
  const p = JSON.parse(JSON.stringify(PAYLOAD));
  const tid = p.days['2026-10-26'].find((x) => x.subject === 'histo').id;
  p.checks[tid] = { v: 'done', t: '2026-10-26T09:00:00Z' };
  B.ingest(p, MON);
  ok(B.status(tid) === 'done', 'ticked in Anki shows ticked here');
  B.tick(tid, false, Date.parse('2026-10-26T10:00:00Z'));
  ok(B.status(tid) === null, 'an un-tick here, later, wins');
  ok(c.__timers.length === 1, 'and is sent on shortly after');
  const p2 = JSON.parse(JSON.stringify(p)); p2.at = '2026-10-26T12:00:00Z';
  p2.checks[tid] = { v: 'done', t: '2026-10-26T11:00:00Z' };
  B.ingest(p2, MON);
  ok(B.status(tid) === 'done', 'a tick in Anki later than that wins back');
  const out = B.outbound({ checks: { [tid]: { v: null, t: '2026-10-26T08:00:00Z' }, other: { v: 'done', t: '2026-10-25T08:00:00Z' } } });
  ok(out.checks[tid].t === '2026-10-26T10:00:00Z' && out.checks.other, 'what goes out merges with what another device already sent, newest per tick');
}

/* ── 3. leftovers ──────────────────────────────────────────────────────── */
group('Leftovers follow the add-on\'s rule');
{
  const c = hub(), B = c.AnkiBridge;
  B.ingest(PAYLOAD, MON);
  const fri = PAYLOAD.days['2026-10-23'];
  const t = B.today(MON);
  ok(t.leftovers.every((x) => x.from >= '2026-10-23' && x.from <= '2026-10-25'), 'only the last three days');
  ok(!t.leftovers.some((x) => x.kind === 'test' || x.kind === 'lab' || x.kind === 'note'), 'only work, never a class or a note');
  const evOf = (x) => PAYLOAD.events.find((e) => e.id === x.event);
  ok(!t.leftovers.some((x) => (x.kind === 'read' || x.kind === 'questions') && x.event && evOf(x) && evOf(x).date < '2026-10-26'),
     'prep for a test already sat is not carried');
  const one = t.leftovers[0];
  if (one) { B.tick(one.id, true, MON); ok(!B.today(MON).leftovers.some((x) => x.id === one.id), 'ticking a leftover clears it'); }
  else ok(fri !== undefined, 'no leftovers on this plan to tick');
}

/* ── 4. the past week and the grades chart use the add-on's rows ───────── */
group('Study Control\'s past week and grades chart read the add-on\'s days');
{
  const c = hub(), B = c.AnkiBridge, SC = c.StudyControl;
  B.ingest(PAYLOAD, MON);
  const mon = B.dayTasks('2026-10-26');
  ok(mon.every((r) => ['id', 'subj', 'text', 'must', 'done'].every((k) => k in r)) && mon.some((r) => r.subj === 'histology'),
     'a day\'s tasks come as Study Control rows, subjects in its names');
  B.tick(mon[0].id, true, MON);
  const wk = SC.weekBack(SC.read(), MON);
  const today = wk[wk.length - 1];
  ok(today.total === mon.length && today.done === 1, 'the week strip counts the add-on\'s tasks (' + today.done + '/' + today.total + ')');
  SC.badDay(true, MON);
  ok(SC.weekBack(SC.read(), MON).pop().bad, 'a bad day is still this site\'s, with its minimum');
}

/* ── 5. the two calendars ─────────────────────────────────────────────── */
group('A class dated alike in both is linked; then a move on either side moves both');
{
  const c = hub(), B = c.AnkiBridge, SC = c.StudyControl;
  B.ingest(PAYLOAD, MON);
  const s = B.read();
  ok(s.links['phys-lab05'] === 'phy-2026-10-30', 'physiology lab 5 (30 Oct) is linked to Study Control\'s entrance test of 30 Oct');
  ok(s.links['histo-C3'] === 'his-W3', 'histology class 3 to W3, both on 19 Oct');
  /* moved in Study Control */
  const sc = SC.read(); sc.events['phy-2026-10-30'].date = '2026-10-29'; SC.write(sc, MON);
  const r = B.reconcile(Date.parse('2026-10-26T13:00:00Z'));
  ok(r.sent.includes('phys-lab05') && B.read().moves['phys-lab05'].date === '2026-10-29', 'a move in Study Control goes to the add-on');
  ok(B.reconcile(Date.parse('2026-10-26T13:05:00Z')).sent.length === 0, 'once, not on every sync');
  /* the add-on's older date arrives before it has applied the move: not put back */
  const stale = JSON.parse(JSON.stringify(PAYLOAD)); stale.at = '2026-10-26T13:10:00Z';
  stale.events.find((e) => e.id === 'phys-lab05').moved_at = '2026-10-20T00:00:00Z';
  B.ingest(stale, MON);
  ok(SC.read().events['phy-2026-10-30'].date === '2026-10-29', 'the add-on\'s older date does not undo it');
  /* moved in Anki, later */
  const later = JSON.parse(JSON.stringify(PAYLOAD)); later.at = '2026-10-27T08:00:00Z';
  const ev = later.events.find((e) => e.id === 'phys-lab06');
  ev.date = '2026-11-05'; ev.moved_at = '2026-10-27T07:00:00Z';
  B.ingest(later, at(10, 27));
  ok(SC.read().events['phy-2026-11-06'].date === '2026-11-05', 'a move made in Anki moves Study Control\'s class');
  ok(B.reconcile(at(10, 27, 14)).sent.length === 0, 'and is not sent back as if it were a move made here');
}

/* ── 6. disagreements ──────────────────────────────────────────────────── */
group('Classes the two calendars date differently are listed, and settled once');
{
  const c = hub(), B = c.AnkiBridge, SC = c.StudyControl;
  B.ingest(PAYLOAD, MON);
  const D = B.disagreements();
  const c4 = D.find((d) => d.anki === 'histo-C4');
  ok(c4 && c4.site === 'his-W4' && c4.ankiDate === '2026-10-26' && c4.siteDate === '2026-11-05',
     'histology class 4: Anki says 26 Oct, Study Control 5 Nov');
  ok(D.every((d) => d.ankiDate !== d.siteDate), 'only real disagreements are listed');
  /* Shipped broken in review: matched on the date alone, the add-on's class 7
     (circulatory, 30 Nov) was linked to Study Control's W6 (blood, also 30
     Nov) — moving one would have moved a different class. */
  ok(B.read().links['histo-C7'] !== 'his-W6', 'a date shared by two different classes does not link them');
  ok(D.some((d) => d.anki === 'histo-C7' && d.site === 'his-W7') && D.some((d) => d.anki === 'histo-C6' && d.site === 'his-W6'),
     'circulatory pairs with circulatory, blood with blood');
  ok(new Set(D.map((d) => d.site)).size === D.length, 'each Study Control class is paired at most once');
  B.adopt('histo-C4', 'his-W4', 'anki', MON);
  ok(SC.read().events['his-W4'].date === '2026-10-26' && B.read().links['histo-C4'] === 'his-W4', '"use Anki\'s" moves the class here and links them');
  ok(B.reconcile(MON).sent.length === 0, 'and sends nothing back');
  const e7 = D.find((d) => d.subject === 'embryology');
  if (e7) {
    B.adopt(e7.anki, e7.site, 'site', MON);
    ok(B.read().moves[e7.anki].date === e7.siteDate, '"use this page\'s" sends the date to the add-on');
  } else ok(true, 'no embryology disagreement on this plan');
  ok(!B.disagreements().some((d) => d.anki === 'histo-C4'), 'a settled one leaves the list');
  const bad = B.read(); bad.links['histo-C7'] = 'his-W6'; bad.seen['his-W6'] = '2026-11-30';
  c.localStorage.setItem(B.KEY, JSON.stringify(bad));
  B.reconcile(MON);
  ok(!B.read().links['histo-C7'], 'a link between two different classes, however it was made, is dropped on the next sync');
}

/* ── 7. what goes to the add-on, and the pairing code ──────────────────── */
group('The add-on is sent the results and the whole Study Control, and is paired as you');
{
  const user = { uid: 'u1', refreshToken: 'rt-1' };
  const c = hub({}, {
    APP_CONFIG: { firebase: { apiKey: 'AIza-x', projectId: 'p-1' } },
    location: { origin: 'https://linomass36.github.io' },
    firebase: { apps: [1], auth: () => ({ currentUser: user }), firestore: () => ({}) }
  });
  const B = c.AnkiBridge, SC = c.StudyControl;
  const out = B.outbound(null);
  ok(out.results.length === Object.keys(SC.read().results).length && out.results[0].score != null, 'every result goes, with its score');
  ok(out.studyControl && out.studyControl.events, 'and the whole Study Control store, so the add-on\'s export holds both sides');
  const code = B.pairingCode();
  const doc = JSON.parse(Buffer.from(code.slice(7).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  ok(code.startsWith('cthub1.') && doc.uid === 'u1' && doc.refreshToken === 'rt-1' && doc.apiKey === 'AIza-x' && doc.projectId === 'p-1',
     'the pairing code carries this sign-in, in the form bridge.py decodes');
  ok(!JSON.stringify(c.__store).includes('rt-1'), 'and is never stored');
  const py = cp.execFileSync('python3', ['-I', '-c', `
import sys, types, importlib.util, os
P = sys.argv[1]
pkg = types.ModuleType("year2_hub"); pkg.__path__ = [P]; sys.modules["year2_hub"] = pkg
def load(n):
    s = importlib.util.spec_from_file_location("year2_hub." + n, os.path.join(P, n + ".py"))
    m = importlib.util.module_from_spec(s); sys.modules["year2_hub." + n] = m; s.loader.exec_module(m); return m
load("tasks"); BR = load("bridge")
print(BR.decode_pairing(sys.argv[2])["uid"])`, path.join(ROOT, 'tools', 'anki-addon', 'year2_hub'), code]).toString().trim();
  ok(py === 'u1', 'and the add-on\'s decoder reads it');
}

/* ── 8. export ─────────────────────────────────────────────────────────── */
group('Export holds both sides, and the CSV survives commas and quotes');
{
  const c = hub(), B = c.AnkiBridge, SC = c.StudyControl;
  B.ingest(PAYLOAD, MON);
  const s = SC.read();
  s.results.q = { date: '2026-10-23', subject: 'physiology', kind: 'entrance', title: 'Ch 47, "pain"', score: 9, max: 10, causes: ['recall'], createdAt: '2026-10-23T14:00:00Z' };
  SC.write(s, MON);
  const all = B.exportAll(MON);
  ok(all.website.studyControl.results.q && all.addon.tasks.length > 20 && all.addon.calendar.length > 50, 'the website\'s store, the add-on\'s tasks and calendar');
  ok(!all.addon.tasks.some((t) => t.date > '2026-10-26'), 'tasks up to today, not the plan ahead');
  const line = B.resultsCSV().split('\n').find((l) => /pain/.test(l));
  ok(line === '2026-10-23,physiology,entrance,"Ch 47, ""pain""",9,10,90,,recall,,q', 'a title with a comma and quotes stays one cell (' + line + ')');
  ok(B.tasksCSV(MON).split('\n')[0] === 'date,subject,kind,title,min,floor,status,detail,id', 'tasks export with a header row');
}

/* ── 9. the pages ──────────────────────────────────────────────────────── */
group('The pages ask the bridge');
{
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const al = strip(read('Almanac.html')), sc = strip(read('Study Control.html'));
  ok(/anki-bridge\.js/.test(read('Almanac.html')) && /anki-bridge\.js/.test(read('Study Control.html')), 'both load anki-bridge.js');
  ok(/AB\.today\(\)/.test(al) && /AB\.tick\(/.test(al) && /AB\.start\(render\)/.test(al), 'the Almanac shows and ticks the add-on\'s day, and repaints when one arrives');
  ok(/AnkiBridge\.reconcile\(\)/.test(sc.split('function persist')[1].split('\n')[0] + sc.split('function persist')[1].split('\n')[1] + sc.split('function persist')[1].split('\n')[2]),
     'Study Control hands every save to the bridge, so a class moved here reaches Anki');
  ok(/function reloadFromBridge\(\)\{store=SC\.read\(\)/.test(sc) && /AB\.start\(reloadFromBridge\)/.test(sc),
     'and reloads its in-memory store after a sync, so a class moved by Anki is not saved back over');
  ok(/AB\.exportAll\(\)/.test(sc) && /AB\.resultsCSV\(\)/.test(sc) && /AB\.tasksCSV\(\)/.test(sc), 'export buttons for everything, results and tasks');
  ok(!/refreshToken/.test(read('anki-bridge.js').replace(/pairingCode[\s\S]*?\n  }\n/, '')), 'the sign-in token appears nowhere but the pairing code');
}

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
