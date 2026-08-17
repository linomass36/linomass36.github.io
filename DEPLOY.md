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

## On a phone
The phone is not a smaller copy of the desktop page — it shows what you need
at a glance and lets you put things in.

- **Signing in on a phone lands on Today**, not on Mission Control. Mission
  Control is a wall of nine panels built for a wide screen; Today is one column
  you read top to bottom in a thumb's reach. A desktop still lands on Mission
  Control. The page is set by `mobileHubUrl` in `config.js` — set it to `''` to
  send phones to the desktop hub as well.
- **A tab bar along the bottom** (phones only) with Today, Reading, Journal, Log
  and Review, current one lit. Everything else stays in the drawer, but the five
  you use daily are one tap, not two.
- **The Reading List opens on what you're reading.** A *Reading now* card sits
  above everything: each book with where you are in it, **✎ note** (straight into
  the note box) and **✓ finished**.
- **Shelves start closed on a phone.** Thirty-one open shelves was fifty-five
  screens of scrolling; closed, the whole list is about five and you open the one
  you want. On a desktop they still start open. Either way, once you open or
  close a shelf yourself that choice is remembered.
- **The desktop blurb is hidden** and the header is one line.
- **The rare actions fold** behind one **⋯ more** chip — Surprise me, Obsidian,
  Import, Export. Search, the three views and ＋ Add a book stay out in the open.

- **The Summer Sprint's moves are list items.** On a phone a move is one
  full-width row you tap anywhere on — a 22px checkbox and the text, 50px tall
  — and the ✕ *cut* and → *carry* buttons come off entirely: each opens a
  prompt asking for a reason, which is a desk decision, and a 12px glyph with
  2px of padding was never a phone control. The phases and the boards below
  them start closed, each heading showing its own tally, and the habit grid
  restacks so the seven days are thumb-sized buttons with the day letter
  inside. The one section open by default is the habit grid — it is the daily
  tap. A desktop keeps all of it: four columns, both buttons, nothing
  collapsed.
- **Plan Analysis opens on its summary.** It is an essay; on a phone you get
  the three counters, the verdict and its two lists, then ten headings you open
  one at a time.
- **The drawer's rows are 44px**, not 37 — eighteen links in a column, and a
  row that misses the thumb by 3px misses it eighteen times.

Measured on an iPhone 13 viewport, before → after:

| | screens of scroll | controls | under 40px | text under 11px |
|---|---|---|---|---|
| Reading List | 55.1 → 5.6 | 367 → 67 | 166 → 39 | 858 → 75 |
| Summer Sprint | 11.5 → 4.9 | 207 → 61 | 193 → 5 | 85 → 14 |
| Plan Analysis | 20.2 → 4.2 | 29 → 27 | 22 → 1 | 36 → 10 |

Every one of these is a phone-only change behind a `max-width: 640px` query:
the desktop renders at the same height, to the pixel, as it did before.

### Today
`Today.dc.html` is the phone's front door — 2.6 screens, and everything on it
either tells you where you stand or takes something in. It reads and writes the
same localStorage keys as the full pages, so anything typed here shows up on the
desktop (and syncs) exactly as if it had been typed there.

- **The date, and three tiles** — books read this year against your target,
  how many you're reading now, and how far through the master plan you are.
- **Reading now.** Each book you're partway through, with its place, and the two
  buttons that are the whole daily job: **✎** opens a note box right there
  (text plus where you are — page, chapter, timestamp, whatever you type) and
  **✓** marks it finished.
- **The plan bar and this week's priorities**, read-only, so a glance answers
  "am I behind".
- **The quick log.** ⚒ Gym, ≈ Swim and ▲ Climb are buttons, not badges — tap
  one and the day is logged. Beside them a subject and **+15m / +30m / +1h**
  add a block of study. These write the Life Log's own shapes: a training tap
  is `days[date][kind].on`, and a study block is appended to `sessions` as a
  real session ending now — the same record the Life Log's timer writes when
  you stop it, so the day total, the week total and the weekly export all pick
  it up. Open the Life Log afterwards and it is indistinguishable from having
  been logged there.

  One wrinkle worth knowing: the Life Log keys its days by the **UTC** date and
  filters sessions the same way, so a late-evening entry in a positive offset
  lands on the next day's key. That is its convention, and Today copies it
  exactly rather than half-matching it.
- **A journal box.** Type and save; it writes a normal daily entry that the
  Journal page opens.
- **A grid of twelve tiles** to every other page, for when you want the real one.

Nothing on Today is unique to Today: it is a shortcut to the pages, never a
second copy of the data.

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

## Three systems folded in

Three standalone tools became hub pages. They were not three of the same
thing, which is why each went in differently: one is a protocol with a real
state machine, one is a programme that recorded nothing, and one is a document
where only two parts decay.

### Anatomy — the closure log

`Anatomy.dc.html`. Sixty-one blocks across seven regions, and a system that
decides what you do today rather than just listing what there is.

- **Four tiers** — full, half, core, rest. Core is the floor and still counts
  as a day run. Rest is *declared*, costs nothing, and never triggers re-entry;
  only an undeclared absence does.
- **Phase 0** is the gate: blocks studied on an earlier day come back to be
  redrawn cold and scored. 80/80 closes one.
- **Two retests per block**, at D14 and D45, each deferrable rather than
  silently missed. A failed D45 is a reopening, not a bad mark — the block goes
  back to studied-today with both retests cleared.
- **Re-entry** after a break of three days or more: no new blocks, retests
  capped at three a day, and blocks studied but never scored are marked stale
  rather than scored from memory.
- **Seven tripwires** — open loops over five, Phase 0 skipped twice in a week,
  a fortnight since anything was scored on paper, a D45 pass rate under 70%,
  drawing under 60% of reading, more than twenty new cards per closed block,
  and the thorax gate passing unstarted.

The rules live in `anatomy-core.js` and nowhere else, because three pages need
to agree about them — the Anatomy page, Today, and Weekly Review. The syllabus
lives in `anatomy-data.js` and never enters the store.

**It adopts the standalone file's data on first run** from
`anatomy_closure_data` (or the two older keys), migrating through the same
lossless path the original used. It never writes to or deletes the original, so
that file keeps working while you decide you trust this one. A block id that is
no longer in the build is parked in `orphans` rather than dropped.

**One correction on the way in.** The original measured the gap from the last
logged day to *today*, so declaring today's tier set the gap to zero and
switched re-entry off on the spot — the banner's promise of "no new blocks for
two days" could never be kept. The break is now measured where it happened,
between the last two logged days or between the last logged day and today, and
re-entry holds until two days have been logged since it.

**On Today**: the tier and the Phase 0 tick, which are the two things that have
to be possible from a phone. **In Weekly Review**: the week's four numbers and
any tripwire that fired — a panel that stays away entirely until there is
something to report.

### Grind — the nine-week board

`Grind.dc.html`. Five lifting days, a run progression with deloads at weeks
four and eight and a test in week nine, a daily block of McGill work, posture
and mobility, the armor menus, and eight benchmarks.

**There is no start date, on purpose.** The standalone board had a manual week
counter and a checklist keyed by weekday, so it was overwritten every seven
days and tomorrow looked like today whether or not you had done the work. Here
the week advances when its *sessions* are done — five lifts and the runs — so a
fortnight away costs nothing and the board is simply still on week 4, where you
left it. The pips across the top show which weeks are complete.

The programme is in `grind-data.js` and never enters the store; `ct_grind_v1`
holds the record — sessions, run ticks, per-week checklists, and the
benchmarks. Training is **not** merged into the Life Log: this is its own
track, so a grind session and a Life Log gym tick stay separate records.

### Research Plan — the portfolio

`Research Plan.dc.html`. Five tracks across eight quarters. Most of it is still
the document it was — the milestone bars, the dependency view and the
phase-by-phase execution plans are prose, and turning every line into a
checkbox would make them worse.

Two parts are live, because they are the parts that decay if nothing updates
them:

- **The next ninety days** — nine items, each tickable, with the ◉ in-person
  ones called out because those windows close when you leave the States.
- **The decision gates** — five of them, each recording which way it went and
  on what date. A gate with no decision recorded is a track running on
  momentum.

Both live in `ct_research_v1` — **their own track, not the master plan**, so
research progress is counted separately from the summer sprint.

## Files in this system
- `config.js` — the one place you edit (owner email + Firebase keys, and `mobileHubUrl`, where a phone lands).
- `Anatomy.dc.html` + `anatomy-core.js` + `anatomy-data.js` — the closure log: the screen, the rules, and the syllabus. See **Three systems folded in** above.
- `Grind.dc.html` + `grind-data.js` — the nine-week board and its programme.
- `Research Plan.dc.html` — the five-track portfolio, with a live ninety days and live gates.
- `Today.dc.html` — the phone's front door: the day at a glance, plus a note box, a ✓ and a journal box. See **On a phone** above.
- `sync.js` — Firestore ↔ localStorage sync + owner-only guard. Loaded on hub pages. Shows a small **sync-status pill** (bottom-left): grey = off / sign-in / local-only, amber = saving, green = synced, red = not syncing. Tap it for a panel showing the account, both revisions, the size of what this device is holding, its biggest keys, and **which keys have not made it to the cloud yet** — that last line is the one that answers "why isn't this on my other device". The panel's **Sync now** pulls before it pushes, so one tap brings a device that missed an update back in line. `window.hubSync.state` / `window.hubSync.syncNow()` do the same from the console.

  **How a push works.** It is not an overwrite. The device reads the cloud
  first and merges: the cloud's copy, plus the keys *this device actually
  edited* since its last push, plus any key the cloud has never seen. So a
  phone carrying a week-old copy can only ever affect what was typed into
  it — it cannot stamp its whole localStorage over an evening's work on the
  laptop. If the cloud moved on since this device last applied it, that is
  pulled in first and the reload re-pushes.

  **A copy a day.** Each device keeps the last three days of your whole store,
  under a `__sync` key — which means the cloud never sees it (it costs nothing
  against the 1 MB limit) and *an incoming sync cannot overwrite it*. That is the
  point: the copy you want after a bad arrival is the one the arrival could not
  touch. The pill's panel lists the days it holds and restores one with a tap.

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
- `nav.js` — the bookmark sidebar: a slide-in drawer (top-right button, or swipe in from the right edge) listing every hub page (current one highlighted) plus your own saved links (`hub_bookmarks_v1`, so they sync). Also holds the **Dark mode** toggle (`hub_theme_v1`), and on phones the **bottom tab bar** — Today, Reading, Journal, Log, Review. Injected on hub pages.
- `manifest.json` + `sw.js` + `icons/` — the installable-PWA layer. Add the site to your home screen to get an app icon, full-screen launch, and offline support.

  **How offline works, and why it can't go stale.** The worker is
  **network-first**. Online, every request goes to the network and the
  network's answer is what you see — there is no path by which a cached copy
  is preferred over a live one. What comes back is copied into a cache on the
  way past. When a fetch *actually fails*, and only then, the cached copy is
  served: a page you have opened before still opens with no signal, and one
  you never have says so in plain words instead of showing a browser error.

  This matters because the worker used to be **cache-first**, which is why it
  was ripped out: an installed app kept serving yesterday's copy, so the phone
  showed an old layout and no sync. Network-first cannot reproduce that.

  The cache is named for the app version, so a deploy starts a fresh one and
  the old is deleted the moment the new worker activates. Two things are never
  cached: `version.txt`, so the self-heal check can always discover that a new
  version exists, and anything on the Firestore host, so a sync is never
  answered from a cache. Data you type offline was already safe — it goes to
  localStorage immediately and syncs when the signal returns.
- `index.dc.html` — the gate (Google sign-in + intruder prank). Becomes `index.html` at deploy.
- `.github/workflows/deploy.yml` — builds `_site/` and deploys to Pages on every push.
- `.github/inject.py` — injects the sync shim into hub pages at build time.

## Local preview without Firebase
Until `config.js` is filled in, the gate runs in **preview mode**: a "preview the intruder screen" link appears, and `?intruder=1` in the URL jumps straight to the prank. Hub pages run local-only (no cloud sync) — nothing breaks.
