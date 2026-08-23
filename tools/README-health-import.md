# Getting iPhone health data into the hub

`Health.html` reads a store called `ct_health_v1`. Nothing in the hub can fill
that store by itself, for a reason worth stating once: **HealthKit is not
readable from a web page, and it does not exist on macOS at all.** There is no
browser API, and no Health app on the Mac. Something on the *phone* has to
extract the data; everything below is a way of getting what it extracts across.

The page does not care which route you use. All of them land in the same
`Health.ingest()` normaliser, deduped by sample id, so you can switch later
without the page changing and without duplicating a day you already have.

---

## Route B — Health Auto Export → iCloud Drive → the import panel

The one to start with. No server, no credential, no recurring bill.

### 1. Set up the automation (once)

In **Health Auto Export → Automations → New Automation**:

| setting | value | why |
|---|---|---|
| Destination | **iCloud Drive** | no server in the loop |
| Format | **JSON** | CSV loses the sleep-stage breakdown |
| Aggregation | **Daily** | one file per day keeps each import small |
| Schedule | whatever suits — early morning catches the night | |

Then pick the metrics. The ones the hub currently maps:

- **Sleep Analysis** — the important one. Arrives pre-aggregated with
  `core` / `deep` / `rem`, which is what the stage bar draws.
- **Dietary Energy, Protein, Carbohydrates, Total Fat, Fiber, Dietary Sugar** —
  your Fitatu data. These are timestamped per entry, and the hub clusters
  samples within ten minutes of each other back into a **meal**, which is what
  makes "hours since eating" computable.
- **Dietary Caffeine, Dietary Water**
- **Step Count, Active Energy, Apple Exercise Time**
- **Weight & Body Mass, Body Fat Percentage**
- **Resting Heart Rate, Heart Rate Variability, Respiratory Rate, Blood Oxygen, VO₂ Max**
- **Workouts** — Gravitus and NRC sessions both land here.

Turn on anything else you like. Unmapped metrics are **not silently dropped** —
the import report names them ("not mapped, so not stored: Blood Glucose"), which
is the signal to add them to the `METRICS` table in `health-data.js`.

### 2. Import

Open **The Body → import → Choose a file**, then Files ▸ iCloud Drive ▸
`HealthAutoExport` ▸ the day you want. Multiple files at once is fine, and
re-importing a day you already have is a no-op rather than a duplicate.

The same panel takes:
- **`export.xml`-derived JSON** for a one-time backfill of your whole history
  (Health ▸ Profile ▸ Export All Health Data). Too big for the URL route, fine here.
- **anything shaped like HAE's JSON**, including a hub re-export.

---

## Route A — a Shortcut, no purchase

If the HAE trial lapses and you would rather not buy it, a Shortcut can read
HealthKit directly and hand the data over in a URL fragment — the same trick
`anki_sync.py --open` uses, and for the same reason: **a fragment never reaches
the server**, so the payload appears in no access log and needs no credential.

Rough shape:

```
Find Health Samples  (Dietary Energy, where Date is today)
Find Health Samples  (Protein / Carbohydrates / Sleep Analysis / …)
Find Workouts        (where Date is today)
  → Dictionary  { data: { metrics: [ … ], workouts: [ … ] } }
Base64 Encode        (with "Line Breaks: None")
Text                 https://<your-pages-url>/Health.html#hk=[Base64]
Open URLs
```

The dictionary must match HAE's shape — `{ name, units, data: [{ qty, date }] }`
per metric — because that is what the normaliser sniffs for.

**Known weak spot:** Shortcuts is awkward about sleep *stages*. Total asleep time
comes out fine; the core/deep/REM split is the thing you will fight it over. That
is the main argument for Route B.

---

## Route C — the Mac relay, for when the taps get old

Routes A and B both need you to do something. This one does not.

iCloud Drive is a real directory on the Mac:

```
~/Library/Mobile Documents/com~apple~CloudDocs/HealthAutoExport/
```

A launchd job in the shape of `tools/anki_sync.py` can watch that folder, take
the newest file, and either

- open the hub with `#hk=<base64>` (no credential — preferred, same reasoning as
  the Anki job's `--open`), or
- write it to `feeds/{uid}` in Firestore with a service-account key, which
  `feeds.js` already knows how to pick up. Note the asymmetry the Anki README
  raises: a service-account key bypasses security rules entirely and can rewrite
  every document in the project, while this job only ever needs to publish one
  field.

Route C composes with **either** extractor. It replaces the delivery step, never
the extraction step — see the top of this file for why the Mac cannot do that
part itself.

---

## What each app actually contributes

| app | reaches Health | what survives the trip |
|---|---|---|
| **Fitatu** | yes, two-way | dietary energy, macros, weight — with per-entry timestamps |
| **NRC** | yes | running workouts: distance, duration, HR, energy |
| **Gravitus** | yes | that a strength session happened, how long, how much energy |
| Apple Watch / iPhone | native | sleep + stages, RHR, HRV, steps, respiratory rate |

**The one real loss is per-set data.** `HKWorkout` has no model for sets, reps or
load, so a Gravitus session arrives as "Traditional Strength Training, 70 min,
360 kcal" and nothing more. This is structural — no exporter can fix it. The
Grind board is already the set-level record, so the split is: **Health supplies
the load and the timing, Grind supplies the numbers.**

---

## Where the data goes

- `ct_health_v1` in `localStorage`, carried between devices by `sync.js` like
  every other `ct_*` key.
- `archive.js` splits it by quarter once it passes 120 days, so it cannot grow
  into the 1 MiB Firestore document ceiling. Days, events and moments all split;
  `meta` stays hot.
