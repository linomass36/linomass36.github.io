# Working on this hub

A personal planning hub: static pages, no framework, no build step beyond
`.github/inject.py`, published to GitHub Pages as ciphertext. Read `VAULT.md`
before touching the build and `DEPLOY.md` before touching the workflow.

---

## The rule that keeps getting broken

**Every change updates `Guide.html` in the same commit.**

A new panel, a new page, a rule that moves, a store that starts holding
something it did not, a number that starts coming from somewhere else — all of
it. Not afterwards, not when someone remembers. A guide that is allowed to lag
is worse than no guide, because it is believed.

`tools/guide-current.test.js` fails the deploy when a panel exists that the
Guide has never heard of. It cannot check whether the prose is *true*, only
that it exists — that part is the commit's job.

Two things on that page already refuse to go stale: the list of places is
generated from `sitemap.js`, and the backup line counts the stores actually in
the browser. Prefer that pattern over prose whenever a thing can describe
itself. Prose is for the parts that cannot.

---

## Where a number comes from

The recurring failure in this repo is **two pages answering the same question
differently**, and it has happened three times now:

- Five files each kept their own copy of the site map. They drifted.
  → `sitemap.js`, enforced by `tools/sitemap.test.js`.
- The daily surfaces read v1's plan while the Plan page read v2. A move closed
  on one never appeared as a win on the other.
  → `plan-v2-data.js`, enforced by `tools/plan-source.test.js`.
- The Debt panel printed a hardcoded net worth under the words "today" while
  the Net worth panel of the same page held real snapshots, and the Vault wrote
  amounts with no currency while every other reader assumed the base.
  → `Money.position()`, enforced by `tools/money-sync.test.js`.

So, before adding a figure to a page:

1. **Does something already own this?** `Money` owns currency and net worth.
   `PlanV2` owns the plan and anything derived from it. `SITEMAP` owns the
   structure. `Backup` owns what a backup contains. Read it, do not re-derive it.
2. **Store inputs, derive outputs.** A stored conclusion cannot notice that it
   disagrees with its own inputs. `PlanV2.sy*` recomputes the school-year model
   from the figures the source document states, which is how that document's
   own recommendation was found not to follow from its own numbers.
3. **Date anything that will age.** A figure printed under the word "today"
   that was typed in August is a lie by September. Show the date it came from.
4. **Never guess a conversion.** `Money.convert()` returns `null` when a rate is
   missing rather than assuming 1:1. Say "not counted", never a total that is
   quietly short.

---

## Conventions

- **Storage keys** are `ct_<thing>_v1`. `sync.js` pushes every localStorage key
  that is not `__sync*` or `__local*`, so a `ct_` key rides the cross-device
  sync for free — and anything secret must be `__local*` or it is uploaded in
  plaintext. See `VAULT.md`.
- **Pages** go in the repo root and get declared in `sitemap.js` with a `dest`
  and a `panel`. A `.md` file in the root is rendered to a page at deploy time
  (`Publication Pipeline.md` is the pattern). Undeclared pages fail the tests.
- **Folded pages** keep a stub at their old address that redirects to the new
  panel. Deleting stubs is what turns a consolidation into broken links.
- **Source documents are kept as written.** Where a figure in one does not
  survive being checked, the amendment goes in the plan's `corrections`, not
  into the document. A source edited to agree with the dashboard is no longer a
  record of anything.
- **`.dc.html` pages** are React exports whose runtime re-renders from pristine
  source a tick after boot. A DOM edit made at `DOMContentLoaded` is thrown
  away — see the header of `upbar.js`, which learned this the expensive way.
- **CSS variables** come from `hub.css`: `--ok/-w/-l`, `--owed/-w/-l`,
  `--warn/-w/-l`. `--owed-bg` and `--owed-ln` do **not** exist; several older
  rules reference them and silently fall back.
- **Comments explain why, not what.** The ones in this repo carry the bug that
  caused the code to look the way it does. Keep that.

---

## Tests

`node tools/<name>.test.js` from the repo root; no dependencies. Every one of
them is listed in `.github/workflows/deploy.yml` and runs **before** the build —
so a failing test does not just show a red badge, it stops the site shipping.
A stale assertion is therefore an outage, not a nuisance.

Add a test when you fix something a green suite did not catch, and say in its
header what shipped broken. That is the house style and it is why these files
read the way they do.

Anything time-dependent must **drive the clock, not read it**. A test asserting
"the gate has not passed" against a hardcoded date passes until that date, then
fails forever and blocks every deploy. Set the date the test needs.

---

## Environment notes

- `cryptography` will not import in some sandboxes, so `.github/inject.py`
  cannot be run end to end there. Its markdown and injection stages can be
  exercised by stubbing `import vault`; the seal cannot.
- Chromium is at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Serving
  a built copy and driving it is the only way to check the `.dc.html` pages
  actually render — they need their runtime, and it does not run from `file://`.
