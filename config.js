/* ─────────────────────────────────────────────────────────────
   ONE CONFIG FILE for the whole site (gate + every hub page).
   Fill these in once. It is safe to commit: Firebase web config
   is public by design — security comes from Auth + Firestore Rules,
   not from hiding these values.
   ───────────────────────────────────────────────────────────── */
window.APP_CONFIG = {
  // The ONLY Google account allowed in. Everyone else gets the prank.
  authorizedEmail: 'you@gmail.com',

  // Where the owner lands after signing in, and where intruders are bounced back to.
  hubUrl: 'Hub.dc.html',
  gateUrl: 'index.html',

  // Firebase → Project settings → General → "Your apps" → Web app → SDK config.
  firebase: {
    apiKey: 'PASTE_FIREBASE_API_KEY',
    authDomain: 'PASTE_PROJECT_ID.firebaseapp.com',
    projectId: 'PASTE_PROJECT_ID',
    appId: 'PASTE_APP_ID'
  }
};
