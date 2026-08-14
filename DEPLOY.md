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

## The shelf, and opening a book
The **▦ Shelf** view binds every book in leather cut from its shelf's colour —
faded cloth until you start it, deep hide once you do, a red ribbon hanging out
of whatever you're reading now, and gilt on the ones you've finished. Hover and
the book draws half out of the shelf.

Click and it comes off the shelf properly: the book lifts out of its slot
spine-first, turns to face you and grows as it crosses to the middle of the
screen, and only then does the cover swing open on its hinge — showing the
endpaper on its back — and dissolve as the page grows in behind it. It leaves a
gap on the shelf while it's in the air. Opened from anywhere without a spine to
fly from (a list row, a plan step) the same board grows out of the middle
instead, and with the OS set to reduce motion it skips straight to the page.

An open book holds everything about it in one place:

- **Want to read / Reading now / Finished reading** — one tap each, and the
  started/finished dates are stamped for you.
- **Where you are** — free text, so `p. 128 of 402`, `ch. 9` or `01:12:30` all work.
- **How long** — the length of the book, which is what its thickness on the
  shelf is drawn from. `402`, `402 pages` and `9h` (an audiobook, counted at 45
  pages an hour) all parse.
- **Notes** — each one stamped with the moment you wrote it *and* the place in
  the book it belongs to. Add the place, write the note, and it files itself
  newest-first. Writing a note marks the book as being read.
- **Reflection** — the four questions from the old reading log, saved as you type.

The **open ▸** link on any row in the list view opens the same book.

### What decides a book's size
Three dimensions, and only one of them means anything:

- **Thickness is length.** A twelve-page essay is a pamphlet, a 1,200-page novel
  is a brick. The scale is a square root, so the range stays shelf-like: 12pp is
  about 18px, 300pp about 39px, and anything past 1,100pp is capped at 58px. The
  length comes from the first of these that exists — the **how long** field, a
  `pages` given at import, the total written into **where you are** (`p. 128 of
  402`), or, for a journal article, an assumed couple of dozen pages. That last
  default is why the publication shelves are all slim. A book whose length is
  unknown sits in a modest middle band until you tell it otherwise.
- **Height is decorative.** It is a stable hash of the book's id, spread over
  112–167px. It carries no meaning: it exists because a row of identical
  rectangles reads as a bar chart rather than a shelf, and hashing the id (rather
  than randomising) means a given book is always exactly the same height, on
  every device, forever.
- **Depth** — how far a book runs back into the shelf — is the same hash trick,
  and only shows when a book tips out on hover.

## Reading plans
A plan is the form advice actually arrives in: a piece of prose explaining what
this is for, and an order — read this first, then this, and here's why. The
**◈ Plans** view holds them.

The usual way one arrives is a paste. Ask a chat for a reading list, copy the
prompt from **Import → copy prompt** (it now describes plans as well as books),
and paste back what it returns. Books and the plan come in together: a step
names its book by title, and if the list has never heard of that title the step
carries enough to create it. The paste lands you on the plans view.

Inside a plan: the prose renders with its **bold** and *italics*, the steps are
numbered in reading order with their "when" (`this week`, `alongside whatever
else`) and the reasoning for that position, each showing its live status.
**Start the next one** marks the first unread step as reading. Clicking a step's
title opens that book — notes, dates and all — and closing it puts you back in
the plan. A book that belongs to a plan shows which one, and which step it is.

**✎ edit** turns on the editor: retitle the plan, rewrite the prose, reorder
steps with ▲▼, drop them, edit any step's when and why, and add new steps by
searching your books. **＋ New plan** starts an empty one.

Plans are part of the same export/import as everything else, and they sync to
Obsidian as their own notes in a `Plans` subfolder — one note per plan, prose
under `## Why this plan`, and the order as a numbered list of `[[wikilinks]]`
to the individual book notes, so a plan is navigable inside the vault. Edit it
there — reorder the list, rewrite a step's reasoning, add a numbered line for a
book that isn't on the list yet — and the next sync brings it back, creating any
book the new step needs. Deleting a plan here deletes its note there.

## Syncing with Obsidian
One book = one Markdown note, and it goes both ways: write in Obsidian or write
on the site, and a sync reconciles the two. Open **◆ Obsidian** in the toolbar
and pick a transport:

**Vault folder** (simplest — Chrome or Edge on a desktop). Click *Connect your
vault folder…* and choose your vault. The browser writes the notes straight to
disk with the File System Access API; Obsidian picks them up at once. The folder
permission is remembered, so later visits sync quietly on load.

**Local REST API** (works from any device that can reach the machine running
Obsidian). Install the *Local REST API* community plugin, paste its key and
address here, and open `https://127.0.0.1:27124` once in the same browser to
accept the plugin's self-signed certificate. Then *Test*, then *Sync now*.

What a note looks like — the frontmatter is the state, the body is your thinking:

```markdown
---
ct_id: "ct7"
title: "Partial heart transplantation for growing valves"
author: "Turek et al., JAMA, 2024"
shelf: "Cardiothoracic & transplant"
status: reading
progress: "p. 3 of 9"
started: 2026-02-01
finished:
tags: [reading/transplant]
updated: 2026-08-11T21:04:00.000Z
source: reading-list
---

# Partial heart transplantation for growing valves

## Notes

- **2026-08-11 12:30 · p. 42** — the growth potential is the whole thesis

## Reflection

### The main takeaway?
a valve that grows with the child
```

Rules worth knowing:

- **Nothing is clobbered.** Each sync remembers what it last wrote, so an edit
  made in Obsidian and an edit made on the site both survive; only a field
  changed on one side moves. Delete a note bullet in Obsidian and it stays
  deleted here.
- **Books you haven't touched stay out of the vault**, unless you tick *write a
  note for every book*.
- **New books can start in Obsidian.** Drop a note in the folder with a
  frontmatter block and a title (the panel has a template) and the next sync
  pulls it in as a book and stamps a `ct_id` into it.
- **Filenames never change.** Retitling a book rewrites the note's contents but
  leaves the file where it is, so `[[wikilinks]]` to it keep working.
- Set a **vault name** in the panel to make the per-book **◆ Obsidian ↗** button
  open the real note in the app.

Settings live in `localStorage` under `ct_obsidian_cfg_v1` and sync-state per
book under `obsidian` in `ct_reading_v1` — so, like everything else here, they
follow you across devices. The vault folder handle itself is per-device
(IndexedDB), which is right: it points at a folder on that machine.

---

## How it behaves
- **You, signed in as `authorizedEmail`** → land in the hub; localStorage syncs to Firestore and across your devices in real time.
- **Anyone else** → the **ACCESS VIOLATION** prank, then bounced. Hub pages are protected too: opening one directly without the owner session redirects to the gate.

## Files in this system
- `config.js` — the one place you edit (owner email + Firebase keys).
- `sync.js` — Firestore ↔ localStorage sync + owner-only guard. Loaded on hub pages. Shows a small **sync-status pill** (bottom-left): grey = off / sign-in / local-only, amber = saving, green = synced, red = not syncing. Tap it for a panel showing the account, both revisions, the size of what this device is holding, its biggest keys, and **which keys have not made it to the cloud yet** — that last line is the one that answers "why isn't this on my other device". The panel's **Sync now** pulls before it pushes, so one tap brings a device that missed an update back in line. `window.hubSync.state` / `window.hubSync.syncNow()` do the same from the console.

  **How a push works.** It is not an overwrite. The device reads the cloud
  first and merges: the cloud's copy, plus the keys *this device actually
  edited* since its last push, plus any key the cloud has never seen. So a
  phone carrying a week-old copy can only ever affect what was typed into
  it — it cannot stamp its whole localStorage over an evening's work on the
  laptop. If the cloud moved on since this device last applied it, that is
  pulled in first and the reload re-pushes.

  **Undo.** Whatever an incoming change lands on top of is kept on the
  device first. If a sync arrives and takes something you wanted, tap the
  pill → **Undo last sync**: it puts this device's previous copy back and
  pushes it, so the correction reaches your other devices too.

  **When a device stops syncing, the pill says which of these it is:**
  - *Sync library blocked* — the Firebase SDK could not be fetched from `gstatic.com`. Content blockers, a VPN, iCloud Private Relay and locked-down wifi all do this. It retries each script twice, and again whenever the network returns or you come back to the tab.
  - *Sign in to sync* — not signed in as `authorizedEmail` on that device; it runs local-only.
  - *Blocked: publish Firestore rules* — the rules from step 1 above were never published.
  - *Too big: N MB* — everything in localStorage goes into **one** Firestore document, and a document tops out at 1 MiB. Nothing syncs past that. The panel's "biggest" line names the keys to prune.
  - *Waiting to read the cloud* — this device could not read the cloud, so it deliberately will not write over it either (otherwise a phone with a months-old copy could wipe the laptop's). It retries every 15s.
- `obsidian.js` — the Reading List ↔ Obsidian bridge: the Markdown note formats (one per book, one per reading plan), their parsers, the three-way merges, and the two transports (vault folder via the File System Access API, or the Local REST API plugin). Loaded by the Reading List page only.
- `nav.js` — the bookmark sidebar: a slide-in drawer (top-right button, or swipe in from the right edge) listing every hub page (current one highlighted) plus your own saved links (`hub_bookmarks_v1`, so they sync). Also holds the **Dark mode** toggle (`hub_theme_v1`). Injected on hub pages.
- `manifest.json` + `sw.js` + `icons/` — the installable-PWA layer. Add the site to your home screen to get an app icon, full-screen launch, and offline support. The service worker is network-first for pages (new deploys land at once) and cache-busts by version; the deploy stamps the version into it so each push updates the installed app.
- `index.dc.html` — the gate (Google sign-in + intruder prank). Becomes `index.html` at deploy.
- `.github/workflows/deploy.yml` — builds `_site/` and deploys to Pages on every push.
- `.github/inject.py` — injects the sync shim into hub pages at build time.

## Local preview without Firebase
Until `config.js` is filled in, the gate runs in **preview mode**: a "preview the intruder screen" link appears, and `?intruder=1` in the URL jumps straight to the prank. Hub pages run local-only (no cloud sync) — nothing breaks.
