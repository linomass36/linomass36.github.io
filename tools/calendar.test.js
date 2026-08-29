/* ─────────────────────────────────────────────────────────────
   calendar.test.js — the week is read off the right calendar, and an
   event lands on the day it happens.

   Run with `node tools/calendar.test.js` from the repo root.

   Two bugs are pinned here, and both were silent — the page rendered a
   perfectly plausible week either way:

     * The events URL was hardcoded to `calendars/primary/events`. A
       subscribed or imported timetable is its own calendar, so reading
       `primary` returned the empty one and drew a blank week that looked
       like it had simply been a quiet week.
     * Events were bucketed by subtracting the week's local midnight from
       the event's timestamp, which is the VIEWER's clock. An Arizona
       evening shift read from Poland moved to the next day — the same
       class of error the health import had.

   And a third, which is why the work hours never turned up: every read went
   through nextWeekRange, so the week you were standing in could not be asked
   for at all. Press the button on a Tuesday and you got the week starting in
   six days; miss one Sunday and this week's committed hours were unreachable
   for good — including by the Trends table, which reads them as `work`.
   ───────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');

function load(calendar, firebase) {
  const ctx = { window: {}, console, JSON, Object, Array, Math, String, Number, Date,
    parseFloat, parseInt, isNaN, isFinite, RegExp, Error, encodeURIComponent,
    APP_CONFIG: { calendar: calendar || {},
                  firebase: firebase || { projectId: 'master-648ee',
                                          appId: '1:73939921858:web:1dc53474505b5319cc045b' } },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setTimeout: () => 0 };
  ctx.sessionStorage = ctx.localStorage;
  ctx.globalThis = ctx; ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'calendar.js'), 'utf8'), ctx, { filename: 'calendar.js' });
  return ctx.window.CTCalendar;
}

let failed = 0;
const ok = (c, what) => { console.log((c ? '  pass  ' : '  FAIL  ') + what); if (!c) failed++; };
const group = (n) => console.log('\n' + n);

const IMPORTED = 'dtbsph5r3al99g399tmjb6am2ce59s72@import.calendar.google.com';

group('It reads the calendar you named, not "primary"');
{
  const C = load({ id: IMPORTED });
  ok(C.calId() === IMPORTED, 'the configured id is used');
  const bare = load({});
  ok(bare.calId() === 'primary', 'and primary is only the fallback when none is set');
  const blank = load({ id: '   ' });
  ok(blank.calId() === 'primary', 'whitespace is not an id');
}

group('Automatic reads need a key, and say so when there is none');
{
  ok(load({ id: IMPORTED }).canAuto() === false, 'no key means no automatic read');
  ok(load({ id: IMPORTED, apiKey: 'AIzaX' }).canAuto() === true, 'a key enables it');
  let msg = '';
  load({ id: IMPORTED }).autoRead(new Date(), new Date(), (e) => { msg = e.message; });
  ok(/api key/i.test(msg), 'and the reason names the key rather than failing blankly');
}

/* ── the week you are in is readable ───────────────────────────────────── */
group('The week you are standing in can be read, not only the next one');
{
  const C = load({ id: IMPORTED });
  const key = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
                     '-' + String(d.getDate()).padStart(2, '0');
  const TUE = new Date(2026, 7, 25);   // Tuesday 25 Aug 2026
  const SUN = new Date(2026, 7, 30);   // the Sunday that ends that week
  const MON = new Date(2026, 7, 24);

  const wk = C.weekRange(TUE);
  ok(key(wk.start) === '2026-08-24', 'the week containing a Tuesday starts on its Monday');
  ok(wk.end - wk.start === 7 * 86400000, 'and runs seven days');

  const tue = C.planningRange(TUE);
  ok(TUE >= tue.start && TUE < tue.end,
     'pressing on a Tuesday asks for the week that Tuesday is in');
  ok(key(tue.start) === '2026-08-24', 'which starts on the Monday just gone');

  const mon = C.planningRange(MON);
  ok(key(mon.start) === '2026-08-24', 'a Monday asks for the week that starts that morning');

  /* Sunday is the ritual: the week it lays out is the one starting tomorrow. */
  const sun = C.planningRange(SUN);
  ok(key(sun.start) === '2026-08-31', 'on a Sunday it is still next week that gets planned');
  ok(!(SUN >= sun.start), 'so the Sunday itself is not in it');

  /* The old behaviour is still available, and still means what it said. */
  ok(key(C.nextWeekRange(new Date(2026, 7, 27)).start) === '2026-08-31',
     'nextWeekRange is unchanged for the callers that want it');

  /* The whole point: a day you can see today carries its committed hours,
     which is what facts.js publishes as the `work` column. */
  const shift = [{ title: 'Clinic', kind: 'work', day: '2026-08-25', allDay: false, hours: 8,
                   start: new Date('2026-08-25T08:00:00'), end: new Date('2026-08-25T16:00:00') }];
  const plan = C.planWeek(shift, { range: tue });
  const today = plan.days.filter((d) => d.key === '2026-08-25')[0];
  ok(!!today && Math.abs(today.committed - 8) < 0.01,
     'and that day comes back with its eight hours on it');
}

/* ── the button stopped being a loop ───────────────────────────────────── */
group('A failed read says which failure it was');
{
  const C = load({ id: IMPORTED });
  const E = (status, body, viaKey) => C.explain(status, body, viaKey);

  /* The payloads Google actually sends. reason lives in error.details[] on
     the newer shape and error.errors[] on the older one, and the two do not
     always agree — both are read. */
  const apiOff = { error: { code: 403, status: 'PERMISSION_DENIED',
    message: 'Google Calendar API has not been used in project 73939921858 before or it is disabled.',
    errors: [{ reason: 'accessNotConfigured', domain: 'usageLimits' }],
    details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'SERVICE_DISABLED' }] } };
  const noScope = { error: { code: 403, status: 'PERMISSION_DENIED',
    message: 'Request had insufficient authentication scopes.',
    errors: [{ reason: 'insufficientPermissions', domain: 'global' }],
    details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
                reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }] } };
  const dead = { error: { code: 401, status: 'UNAUTHENTICATED',
    message: 'Request had invalid authentication credentials.',
    errors: [{ reason: 'authError', domain: 'global' }] } };
  const gone = { error: { code: 404, message: 'Not Found',
    errors: [{ reason: 'notFound', domain: 'global' }] } };
  const limit = { error: { code: 403, message: 'Rate Limit Exceeded',
    errors: [{ reason: 'rateLimitExceeded', domain: 'usageLimits' }] } };

  /* Each of these used to arrive as "the calendar token expired". Only one
     of them is true, and pressing again cannot fix any of the others. */
  ok(E(403, apiOff).code === 'api-off', 'a disabled Calendar API is named as a disabled API');
  ok(E(403, apiOff).tokenIsBad === false, 'and the token is not thrown away over it');

  /* "But I enabled it" — the console shows whichever project it had open,
     which need not be the one the token belongs to. Google names the project
     it actually refused, so print that, and keep Google's sentence: it also
     carries a link with the project number in it. */
  ok(/project 73939921858/.test(E(403, apiOff).message),
     'the refused project is named, not just "this project"');
  ok(E(403, apiOff).said === apiOff.error.message,
     "and Google's own sentence is kept rather than replaced");
  ok(/DIFFERENT project/.test(E(403, apiOff).message),
     'with the reading that answers "but the console said API Enabled"');

  /* The number comes out of the Firebase appId, 1:<projectNumber>:web:<hash>.
     Google never names the project ID, so matching on that alone never fires. */
  const elsewhere = load({ id: IMPORTED }, { projectId: 'other-proj', appId: '1:999:web:x' });
  ok(/different projects/i.test(elsewhere.explain(403, apiOff).message),
     'and a project that is not this hub\'s is called out as the mismatch it is');

  ok(E(403, noScope).code === 'scope', 'a token with no calendar scope is named as that');
  ok(/consent screen/i.test(E(403, noScope).message), 'and points at the consent screen');
  ok(E(403, noScope).tokenIsBad === true,
     'and that token IS dropped, because re-consenting could grant the scope');

  ok(E(404, gone).code === 'not-found', 'an unreadable calendar id is named as one');
  ok(E(403, limit).code === 'rate', 'a rate limit is named as a rate limit');

  ok(E(401, dead).code === 'token', 'and a real 401 is still the expired token');
  ok(E(401, dead).tokenIsBad === true, 'which is dropped');
  ok(/expired/.test(E(401, dead).message), 'with the message that was always right for it');

  /* The key path and the OAuth path share the reader, so the advice must not. */
  ok(/public/.test(E(403, { error: { code: 403, message: 'x' } }, true).message),
     'a bare 403 on the key path still blames the sharing setting');
  ok(!/public|referrer/.test(E(403, { error: { code: 403, message: 'x' } }, false).message),
     'but the popup path is never told to check a referrer it never used');

  /* A body that is not JSON at all must not become a thrown TypeError. */
  ok(E(500, null).code === 'http' && /500/.test(E(500, null).message),
     'an unparseable failure still reports its status');
}

group('An event lands on its own date, not the reader\'s');
{
  const C = load({ id: IMPORTED });
  /* An Arizona evening. Read from anywhere east of Phoenix, subtracting the
     week's local midnight would push this to the next day. */
  const ics = ['BEGIN:VCALENDAR',
    'BEGIN:VEVENT', 'SUMMARY:Clinic', 'DTSTART:20260901T080000', 'DTEND:20260901T160000', 'END:VEVENT',
    'BEGIN:VEVENT', 'SUMMARY:Scribe volunteering', 'DTSTART:20260901T170000', 'DTEND:20260901T200000', 'END:VEVENT',
    'END:VCALENDAR'].join('\r\n');
  const ev = C.parseICS(ics);
  ok(ev.length === 2, 'both events parse');
  ok(ev.every((e) => e.day === '2026-09-01'), 'both carry the date they happen on');

  const range = C.nextWeekRange(new Date(2026, 7, 27));
  const plan = C.planWeek(ev, { range: range });
  const tue = plan.days.filter((d) => d.key === '2026-09-01')[0];
  ok(!!tue, 'the week contains that Tuesday');
  ok(tue.blocks.length === 2, 'and both blocks are on it, not split across midnight');
  ok(Math.abs(tue.committed - 11) < 0.01, 'eight hours of clinic plus three of scribe (' + tue.committed + 'h)');
  ok(Math.abs(tue.free - 4) < 0.01, 'leaving four free (' + tue.free + 'h)');
}

group('The planner works around the week rather than through it');
{
  const C = load({ id: IMPORTED });
  const range = C.nextWeekRange(new Date(2026, 7, 27));
  const busy = [];
  /* Bury Monday and Tuesday completely. */
  ['2026-08-31', '2026-09-01'].forEach((d) => {
    busy.push({ title: 'Clinic', kind: 'work', day: d, allDay: false, hours: 14,
                start: new Date(d + 'T08:00:00'), end: new Date(d + 'T22:00:00') });
  });
  const plan = C.planWeek(busy, { range: range });
  const buried = plan.days.filter((d) => d.key === '2026-08-31' || d.key === '2026-09-01');
  ok(buried.every((d) => !d.session), 'a day with no room gets no session');
  ok(plan.placed.length >= 5, 'the rest of the week still takes the sessions (' + plan.placed.length + ')');
  const keys = plan.placed.map((p) => p.day);
  ok(new Set(keys).size === keys.length, 'and no day is given two');
}

group('A declined invitation is not your week');
{
  const C = load({ id: IMPORTED });
  const range = C.nextWeekRange(new Date(2026, 7, 27));
  const plan = C.planWeek([], { range: range });
  ok(plan.days.length === 7, 'an empty week is still seven days');
  ok(plan.totalCommitted === 0, 'with nothing committed');
  ok(plan.placed.length === 6, 'and every session placed');
}

console.log(failed ? '\n' + failed + ' failed' : '\nall green');
process.exit(failed ? 1 : 0);
