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
  hubUrl: 'Hub.dc.html',
  gateUrl: 'index.html',

  // Firebase → Project settings → General → "Your apps" → Web app → SDK config.
  firebase: {
    apiKey: "AIzaSyAFOnOR32sfUEqN7jYkxLJnNuj2fiaXJRM",
    authDomain: "master-648ee.firebaseapp.com",
    projectId: "master-648ee",
    appId: "1:73939921858:web:1dc53474505b5319cc045b"
  }
};