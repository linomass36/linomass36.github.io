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
         match /archive/{doc} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }
       }
     }
   }
   ```
   *(Your data, only you — enforced server-side. This is why the public config key is safe.)*

   **The `archive` line matters.** A Firestore document tops out at 1 MiB, and
   the store grows about 444 KB a year — without somewhere to put the older
   quarters, syncing stops at around month 20. That subcollection is where they
   go. If the rule is missing, nothing breaks and nothing is lost: the hub
   detects the refusal, falls back to pushing everything in the one document
   exactly as before, and the sync panel says **archive blocked — publish the
   rule**. See **The ceiling, removed** below.
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

## Twenty-two pages become nineteen

The hub was audited page by page, at both widths, counting screens and
controls rather than trading opinions. Three pages were doing nothing, two
pairs of pages were doing the same job twice, and the front page had become
the longest read in the hub. What follows is what changed and why.

### One weekly review, not two

The Review Room and the Weekly Review were both the Sunday ritual. The Review
Room's five questions — what moved, what stalled, what you learned, what gets
cut, the one thing that must happen — were the better half, so they moved into
the Weekly Review and the Review Room is gone. Its store is read once on first
load, copied across, and then left alone forever; it is never written to and
never deleted.

### The Library folds into the Reading List

Both were a shelf with a queue, a reading state and a done state. The Reading
List already held publications and already had a takeaway field in its
reflection log, so the Library was the same page twice. Its papers come across
on first load as publications, its statuses map onto the shelf's
(`queue → unread`, `done → read`), and its takeaways land in the reflection
log. The one rule worth keeping came with them: **a paper is not read until
its takeaway is written**, and opening a paper marked read with nothing
written says so.

### Dossiers and the Network Map, linked rather than merged

These two look alike and are not the same thing. The map is the visual — who
is where, who you owe a touch, which trips overlap with which meetings. The
Dossiers page is the file: every conversation with a person, in order, for
reference. So they stay two pages and each opens the other on the same person
— the map's pin links straight into that person's file, and the file links
back to their pin.

### The shelf opens where the work is

Shelves used to all start open, which on a phone meant scrolling past a
hundred and sixty books to reach the four you are actually reading. Now a
shelf starts open only if something on it is in progress; everything else
starts closed, with its read count on the header. Once you open or close a
shelf by hand, that choice is remembered and the rule stops applying to it.

A shelf also carries one kind, because the Books / Papers filter reads it —
so a paper you added is grouped as a paper, not filed under Books where the
filter that exists to find it would hide it.

### The drawer is grouped

Nineteen pages in one flat list is a wall. The drawer now groups them the way
the days actually divide: **Every day** (Today, Mission Control), **Study**
(Anatomy, Study Engine, Reading List), **Body** (Grind board, Life Log),
**The plan** (Master Plan, Summer Sprint, Plan Analysis, Timeline),
**Research** (Research Plan, Conference Radar), **People & money** (Network
Map, Dossiers, Vault), and **Looking back** (Weekly Review, Journal,
Examiner).

### Mission Control is a glance again

It had grown to eight screens of panels, most of which restated a page you
could open. The deck of live numbers and **DO THESE NEXT** are the glance and
stay at the top; every section below them — rooms, plan & risk, analytics,
the conference desk, decisions — now starts **closed**, on a desktop as well
as a phone, and opens with one tap. That choice is remembered per section.
The six-item plan-view strip and the sticky in-page nav both went: with the
sections collapsed there is nothing left to jump past.

Desktop went from 7.7 screens to 1.3, a phone from 9.9 to 3.2.

**One bug found on the way.** Folding the Library left a call reading a store
whose key had been removed, and it threw inside `renderVals()` — which does
not crash the page, it falls back to the empty defaults. Mission Control had
been shipping as a fully-formed but empty shell. There is now a sweep
(`crash.js`) that loads every page at both widths and fails on a `renderVals()`
throw or a body with almost no text in it, because that is the failure this
framework hides best.

## Close the day

At the bottom of Today, and on the Life Log, there is a short end-of-day
block: total screen time, how much of it was social or entertainment, pickups,
what the eating was like, and a line about the evening. It takes under a
minute and it is the only input the analysis needs.

The Life Log's **Trends** panel then reads it against everything else already
being logged — sleep, study hours, training, diet — and reports the
correlations, in plain words with the number beside them. It will not report
one until there are at least eight days that carry both figures, and it says
so rather than showing a shape drawn from three points. Correlation is not
cause and the panel says that too; what it is for is noticing that the bad
weeks and the four-hour phone days are the same weeks.

## One glance, and the systems that were invisible

The hub was measured page by page at both widths — screens, controls, words,
and which store each page reads. Three findings came out of it, and they are
what this round fixes.

**The glance could not see the systems the day is built around.** Mission
Control had a deck of seven tiles. `ct_anatomy_v1`, `ct_grind_v1` and
`ct_research_v1` appeared in that page exactly once each: in the list of keys
to back up. The front page backed up the closure log and the grind board and
never looked at either.

**The plan asked to be measured against 371 steps**, 256 of which are dated
years out. A percentage counted against those cannot move, so it says nothing
about the week you actually had.

**A lift had two records that never met** — the Life Log's gym tick and the
grind board's session — in two stores, with no way to tell which was right.

### systems.js — every system, one line each

`systems.js` is the fix and it is deliberately one file. A system publishes
its state there, and every surface that wants a glance reads the same
summary: Today, Mission Control and the Reference page all call
`Systems.all()`. When the grind board changes what "a week is done" means,
every number changes with it, because only one place decides.

Ten systems publish: the plan, anatomy, the grind board, the study engine,
the reading list, the research track, the record, the journal, the weekly
review and the vault. Each returns a number, a line and a tone — `go` when
something is owed today, `ok` when it is handled. Every builder is defensive
and a throwing one is dropped rather than allowed to take the page down; a
glance that crashes is worse than no glance, and this one is read by the page
you open first.

### Today is the glance

Today opens on all ten systems — nine of them above the fold on a phone —
then what to do next, then the day's logging. What went:

- **The three summary stats**, replaced by the ten systems they summarised.
- **The plan card**, folded into the deck and into `Do these next`.
- **"Everywhere else"**, eleven tiles that were the navigation drawer for the
  third time on one page.

`Do these next` shows one live step from each of the first three branches, and
ticking one writes exactly what the plan page writes — the check, the
completion stamp, and the history entry the hub's streak and momentum are
counted from. Anything less and a step ticked on the phone would show as done
but never appear in a streak.

### The plan is counted against what is live

Each branch in `hub-data.js` now carries a `horizon`, read straight off the
timeframe it already had:

| horizon | branches | steps |
|---|---|---|
| `now` | the summer sprint, the research spine | 47 |
| `standing` | people, reading, risk, finances, the operating rhythm | 68 |
| `later` | horizons, the academic year, the year-2 stack, the wealth engine, the checkpoints, the decade | 256 |

Today and Mission Control count **115 live steps** and say on the next line
that 256 more sit further out. **Nothing is hidden and nothing is deleted** —
the master plan page still holds every one of the 371, unchanged.

### One lift, one record

The grind board publishes. Marking a session done stamps the board *and* sets
the Life Log's gym tick for the day, with `src: 'grind'` and the name of the
lift; clearing it clears both — but only if the board was what set it, so a
swim ticked by hand on the Life Log is none of the board's business. Today
reads it back as "✓ Lower B — Hinge — from the grind board" rather than
offering you a third place to log the same lift.

### Reference — one door to the five documents

The master plan, the strategic read, the summer sprint, the research
portfolio and the timeline are things you read rather than things you use.
Between them they hold about 5,400 words, and each was costing a drawer slot
at the same weight as a page you open every morning.

`Reference.dc.html` is one entry in the drawer instead of five. **Every one
of those pages is untouched, still served, and one tap away** — the drawer
lists the door, and standing on any of the documents highlights that door so
you can see where you are. What Reference adds is the thing a list of names
never could: what each document is, and when it is worth opening.

### The radar reads the desk

Conference Radar performed zero `localStorage` reads while its own help text
promised that anything logged on the conference desk "flows into the deadline
radar". It flowed into the hub, the timeline, the life log and the
constellation — everywhere except the page named for the job. Conferences you
log now appear at the top of the radar, soonest first, above the researched
snapshot.

### What it cost

| | before | after |
|---|---|---|
| Systems visible on the glance | 7 | **10** |
| Plan steps you are measured against | 371 | **115**, with 256 named |
| Places to log one lift | 3 | **1** |
| Drawer rows | 19 | **15** |
| Pages still reachable | 19 | **20** |
| Today, above the fold (phone) | 3 stats | **9 of 10 systems** |

## The ceiling, removed

Everything the hub keeps went into one Firestore document, and a Firestore
document tops out at 1 MiB. Measured against the shapes the pages actually
write — a full Life Log day with three study sessions is 751 bytes, a journal
entry about 220 — the store grows about **444 KB a year** on 218 KB of bounded
data. It passes the 700 KB local-backup limit at roughly **month 13** and the
950 KB sync guard at roughly **month 20**, at which point syncing stops. On a
system meant to run until thirty.

The backup ceiling was the worse of the two, because it failed quietly: the
skip was a `console.warn` and nothing else, so backups would have stopped
seven months before sync did with no sign anywhere you would look.

### Hot and cold

`archive.js` splits the growing stores in two:

- **hot** — the last 120 days, plus everything genuinely live: the timer's
  running session, the syllabus, the budget, the anatomy block state, the
  grind board's ticked sessions. This goes in the main document as before.
- **cold** — everything older, split by quarter, each quarter in its own
  document under `hubData/{uid}/archive`. The 1 MiB limit now applies per
  quarter rather than per lifetime, so a decade is forty small documents.

Measured: **three years of daily logging is 216 KB whole and 24 KB hot**, in
twelve archived quarters. End to end against a Firestore stub, three years
leaves a 29 KB main document.

**localStorage still holds all of it.** This is only about which document
carries what, which is why no page had to change — every page reads the same
key and sees the same complete store.

**The one place that has to care is an incoming sync.** The cloud's copy of a
split key is only the hot half, so writing it to localStorage verbatim would
delete every older day this device holds — the whole archive, silently, on one
sync. `Archive.rejoin()` is what prevents that: keep everything of ours older
than the cutoff, take all of the cloud's. There are tests for exactly this.

**If the archive rule is not published**, the write is refused, the hub notices,
and it falls back to pushing everything in the single document exactly as
before — nothing is lost by trying, and the sync panel says so.

**The daily backup keeps the hot half.** That is what a bad arrival can damage
and what you would want back in a hurry; the older quarters are immutable and
already in the cloud. Keeping the whole store is what used to push it past
`DAILY_MAX`, and a skipped backup now says so in the panel rather than only in
the console.

## Four more things the hub now does

### The Sunday ritual reads itself back

The five questions were answered every week into `ct_weekly_v1.answers`, and
**nothing read them** — not another page, and not the Weekly Review itself.
Roughly 250 sets of answers over five years, into a store with no reader.

Now last week's answer sits above this week's empty box, there is a history
view of every week behind you, and when an answer repeats a theme it says so:
three shared significant words and the review notes *you have written this
before*, with the words. Deliberately simple — a stemmer would find more and
be trusted less — and it never says what the repetition means.

### One thing a day, coming back

`resurface.js`. The Study Engine already did spaced repetition, pointed at one
narrow input. Every takeaway you were required to write before a paper counted
as read, every weekly answer, every conversation logged against a person, every
decision gate and every journal entry sat in a store that only opened if you
went looking.

One item a day now appears on Today, drawn from all five, weighted by how old
it is and how long since you last saw it — so something written a year ago and
never shown outranks something from last week. Two responses: **again sooner**
undoes one showing's worth of damping, **retire this** means never again.

The pick is fixed for the calendar day. Opening Today five times shows the same
item five times, because a strip that reshuffles on every reload is a feed, and
the responses are what make this a loop instead.

### One input, five destinations

`capture.js`, injected on every page beside the drawer, opened with ⌘K or the
✎ button. It routes on a prefix:

| you type | it goes to |
|---|---|
| `@Anna Kowalska: said yes` | that person's dossier — matched against your existing contacts |
| `#Ex vivo lung perfusion, Cypel` | the reading list, as a paper |
| `14 Oct ACC Scientific Session` | the conference desk |
| `+Send the abstract` | this week's priorities |
| anything else | the journal |

The date parser reads the five ways you would actually write a date and
declines everything else, because a parser that guesses is worse than one that
hands the line to the journal — a wrong guess files something where you will
never look for it. A bare `@name` with no note falls through rather than
opening an empty file.

### The number, in the room

The correlation maths moved out of the Life Log's Trends panel into
`systems.js`, so there is one definition of what it means. The Weekly Review
now opens with the strongest reading from your own record, **above** the five
questions — before you answer, not after — with the same eight-day floor, and
says how far off it is when there is not enough yet.

It asks. It does not decide, propose a step or change the plan: the moment it
starts writing on your behalf is the moment you stop trusting the number.

## v4.0 — the systems start agreeing with each other

Three of these were reported as "it doesn't work" and turned out to be one
sentence each, in code that was otherwise right.

### A week of health readings landed on one day in 1970

Health Auto Export stamps every sample `start` and `end`. There is no `date`
field, and `date` is what the importer read — so `parseTs`, written for
exactly this timestamp format and correct about it, was handed `undefined` on
every sample of every mapped metric. Nothing threw. The panel reported
success. `new Date(null)` is the epoch rather than Invalid Date, so `dayOf`
let it through and a 344 KB export of eight days became a single row dated
1970-01-01 holding ten minutes of one sleep stage.

Sleep was the other half: it arrives as hourly **segments** with `asleep`,
`totalSleep` and `inBed` left at 0 and the real minutes in `core`/`deep`/`rem`.
`dd.sleep` was assigned per record, so the last hour of the night overwrote
the rest. Segments are summed now, grouped on the hub's 05:00 boundary so the
23:00 piece and the 02:00 one belong to the same night, and `asleep` is
derived from the stages when the export does not state it.

Twenty-three of thirty metrics had no mapping and were dropped in silence,
heart rate among them. The ones worth keeping have a home; the seven left are
gait micro-metrics and the report names them. An import that yields no days
now says so and guesses why, instead of reporting "0 days" in the success
colour.

### The weekly review could not be marked done

Also three bugs, and they compounded.

The board asked `reviews[monday()]` where `monday()` was the Monday of the
**current** week, so at 00:05 on Monday the key flipped, Sunday's review
stopped counting, and every surface read DUE for a week that had not happened.
A retrospective cannot be owed for a week still being lived: the review is for
the week that **ended**, which on Sunday is the week closing today and the
rest of the time is the week before.

Worse, `monday()` built that key through `isoDay()`, which routes through the
05:00 boundary — so midnight on Monday came back as the Sunday before it,
while the Weekly Review page keys its store off the plain calendar Monday. The
two never matched. The board could not show a completed review **at all**,
whatever week it was looking at. A week key is a label for a week rather than
a stamp on a moment, so it no longer goes through the day boundary.

And next week's three priorities were written under `wkKey(now + 7d)` and read
under the same expression, so from Monday the page looked one week further
ahead and found an empty slot. The list you were meant to be working from was
on disk the whole time. The ritual names three weeks now — the one being
reviewed, the one being worked, the one being planned — and the page shows the
middle one as a checklist.

### One row per day

`facts.js` is the table the hub never had. Every question worth asking is
about two things at once — does clinic cost study hours, does the queue build
on the weeks you sleep badly — and none could be asked, because the stores did
not share a coordinate system. The Life Log and the health import are keyed by
date; `ct_anki_v1` is a single reading overwritten on every sync; the Grind
board keys sessions `week|slot` and so cannot be dated at all, which is why
`trends()` reads training from the Life Log and has never been able to see the
Grind board's own record.

The obvious design is for every system to append its own row, which means
editing six files and six chances to be wrong. Most of those stores are
already dated, so `facts.js` derives the row instead — nothing migrates,
nothing to keep in step, and the history that already exists is there on first
load. The exception is Anki, which has to be caught as it goes past: `sync()`
stamps the current reading onto today's row when a page loads, so the series
starts accumulating that day and cannot be reconstructed for any day before it.

It carries `correlate`, `matrix` and `strongest`, holding the same
`CORR_MIN = 8` floor the Life Log's Trends panel already applied.

### Ruling things out

The Trends page could draw a correlation matrix and nothing else, which is a
machine for producing confident nonsense. Thirty-six cells, the top five
printed in bold as findings, no p-values, no correction for having looked
thirty-six times, no check for the third thing driving both, no direction.
The page carried a disclaimer — *correlation is not cause* — and then set
**Sleep rises with study** in 14px semibold underneath it, which is the
disclaimer doing no work at all.

`causality.js` is the arithmetic for knocking those down. Nothing here turns
self-tracking into a randomised trial; what it can do is rule things out,
which is most of what causal inference is in practice. Four rungs, each of
which can end the climb:

1. **Is it real?** `r` with a two-sided p from an exact t tail, a Fisher
   interval, and — the one that matters most for daily data — a sample size
   deflated for autocorrelation. Fifty consecutive days are not fifty
   independent observations of anything; two smooth series are worth about a
   tenth of their row count. Then Benjamini-Hochberg across the whole screen,
   because ranking thirty coefficients by `|r|` and printing the top of it
   selects for exactly the cells noise inflates.
2. **Or is it a third thing?** Partial correlation against every other logged
   measure, plus two the table does not store: whether it was a weekend, and
   elapsed time. Weekends move sleep, study, screen and training at once, so
   most of the strong cells in this matrix are, at bottom, a calendar. This
   runs on the findings list itself and not only inside the workup — a badge
   saying a pair cleared a multiple-comparisons screen must not sit next to a
   bold sentence and be read as a badge saying the pair means something.
3. **Which way does it run?** A lead-lag scan and a Granger F-test in both
   directions: does X's history improve the prediction of Y beyond what Y's
   own history already gives, and does Y return the favour. Granger causality
   is not causality; it is precedence with the obvious confound removed,
   which is strictly more than a same-day `r` can offer. Rows are built only
   from runs of genuinely consecutive calendar dates — a fortnight's gap is
   not a one-day lag.
4. **Is it one strange day?** Leave-one-out, refitting without each day and
   taking the largest swing; plus the same correlation on first differences,
   which no shared trend can fake. A finding whose size halves when one
   Tuesday is dropped is a story about that Tuesday.

And the section the matrix cannot contain. A correlation matrix only ever
asks about the same day, so an effect that takes a night to arrive is
invisible to it by construction — which is the shape most of the questions
worth asking here have. **And only a day later** scans every ordered pair one
day apart and keeps the ones that are significant on the lag and absent on
the same day. Those get their own screen, because a lagged correlation has
three ordinary ways to be an illusion: the recipient's own momentum, the
same-day relationship wearing a hat (X on Monday "predicts" Y on Tuesday
through X on *Tuesday*), and the calendar. All three are held constant, and a
coefficient that comes back with the opposite sign to the one it screened is
refused rather than reported — a reversal under conditioning is a red flag,
not a discovery.

The verdict at the top of the workup is written to be able to say no, and
most of its branches are refusals. It also refuses to borrow credit: a rung
that could not run — nine days, so no covariate clears the overlap guard and
no run of consecutive dates is long enough — is reported as untested, not as
passed. An early version printed *"it survives every control tried"* on a
table where no control could be tried.

### One person a day

The Network Map knew everything needed for this and said none of it out loud:
every node carries `type`, `strength`, `lastDays` and `owed`, and the board
reported "5 owed a touch" — a number you scroll past. `contact.js` picks one
person, says why it is that one today, and gives it a first line, so the cost
of acting is a tap rather than twenty minutes of drafting. Overdue-ness is a
ratio of days-since to what that tier of tie can bear, not a raw count, or the
dormant contacts would crowd out the live ones forever. Logging the touch
writes to `ct_dossier_v1`, which is what the ranking reads — so acting on it
moves tomorrow's pick.

The pick is fixed for the calendar day, and it does not appear on a floor day.

### Smaller things

- **The daily quote moved to the Standing's footer**, taking the slot the
  static epigraph held. It was on Mission Control, which is opened on a Sunday
  at most, so a quote that turns over daily rotated through five unseen faces
  per viewing. It sits under the board rather than above it — the front door
  answers what today wants first — which means that on a floor day, where the
  page collapses to one ask, it rises to just under the fold.
- **The rotation was broken and is now in one place.** Every consumer computed
  `quotes[dayOfYear % 42]` for itself. 42 is 6 × 7, so each quote was welded to
  one weekday — nine appearances a year, always a Thursday — and `dayOfYear`
  resets on 1 January, jumping the cycle mid-stride. `CTQuote.today()` counts
  from the epoch, and the bank is 43 so its period is coprime with the week. A
  stride cannot undo a period that is a multiple of a week; only the bank size
  can.
- **The board stopped opening archived pages.** `systems.js` gave the `plan`
  system — sort 0, the first tile on the Standing every morning — an href of
  `CT Master Plan.html`, and `research` pointed at `Research Plan.dc.html`.
  Both were retired by the v2 recalibration.
- **The installed app opened the retired front door.** `manifest.json` still
  had `start_url: "./Hub.dc.html"` and was named "CT Mission Control", which
  overrode `config.js` completely on a home-screen launch — the highest-traffic
  link on the site.

### The rest of it

**`sitemap.js`** is the only declaration of what pages exist. Five files kept
their own copy — nav.js, the Standing's directory, Mission Control's rooms
grid, Archive.html, and systems.js's hrefs — and they had drifted: Hub was
"Mission Control" in one and "The workshop" in another, the directory listed
the Plan twice and dropped the publication pipeline, and the rooms grid
promoted three pages the recalibration had archived. A page declares its
name, its drawer `group`, its `parent`, and what its back control does now.

`group` and `parent` are deliberately different axes. Journal is filed under
"Looking back" because that is where you would look for it, and belongs to
Today because that is where you write it.

**`upbar.js` does not add a bar.** An earlier draft injected a global up-bar
on every page and it was wrong: a phone page already carries four fixed
controls, and the tab bar already reaches the front door in one tap. It finds
the back link a page already has and corrects its label and destination.
Nothing new appears, every page keeps its styling, and the ten pages built
after the recalibration — which already point at Standing or the Plan — are
left alone. A page with no back link gets one injected, above 640px only.

So the change is thirteen rewrites and a handful of injections, not
"fifteen files and a new global control".

**`Recall.html`** is one desk for three queues. Anki, the error cards and
resurface were three spaced-repetition systems with three stores and two
different algorithms, each with its own tile showing its own due count —
three answers to one question and no total anywhere. They keep their stores
and their schedulers; they stop having three front doors. Anatomy stays out:
it is a curriculum with an order, not a queue with due dates.

**`Trends.html`** reads the fact table. Rows are the things being explained,
columns the things that might explain them — the asymmetry keeps it readable
on a phone, where an N x N grid of everything against everything is a wall.
Cells below eight paired days are hatched and report nothing.

**`Week.html` and `calendar.js`** make the week elastic. The Grind board is a
fixed nine-week grid keyed `week|slot` — `3|push` — so a week where clinic
eats Tuesday cannot be expressed: there is nowhere to put "moved to
Thursday". That keying is also why training was invisible to the trends
table. The new week reads what is already committed and lays the sessions
into what is left, stored **by date**.

Google Calendar reaches a static site three ways, and they differ in whether
the week arrives on its own.

**Automatic.** The Calendar API on `www.googleapis.com` sends CORS headers, so
a browser holding an API key can read a *public* calendar directly — no popup,
no token to expire, and it works on the phone. Set `calendar.id` and
`calendar.apiKey` in `config.js` and the Week page reads itself on load. An API
key is a public credential, the same kind as the Firebase one beside it, so
restrict it by HTTP referrer to this site and to the Calendar API only.

The cost is the word *public*: a calendar shared publicly is readable by anyone
holding its id, and for a clinical schedule that is a decision rather than a
formality. Google's **"See only free/busy (hide details)"** is the middle
ground — the hours stay visible, the titles do not, and the planner only ever
needed the hours. Events come back titled "Busy", which is enough to lay
training into what is left.

**On request.** Leave `apiKey` empty and press the button. The provider the
gate already uses takes `calendar.readonly` as an extra scope, and the popup
result carries a real access token. The calendar stays private. Two honest
limits: Firebase hands the browser no refresh token, so it is one popup per
session; and the scope is sensitive, so the OAuth app stays in Testing.

**Offline.** An `.ics` export dropped in needs no credential at all. The secret
`.ics` *URL* looks easier and is not — Google serves it without CORS headers.

`calendar.id` is not `primary`. A subscribed or imported timetable has its own
id ending `@import.calendar.google.com` or `@group.calendar.google.com`, and
reading `primary` returns a blank week that looks like it worked. Calendar →
the calendar → Settings → **Calendar ID**.

**Which week it reads.** Every path used to ask for `nextWeekRange` — always
the week *after* the one you were in. On a Sunday that is exactly right and it
is the whole point of doing it on a Sunday. On any other day it meant the week
you were standing in could not be asked for at all: press the button on a
Tuesday and you got the week starting in six days, and if you had missed one
Sunday, this week's committed hours were unreachable for good. That is not
only a display problem — `facts.js` publishes `committed` as the **`work`**
column, which is what the Trends table correlates sleep and study against, so
a week never pulled is a week of work hours no correlation can ever see. It is
now `planningRange()`: on a Sunday, the week that starts tomorrow; on any other
day, the week you are in. Which day it is comes from `day.js`, so at 02:00 on a
Monday you are still finishing Sunday and still get the week that starts in a
few hours.

**One week on screen.** `ct_week_v1` is a dated history and keeps growing,
because that is what makes training visible to the trends table. The page was
rendering `Object.keys(days)` — every day ever pulled — so a second pull put
fourteen rows under one heading and summed fourteen days into "Committed". It
now renders the week being planned and leaves the history to `facts.js`.

**The button could sign you out of the site.** `prompt: 'consent'` puts
Google's account chooser up, and choosing any account but the owner's signs
the hub in as somebody else — at which point `sync.js`'s `onAuthStateChanged`
sees a stranger and replaces the page with the gate. From the outside that is
the Read button throwing you out of the hub. It now passes `login_hint` with
`authorizedEmail`, which is the only account that can be signed in here at all.

To turn automatic on: Google Cloud Console → enable the **Google Calendar
API** → Credentials → **Create API key** → restrict it to that API and to
`linomass36.github.io/*` → in Google Calendar, set the calendar's sharing to
public (details, or free/busy only) → paste the key into `config.js`.

**Three tripwires run in the deploy.** Every `.html` in the repo is declared
and every declaration exists; no live page links to an archived one; every
live page can be walked back to the front door. The second one immediately
found three links nobody knew about — Today and Mission Control still
pointing into the v1 plan and the retired sprint.

### The front door is the prototype now

`Standing.html` is the One Row Per Day screen, top to bottom:

```
condition · one line          was a ~250px card holding one sentence
"Five things want you today."
  + the systems named         was "everything below is detail"
171 days · applications close the date every live item serves
Reach out today               moved above the board
Every system                  spine · daily · standing
  The Plan          wide, carrying its own next two moves
  Weekly Review     wide
  Anatomy · Grind · The Week · Recall · Reading · Research · Life Log
  Trends · Journal · Vault      one line each
What the record says          the matrix, on the day it is worth knowing
folded: the Anki keypad, the page directory
the daily quote
```

**Three densities.** Twelve equal cards is a wall and six is half the hub
missing, so `systems.js` gives each tile a tier — spine, daily, standing —
and a standing system past its cadence is **promoted** to a card for that
day. The silhouette of the board is the state of the week: a tall board is a
behind week, readable before a word of it is.

**Two sections became one.** "Do these next" duplicated the tile that already
said `0 of 10`, three screens further down. The moves are inside the Plan
tile now, so the Sep 7 deadline sits beside the percentage it explains.

**Life Log shows fourteen days.** "0 days logged" is a number you can argue
with; a row of marks with a gap in it is not.

The page went from **8,724px to ~2,270px** with more on it. Nothing was
deleted: the Anki keypad and the page directory are folded, because the
keypad is a desk and Recall is the desk.

Two bugs found while building it. A second `trends()` in `systems.js`
**shadowed** the correlation-sentence function of the same name, which
silently turned that sentence off on the Weekly Review as well as here.
And sorting the board by `sort` alone put the Weekly Review — sort 8 — at
the foot of the board rather than beside the Plan, which is the pairing the
whole layout rests on.

### Trends and The Week were published and unreachable

Both pages shipped, deployed and sat in the build artifact. Neither was on
the Standing's board. The board had eleven tiles and named neither, and the
Grind tile still opened `Grind.dc.html` — the fixed nine-week grid the
elastic week replaced. From the front door the two pages did not exist; the
only way in was a thirty-item drawer.

The board also listed only what was **owed**, which had two consequences
nobody chose:

- **The Plan was never on it.** A plan on track owes nothing, so the thing
  the other eleven systems serve was absent from the board every day it was
  going well.
- **There was no calm state.** The board could show alarms or nothing. You
  could not check a system that was behaving.

It was also a single column of ~150px cards, which fits one and a half
systems on a phone — a list you scroll, not a board you read — under a strip
of eleven bars with four-letter labels (`ANAT`, `RSRCH`, `JRNL`) restating
the cards directly beneath it, seven of them solid red.

Now: every system, two columns at every width, The Plan pinned across the
top, and tone carried by the rail rather than by presence — red for owed,
green for handled, quiet for nothing to report. A tile that says done takes
less room than one that says DUE. `show live only` narrows to what is owed
for the days you want the short version. Anki and the Study Engine were two
tiles opening the same page and asking the same question twice; they are one
Recall tile that names its three sources.

`tools/board.test.js` checks reachability rather than layout: every live
page a tile should open is opened by one, every tile's destination exists,
and the board carries more than one tone. It fails eight assertions against
the old board.

### Two plans, and the daily pages were reading the retired one

`plan-v2-data.js` opens by saying it supersedes the v1 content in
`hub-data.js` and that "nothing reads it as current any more". That was not
true of the three pages actually opened every day:

```
Standing.html          "Do these next"      <- HUB_DATA, v1's 371 items
Today.dc.html          next steps           <- HUB_DATA, one per v1 branch
Weekly Review.dc.html  wins and open loops  <- HUB_DATA + v1's store
systems.js             the board's first tile — sort 0, top of the Standing
                       every morning — linked to Plan.html and reported v1's
                       percentage
```

Two plans, two stores, no connection between them. The store names are their
own trap: `ct-master-plan-v2` is **v1's** store; v2's is `plan_v2_state_v1`.
So a move closed on the Plan page never appeared as a win in the Sunday
review, and the Standing spent every morning naming work the recalibration
had explicitly abandoned — the capital engine, the research spine, thirteen
branches of it.

Nothing could catch this. Both files were valid, every link resolved, the
site-map tripwires passed, and the wrong number is a perfectly plausible
number: 371 steps at 34% looks like a plan being worked.

`PlanV2` now answers the question once, for everyone — `moves()`, `counts()`
and `winsSince()` over the **live phase**, which is the point of v2: a
percentage of 371 items dated years out never moves and tells you nothing,
whereas `0 of 10 — close out the summer` does. Moves are ordered by deadline,
because everything live serves one date.

`tools/plan-source.test.js` pins both halves: the reader's behaviour, and —
structurally — that the daily surfaces load the v2 plan and read neither
`HUB_DATA` nor v1's store. That second half is the tripwire that would have
caught this in the first place. Comments may name v1; code may not read it.

Still on v1, correctly: the archived v1 documents. Still on v1 and worth a
later pass: `Dossiers`, `Life Log` and `Examiner` use `HUB_DATA` for contacts
and extras rather than for "what do I do next".

### The corrector was correcting the drawer

`upbar.js` rewrites a back link still pointing at `Hub.dc.html`, the retired
front door. It found them with one document-wide scan for `a[href]` — and by
the time it ran, `nav.js` had already appended the drawer, whose page list
contains a perfectly legitimate link to `Hub.dc.html`: **the Workshop**, which
is live, not archived.

So the scan hit the drawer. On every page carrying one, the Workshop entry was
rewritten to that page's own parent:

```
on Day Budget   "The Workshop"  ->  "← The Plan"      ->  Plan.html
on The Body     "The Workshop"  ->  "← Today"         ->  Today.dc.html
on Conditions   "The Workshop"  ->  "← The Standing"  ->  Standing.html
```

Two failures out of one line. The Workshop became unreachable from the drawer
anywhere on the site, and the drawer grew a second back link that changed its
name depending on where you opened it — two arrows in view at once, pointing
different places. A quieter third: a page declared `back: 'none'` only gets a
link injected when the scan finds nothing to correct, and the drawer's
Workshop link counted as a find, so the injection never happened.

The three site-map tripwires could not see any of it. Every declaration was
correct; the damage was done to the DOM at runtime, after the page loaded. The
fix is that the corrector now skips `#hbnav`, `#hb-tabs` and `#hb-up` — the
chrome is a directory of the whole site, not this page's back control — and
`tools/upbar.test.js` runs it against a stub DOM built the way the browser has
it at that moment: the page's own header, plus the drawer already appended.

### And then it was corrected, and then it was put back

Reported three times: *the pages still go back to Mission Control.* All three
times the tripwires were green, and all three times they were right about what
they were looking at — a static DOM, mutated once, inspected once.

A `.dc.html` page is not a static DOM. `support.js` parses the `<x-dc>`
template, replaces that element with a React root, and then, a tick after
mounting, **re-renders the root from the page's pristine source** —
`window.__dcSource` behind the vault, `fetch(location.href)` in front of it —
because the copy the HTML parser leaves in the DOM has had the rows inside
`<table>` and `<select>` hoisted out of it. That repair is what fills the day
log and the Data panel, and it is unconditional.

So the correction was being made to a subtree that was about to be thrown
away, and the anchor that replaced it carried the original `href` and the
original label again. Every one of the thirteen pages declared `back: 'wrong'`
is a `.dc.html` page — Today, Anatomy, Study Engine, Reading List, Grind, Life
Log, Conference Radar, Network Map, Dossiers, Vault, Weekly Review, Journal,
the Examiner — so in practice **the corrector had never corrected anything on
the live site.** Only the pages that were already right looked right.

`upbar.js` now keeps watching. A `MutationObserver` on `documentElement`
(`childList` for the subtree swap, `attributeFilter: ['href']` for React
reconciling the same anchor in place) re-applies the correction on the next
frame. It is idempotent — a corrected href no longer matches the stale
pattern — and `takeRecords()` after each pass discards the mutations that pass
made, so a correction cannot schedule another pass to look at its own work. A
page animating styles never wakes it.

Two tripwires, because one of them would not have been enough:

- `tools/upbar.test.js` now re-creates the back link the way the runtime does
  and looks again. Against the old file it fails six ways.
- and it reads every live page off disk and checks that what `sitemap.js`
  declares about its back control is *true of the file*. `back` is the one
  field nothing else could check — it is a claim about markup rather than
  about the site map, so it can drift the moment a header is edited, and the
  symptom is a link going to the wrong place with every other check green.

### Health days follow the reading, not the reader

A sample stamped `2026-08-21 16:00:00 -0700` is already local time where it
was recorded. Keying it through the viewer's timezone put an Arizona
afternoon on the following day once the site was opened from Poland, and
silently shifted a run of days whenever you travelled — the kind of error
that shows up only as a correlation quietly getting worse. The date written
on the sample is the date it happened.

### The matrix asks any pair, and a closure is a block

The Trends matrix had a fixed set of rows and a fixed set of columns, which
meant a whole class of question could not be asked at all: "does sleeping
badly put me on my phone more" has sleep and screen time on the *same side*
of the grid. It is symmetric now, over whatever you select — twenty-eight
measures on offer, up to nine at a time, with the diagonal blanked rather
than filled with 1.00. Tap a cell for the pair in a sentence.

Presets are starting points rather than categories, and only appear when
three of their measures are actually logged. Pairs that are related by
definition — social screen time inside total screen time, Anki reps against
Anki minutes, the watch's sleep against your own — stay in the grid, where
seeing r = +0.95 is a useful check that the import works, but are kept out of
the findings, where they are noise dressed as insight.

**A closure was being counted wrong**, and the fix is worth naming because
the number looked plausible. A closure is one syllabus BLOCK closed out — a
named region (nk1, tx10) whose gate test scored 80 or better on both the
innervation and the topography halves. It comes from `blocks`, on the date of
its gate. `facts.js` was reading `days`, and a day record is
`{tier, p0, pick, rand, minRead, minDraw, cardsNew, …}` — so counting its
keys counted the *shape of the record*: twelve, every single day. The day
record's own numbers are now columns in their own right, which is what it
was always good for.

### The Anki history was on the Mac the whole time

`ct_anki_v1` holds a single reading and is overwritten on every sync, so the
hub's series could only ever begin the day it started keeping it. But
`revlog` is append-only and holds every review ever answered, with a
millisecond timestamp on each — the history was sitting on the Mac all along
and the script simply never published it.

    python3 tools/anki_sync.py --backfill --open

sends a year of daily reps, distinct cards, Again presses and seconds, as
parallel arrays keyed off a start date — about 5 KB, which matters because
`--open` carries the payload in a URL fragment. A routine sync sends none;
there is no reason to resend a year every thirty minutes.

**A routine sync used to delete it again.** `Feeds.apply` replaced the whole
stored reading with the incoming one, and a routine sync carries no history —
so thirty minutes after backfilling, the launchd job ran and the year was
gone. Silently, and recoverable only by backfilling again, which would look
like the feature had never worked. Newer still wins for everything a reading
measures; a key the newcomer does not carry is now kept rather than dropped.

What cannot be backfilled is the queue depth on a past day: how many cards
were waiting on 3 March was derived from the collection's state and thrown
away. Reps, cards, Again and time are facts. So Recall draws a long reps line
against a short queue line — on **one shared date axis**, because scaling
each series across the full width independently would have put today's queue
reading eight weeks in the past.

## Files in this system
- `config.js` — the one place you edit (owner email + Firebase keys, and `mobileHubUrl`, where a phone lands).
- `Anatomy.dc.html` + `anatomy-core.js` + `anatomy-data.js` — the closure log: the screen, the rules, and the syllabus. See **Three systems folded in** above.
- `Grind.dc.html` + `grind-data.js` — the nine-week board and its programme.
- `Research Plan.dc.html` — the five-track portfolio, with a live ninety days and live gates.
- `archive.js` — the hot/cold split: which quarters go in the main document and which go to `hubData/{uid}/archive`, and the rejoin that stops an incoming sync deleting your archive. See **The ceiling, removed** above.
- `capture.js` — one input on every page that routes a line to a person, a paper, a conference, this week or the journal. Injected beside the drawer.
- `resurface.js` — one thing a day out of everything you have written, weighted by age and by how long since you last saw it.
- `facts.js` — one row per day, derived from the stores that are already dated, so two systems can finally be asked about together. Carries `correlate`, `matrix` and `strongest`, at `CORR_MIN = 8`. See **One row per day** above.
- `contact.js` — one person a day to reach out to, ranked over the Network Map's own tiers and touch dates. Logging a touch writes to `ct_dossier_v1`, which is what the ranking reads. See **One person a day** above.
- `quotes.js` — the daily line, and `CTQuote.today()`, the one place that decides which one. The bank is kept coprime with 7 so nothing is welded to a weekday.
- `sitemap.js` — the only declaration of what pages exist: name, drawer group, owning parent, and what each page's back control does now. Read by `nav.js`, the Standing's directory and `upbar.js`.
- `upbar.js` — corrects the back link a page already has, rather than adding a control, and keeps correcting it: a `.dc.html` page re-renders itself from its own source a tick after boot and puts the original link back. Injects one only where none exists, and only above 640px. Skips the injected chrome, whose links are a site directory rather than this page's back control. See **The corrector was correcting the drawer** and **And then it was corrected, and then it was put back** above.
- `tools/upbar.test.js` — the corrector fixes the page's own stale back link, fixes it again after the design-canvas runtime re-renders the page from its own source, leaves the drawer's Workshop entry alone, and checks every live page's `back` declaration against the file it describes.
- `plan-v2.js` — also `moves()`, `counts()` and `winsSince()`: the one reader for "what is next", over the live phase. See **Two plans** above.
- `tools/plan-source.test.js` — the next moves come off the live phase by deadline, and the daily surfaces read the current plan rather than the retired one.
- `tools/board.test.js` — every page meant for daily use is one tap from the front door, and the board can report that a system is fine.
- `calendar.js` + `Week.html` — the week read off Google Calendar and the training laid into what is left, stored by date. Reads itself on load when `config.calendar.apiKey` is set against a public calendar; otherwise one popup per session, or an `.ics` drop. See **The rest of it** above.
- `tools/calendar.test.js` — the named calendar is the one read, the week you are standing in can be asked for rather than only the next one, an event lands on its own date rather than the reader's, and a declined invitation is not your week.
- `Recall.html` — one desk for Anki, the error cards and the resurfaced notes.
- `Trends.html` — the correlation matrix over `facts.js`, at `CORR_MIN = 8`, then the four tests that try to knock each pair down. See **Ruling things out** above.
- `causality.js` — the statistics: exact t and F tails from a regularised incomplete beta, OLS, partial correlation, Granger, cross-lag, leave-one-out, first differences, Welch contrast, effective-n deflation and Benjamini-Hochberg. No dependencies; reads `facts.js` or any table handed to it.
- `tools/causality.test.js` — the tail probabilities against textbook values, and every rung against a NEGATIVE control as well as a positive one: noise must come back as noise, a confounded pair as its confounder, a symmetric relationship must refuse to name a direction.
- `tools/trends-page.test.js` — lifts the inline script out of `Trends.html` and runs it against a table with known answers built in: a weekend confound that must be refused, a one-day lag that must be found, and noise.
- `tools/feeds.test.js` — a newer reading wins, but does not delete the history it does not carry.
- `tools/facts.test.js` — the daily table joins the right things to the right days: a closure is a block gated, and the Anki history lands on the day it happened.
- `tools/sitemap.test.js` — the deploy tripwires: everything declared, nothing live pointing at an archived page, every page walkable home.
- `systems.js` — every system in one line each: the number, the sentence and whether something is owed today. Read by Today, Mission Control and Reference so the three cannot disagree. See **One glance** above.
- `Reference.dc.html` — the door to the five documents: what each is and when it is worth opening. The documents themselves are unchanged.
- `.github/tests/crash.js` — loads every page at both widths and fails on a `renderVals()` throw or a page with almost no text in it. Not deployed (`.github/` is skipped by the build).
- `Hub.dc.html` — Mission Control: the deck of live numbers, what to do next, and five collapsed sections holding the detail. See **Twenty-two pages become nineteen** above.
- `Life Log.dc.html` — the day's record, the close-the-day block, and the **Trends** panel that correlates screen time against sleep, study, training and diet. See **Close the day** above.
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
- `nav.js` — the bookmark sidebar: a slide-in drawer (top-right button, or swipe in from the right edge) listing every hub page **grouped by what it is for** (current one highlighted) plus your own saved links (`hub_bookmarks_v1`, so they sync). Also holds the **Dark mode** toggle (`hub_theme_v1`), and on phones the **bottom tab bar** — Today, Reading, Journal, Log, Review. Injected on hub pages.
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
