# Anki → the hub

Five minutes of setup and the Anki row on the Standing stops being something
you type.

## What it does

`anki_sync.py` opens your Anki collection and works out what is due, what is
behind, what you did today and how long a card actually takes.

It can hand those to the hub two ways. **`--open` needs no credential and is
the one to use.** `--firestore` runs unattended but requires a service-account
key, and that key would be enormously more powerful than this job — see the
security section. Either way the numbers land in `localStorage`, where
`systems.js` already knows how to read them, and `sync.js` carries them to your
phone.

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

---

## 2 · Pick how it runs

Two routes. **Take the first one.**

### `--open` — no credential at all *(recommended)*

```bash
python3 ~/tools/anki_sync.py --open
```

Reads the collection, packs the numbers into a URL fragment, opens the hub.
The page ingests them, wipes the fragment from the address bar, and `sync.js`
carries them to your phone through the sync it already does.

A fragment is never sent to a server — browsers strip everything after the `#`
before making the request — so the reading exists only on your machine and
appears in no access log.

Make it one word:

```bash
echo "alias anki='python3 ~/tools/anki_sync.py --open'" >> ~/.zshrc
```

Then `anki` after a session. If you want it to feel automatic without being
unattended, bind it to a Raycast/Alfred keyword or a Shortcut on the Dock.

**The trade:** it runs when you run it. If you study and never type `anki`, the
hub shows a reading that is a day old — and says so, rather than passing it off
as current.

### `--firestore` — unattended, and it costs you a key

Only if you want it to run with the laptop shut and no involvement. Read the
security note below first, because the honest summary is that **the credential
this needs is far more powerful than the job it does.**

---

## Security: what a service-account key actually is

Not "a password for one document". A Firebase Admin SDK service account
**bypasses Firestore security rules entirely** — that is its designed purpose,
so that trusted server code can act without a signed-in user.

Concretely, a key that exists to write one field of one document can also:

- read every document in the project — every journal entry, vault snapshot,
  network contact, dossier
- overwrite or **delete all of it**, with no undo beyond your own backups
- keep doing so indefinitely: these keys do not expire

And the exposure paths are ordinary, not exotic:

- **the repo is public.** One careless `git add -A` from the wrong directory
  publishes it to the world, permanently, in a history you cannot fully erase
- **backups fan it out.** Time Machine, iCloud Desktop & Documents, Dropbox — a
  key in a synced folder is a key in several more places
- **infostealer malware** targets exactly this: JSON credentials in home
  directories are a standard collection target
- **nothing is attributable.** Every action logs as the service account, so if
  it were misused you could not tell which actions were yours

If you use it anyway, reduce the blast radius rather than hoping:

```bash
chmod 600 ~/tools/anki-key.json          # not world-readable
printf '\n# never\n*anki-key*.json\n' >> .gitignore
```

Keep it outside the repo — `~/tools` is not in it, which is why these
instructions put it there. Create the account in **Google Cloud IAM** with the
`roles/datastore.user` role rather than reusing the default Firebase Admin
account, which carries project **Editor**. That still allows all of Firestore,
but not the rest of the project. Know how to revoke it before you need to:
Firebase console → Project settings → Service accounts → delete the key. Doing
so takes effect immediately.

**The judgement:** the whole point of this job is a number you could type in
thirty seconds. Trading permanent full-database credentials for that is a poor
exchange, which is why `--open` is the recommendation and this section exists
rather than a cheerful setup guide.

## 2b · If you chose `--firestore` anyway: get the key

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

## 2c · Find your uid

The hub reads `feeds/{your-uid}`. On any hub page, open the browser console:

```js
firebase.auth().currentUser.uid
```

## 2d · Publish once by hand

```bash
pip3 install firebase-admin
python3 ~/tools/anki_sync.py --firestore ~/tools/anki-key.json --uid YOUR_UID
```

Reload the Standing. The Anki row should show your real numbers with `mac` as
its source.

## 2e · Make it run itself

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
