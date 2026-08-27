/* ─────────────────────────────────────────────────────────────
   ONE CONFIG FILE for the whole site (gate + every hub page).
   Fill these in once. It is safe to commit: Firebase web config
   is public by design — security comes from Auth + Firestore Rules,
   not from hiding these values.
   ───────────────────────────────────────────────────────────── */
window.APP_CONFIG = {
  // Build version, stamped by the deploy Action on every push. If you ever open
  // a page straight from the repo (no build step) this literal token shows —
  // that's expected; the live site always has the real number.
  version: '__APP_VERSION__',

  // The ONLY Google account allowed in. Everyone else gets the prank.
  authorizedEmail: 'staniszewski.gabriel.k@gmail.com',

  // Where the owner lands after signing in, and where intruders are bounced back to.
  // The Standing is the glance: what is owed today, what is held, and every
  // page on one filterable list. Mission Control is still there — it is the
  // workshop now rather than the front door.
  hubUrl: 'Standing.html',

  // The Standing was built phone-first and gets shorter on a bad day, so a
  // phone and a desktop want the same page. Set to '' to send phones to hubUrl.
  mobileHubUrl: '',
  gateUrl: 'index.html',

  /* ── Google Calendar ──────────────────────────────────────────────
     The Week page reads what is already committed and lays the training
     into what is left. There are three ways it can get the week, and they
     differ in whether they need you to press anything:

       AUTOMATIC — needs `id` and `apiKey` below, and the calendar set to
       public. The Calendar API on www.googleapis.com sends CORS headers, so
       the browser fetches it directly on page load: no popup, no token to
       expire, works on the phone. An API key is a public credential — the
       same kind as the Firebase one above — and is restricted by HTTP
       referrer so only this site may use it.

       THE COST of automatic is that a public calendar is world-readable by
       anyone holding its id. For a clinical schedule that is a real
       decision, not a formality. Google's "see only free/busy information"
       setting is the middle ground: the hours stay visible, the titles do
       not, and the planner only needs the hours.

       ON REQUEST — leave `apiKey` empty and press the button. Signs in with
       the Google account you already use, asking for calendar.readonly. The
       calendar stays private. Firebase hands the browser no refresh token,
       so this is one popup per session.

       OFFLINE — drop an .ics export. No credential, no network.

     `id` is the calendar to read. Not "primary": a subscribed or imported
     timetable has its own id, ending @import.calendar.google.com or
     @group.calendar.google.com, and reading `primary` would return an empty
     week. Find it in Calendar → the calendar → Settings → Calendar ID.  */
  calendar: {
    id: 'dtbsph5r3al99g399tmjb6am2ce59s72@import.calendar.google.com',
    apiKey: '',          // paste to enable automatic reads; empty = press the button
    tz: 'America/Phoenix'
  },

  // Firebase → Project settings → General → "Your apps" → Web app → SDK config.
  firebase: {
    apiKey: "AIzaSyAFOnOR32sfUEqN7jYkxLJnNuj2fiaXJRM",
    authDomain: "master-648ee.firebaseapp.com",
    projectId: "master-648ee",
    appId: "1:73939921858:web:1dc53474505b5319cc045b"
  }
};