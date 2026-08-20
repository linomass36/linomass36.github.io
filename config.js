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

  // Firebase → Project settings → General → "Your apps" → Web app → SDK config.
  firebase: {
    apiKey: "AIzaSyAFOnOR32sfUEqN7jYkxLJnNuj2fiaXJRM",
    authDomain: "master-648ee.firebaseapp.com",
    projectId: "master-648ee",
    appId: "1:73939921858:web:1dc53474505b5319cc045b"
  }
};