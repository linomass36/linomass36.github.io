# Anki → the hub, automatically

Thirty minutes of setup, once, and the Anki row on the Standing stops being
something you type.

## What it does

`anki_sync.py` opens your Anki collection, works out what is due, what is
behind, what you did today and how long a card actually takes, and publishes
those to Firestore. The hub picks them up through `feeds.js` and hands them to
`systems.js`, which already knows how to read them.

It never writes to your collection. It copies the database to a temp file,
reads the copy, and deletes it.

## Why not AnkiConnect

AnkiConnect serves `http://localhost:8765`. The hub is HTTPS on GitHub Pages, so
the browser refuses that as mixed content before the request is even sent — and
your phone cannot reach your laptop regardless. Reading the database works with
Anki closed and needs no add-on.

---

## 1 · Check it reads your collection

```bash
mkdir -p ~/tools
curl -o ~/tools/anki_sync.py \
  https://raw.githubusercontent.com/linomass36/linomass36.github.io/main/tools/anki_sync.py
python3 ~/tools/anki_sync.py --print
```

The line to check is this one:

```
60 due today + 249 behind = 309 (this should equal Anki's Due column)
```

Open Anki and add up the **Due** column. If it matches, the script is reading
your collection the way Anki does. If it does not, stop here — everything
downstream inherits the error.

Two other numbers are worth a glance:

- **`secMeanToday`** should match the `s/card` in Anki's "Studied N cards in
  M minutes today" header. Same window, same arithmetic.
- **`secMean`** is the 30-day figure and will usually be lower. That is not a
  disagreement: a single session swings with its lapse rate, and lapses are the
  slow reps. The 30-day number is the one to plan a backlog from.

## 2 · Get a service-account key

The script is not a browser and cannot sign in as you, so it needs its own
credential.

1. [Firebase console](https://console.firebase.google.com/) → your project
2. ⚙ **Project settings** → **Service accounts**
3. **Generate new private key** → save as `~/tools/anki-key.json`

```bash
chmod 600 ~/tools/anki-key.json
```

**This file is a key to your database.** Keep it out of the repo — the repo is
public. `~/tools` is outside it, which is why the instructions put it there.

## 3 · Find your uid

The hub reads `feeds/{your-uid}`. On any hub page, open the browser console:

```js
firebase.auth().currentUser.uid
```

## 4 · Publish once by hand

```bash
pip3 install firebase-admin
python3 ~/tools/anki_sync.py --firestore ~/tools/anki-key.json --uid YOUR_UID
```

Reload the Standing. The Anki row should show your real numbers with `mac` as
its source.

## 5 · Make it run itself

Save as `~/Library/LaunchAgents/com.cthub.ankisync.plist`, replacing `YOUR_UID`
and `YOURNAME`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.cthub.ankisync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>/Users/YOURNAME/tools/anki_sync.py</string>
    <string>--firestore</string>
    <string>/Users/YOURNAME/tools/anki-key.json</string>
    <string>--uid</string>
    <string>YOUR_UID</string>
  </array>
  <key>StartInterval</key>
  <integer>1800</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/ankisync.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/ankisync.err</string>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.cthub.ankisync.plist
tail -f /tmp/ankisync.log
```

Every thirty minutes, and once when you log in.

To stop it:

```bash
launchctl unload ~/Library/LaunchAgents/com.cthub.ankisync.plist
```

---

## When it stops working

The hub does not pretend a stale reading is current. A reading more than a day
old renders as **"last reading N days ago — the sync is not running"** rather
than showing yesterday's numbers as though they were this morning's. That is
the failure you want: visible, and clearly not your fault.

Check `/tmp/ankisync.err` first.

- **`No collection.anki2 under ...`** — Anki is installed for a different user
  account, or has never been opened.
- **`Several profiles (A, B) — pass --profile NAME`** — add
  `--profile` and the name to the plist arguments.
- **Numbers frozen while Anki is open** — should not happen; the script copies
  the `-wal` and `-shm` sidecars precisely so it sees committed data that has
  not yet been folded into the main file. If it does, close Anki and re-run to
  confirm that is the cause, and say so.
- **Nothing appears in the hub** — the uid is the usual culprit. Check the
  document exists in the Firestore console at `feeds/{uid}`.

## What it does not do

It reads. It never writes to Anki, never reschedules a card, never touches your
backlog. Postponing a queue during a held condition is a decision, so it stays a
thing you do deliberately in Anki rather than something a background job does to
you at 4am.
