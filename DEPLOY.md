# Deploy the hub to GitHub Pages (with cross-device sync)

Your workflow forever after: **drop the new export in the repo → `git push` → done.**
The sync layer lives in the repo, separate from the export, and re-applies itself on every push.

---

## One-time setup (~1 evening)

### 1. Firebase project (5 min)
1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (disable Analytics, it's fine).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.**
3. **Build → Firestore Database → Create database** → *Production mode* → pick a region.
4. Firestore → **Rules** tab, paste this, **Publish**:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /hubData/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
   *(Your data, only you — enforced server-side. This is why the public config key is safe.)*
5. **Project settings ⚙ → General → Your apps → Web (`</>`)** → register an app → copy the `firebaseConfig` values.

### 2. Fill in `config.js`
Open `config.js` and set:
- `authorizedEmail` → your Google address (the only account that gets in).
- `firebase` → the `apiKey` / `authDomain` / `projectId` / `appId` you just copied.

Commit it. **It is safe to commit** — Firebase web config is public by design; Auth + the Firestore rule above are what protect the data.

### 3. Push to GitHub + turn on Pages
```bash
git init && git add . && git commit -m "hub"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```
- Repo **Settings → Pages → Build and deployment → Source: GitHub Actions.**
- In Firebase → Authentication → **Settings → Authorized domains**, add `<you>.github.io`.

The **Deploy** Action runs on that push: it renames `index.dc.html` → `index.html` (the gate becomes your front door) and injects `config.js` + `sync.js` into every hub page. Your site goes live at `https://<you>.github.io/<repo>/`.

---

> **Pages source must be _GitHub Actions_** (Settings → Pages → Source). The
> sync shim + version stamp are applied at build time, so the site has to be
> served from the Action's build — not straight from the branch.

## Adding a new export later
1. Overwrite the changed `.dc.html` / `.html` files in the repo with your fresh exports.
2. `git push`.

That's it. The Action re-injects the sync shim automatically — you never hand-patch a file.

## Versioning (automatic)
The `VERSION` file holds the current number (e.g. `3.1`). On every push to `main`
the Deploy Action **bumps the last component** (`3.1 → 3.2 → 3.3 …`), commits the
new `VERSION` back, and stamps it into every page — the "· vX.Y" next to *Mission
Control* on the Hub, and `window.APP_CONFIG.version` everywhere. You never edit it
by hand for routine pushes. To jump a major version, edit `VERSION` yourself (e.g.
set `4.0`); the next push continues from there (`4.1`, `4.2` …).

*(The bump commit is pushed with the built-in `GITHUB_TOKEN`, which by design does
not trigger another workflow run — so it can't loop.)*

## Adding books yourself
The **Reading List** page has a **＋ Add a book** button (top-right of the shelf
filters). Enter a title (author + note optional) and it lands in an **Added by
you** shelf, cycles through *to read → reading → read* like any other, and can be
removed via the **remove** link on the row. Your additions live in `localStorage`
under `ct_reading_books_v1`, so once sync is on they follow you across devices.

---

## How it behaves
- **You, signed in as `authorizedEmail`** → land in the hub; localStorage syncs to Firestore and across your devices in real time.
- **Anyone else** → the **ACCESS VIOLATION** prank, then bounced. Hub pages are protected too: opening one directly without the owner session redirects to the gate.

## Files in this system
- `config.js` — the one place you edit (owner email + Firebase keys).
- `sync.js` — Firestore ↔ localStorage sync + owner-only guard. Loaded on hub pages.
- `nav.js` — the bookmark sidebar: a slide-in drawer (top-right button, or swipe in from the right edge) listing every hub page (current one highlighted) plus your own saved links (`hub_bookmarks_v1`, so they sync). Also holds the **Dark mode** toggle (`hub_theme_v1`). Injected on hub pages.
- `manifest.json` + `sw.js` + `icons/` — the installable-PWA layer. Add the site to your home screen to get an app icon, full-screen launch, and offline support. The service worker is network-first for pages (new deploys land at once) and cache-busts by version; the deploy stamps the version into it so each push updates the installed app.
- `index.dc.html` — the gate (Google sign-in + intruder prank). Becomes `index.html` at deploy.
- `.github/workflows/deploy.yml` — builds `_site/` and deploys to Pages on every push.
- `.github/inject.py` — injects the sync shim into hub pages at build time.

## Local preview without Firebase
Until `config.js` is filled in, the gate runs in **preview mode**: a "preview the intruder screen" link appears, and `?intruder=1` in the URL jumps straight to the prank. Hub pages run local-only (no cloud sync) — nothing breaks.
