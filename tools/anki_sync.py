#!/usr/bin/env python3
"""
anki_sync.py — read the Anki collection on this Mac and publish the numbers
the hub needs, so the Standing stops being typed in by hand.

WHY THE DATABASE AND NOT ANKICONNECT
------------------------------------
AnkiConnect serves http://localhost:8765. The hub is HTTPS on GitHub Pages,
so a browser refuses the request as mixed content before it is even sent, and
a phone cannot reach this machine at all. It also requires Anki to be running.
Reading the collection directly works with Anki closed, needs no add-on, and
does not care which device is reading the hub afterwards.

WHAT IT READS
-------------
~/Library/Application Support/Anki2/<profile>/collection.anki2 — a SQLite
database. It is copied to a temp file before opening, for two reasons: Anki
holds a write lock while running, and a reader that touches the live file
during a write can see a torn page. The copy is opened read-only and deleted
afterwards. Nothing here ever writes to your collection.

WHAT IT COMPUTES
----------------
    due         cards scheduled for today, learning cards included
    backlog     cards overdue from previous days — the number the streak hides
                (disjoint from `due`, so the two can be shown side by side)
    doneToday   reviews answered since today's rollover
    streak      consecutive days with at least one review
    secPerCard  median seconds per review over 30 days — a typical card
    secMean     mean seconds per review — what a PILE of cards costs, since
                total time is n x mean and the long tail is real work
    minsToday   how long today's queue should take, at the mean
    minsBacklog how long the whole backlog should take, at the mean

The rollover matters: Anki's day does not start at midnight but at the "next
day starts at" hour (4am by default), and a review at 1am belongs to the
previous Anki day. Using local midnight would misreport both streak and
doneToday for anyone who studies late — which is the case this is for.

USAGE
-----
    python3 anki_sync.py --print                 # look at the numbers, write nothing
    python3 anki_sync.py --out ~/anki.json       # write a JSON file
    python3 anki_sync.py --firestore creds.json  # publish for the hub to read

Install as a launchd job to run every 30 minutes; see tools/README-anki-sync.md.
"""

import argparse
import json
import os
import shutil
import sqlite3
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone

ANKI_ROOT = os.path.expanduser("~/Library/Application Support/Anki2")


def find_collection(profile=None):
    """Locate collection.anki2. With no profile named, take the only one, or
    fail loudly listing what exists rather than guessing between profiles."""
    if not os.path.isdir(ANKI_ROOT):
        raise SystemExit(f"No Anki data at {ANKI_ROOT} — is Anki installed for this user?")
    if profile:
        path = os.path.join(ANKI_ROOT, profile, "collection.anki2")
        if not os.path.isfile(path):
            raise SystemExit(f"No collection at {path}")
        return path
    found = []
    for name in sorted(os.listdir(ANKI_ROOT)):
        p = os.path.join(ANKI_ROOT, name, "collection.anki2")
        if os.path.isfile(p):
            found.append((name, p))
    if not found:
        raise SystemExit(f"No collection.anki2 under {ANKI_ROOT}")
    if len(found) > 1:
        names = ", ".join(n for n, _ in found)
        raise SystemExit(f"Several profiles ({names}) — pass --profile NAME")
    return found[0][1]


def open_snapshot(path):
    """Copy then open read-only. Anki keeps a write lock open while running,
    and a WAL file may hold committed data the main file does not yet have —
    so the sidecars come along or the snapshot reads stale."""
    tmpdir = tempfile.mkdtemp(prefix="ankisync-")
    dst = os.path.join(tmpdir, "collection.anki2")
    shutil.copy2(path, dst)
    for suffix in ("-wal", "-shm"):
        side = path + suffix
        if os.path.exists(side):
            shutil.copy2(side, dst + suffix)
    con = sqlite3.connect(dst)
    con.row_factory = sqlite3.Row
    return con, tmpdir


def day_cutoff(con):
    """Anki's day boundary. `crt` is collection creation (epoch seconds) and
    `rollover` is the hour a new day starts — 4am by default. Returns
    (today_index, cutoff_epoch_for_end_of_today)."""
    row = con.execute("SELECT crt FROM col").fetchone()
    crt = int(row["crt"])
    rollover = 4
    try:
        cfg = con.execute("SELECT conf FROM col").fetchone()["conf"]
        rollover = int(json.loads(cfg).get("rollover", 4))
    except Exception:
        try:
            v = con.execute(
                "SELECT val FROM config WHERE KEY='rollover'").fetchone()
            if v:
                rollover = int(json.loads(v["val"]))
        except Exception:
            pass
    # Day 0 begins at crt; each day is 86400s from the rollover-adjusted start.
    start = datetime.fromtimestamp(crt).replace(
        hour=rollover, minute=0, second=0, microsecond=0)
    if datetime.fromtimestamp(crt) < start:
        start -= timedelta(days=1)
    today_idx = (datetime.now() - start).days
    end_of_today = start + timedelta(days=today_idx + 1)
    return today_idx, int(end_of_today.timestamp() * 1000), rollover


def collect(con):
    today, end_ms, rollover = day_cutoff(con)

    # queue: 0 new, 1 learning, 2 review, 3 day-learn; negative = suspended/buried.
    # Only queues >= 1 carry a `due` in days for scheduling purposes.
    # `due == today`, not `<= today`. Anki's own deck list folds the backlog
    # into one Due number, but the hub shows today's load and the debt as two
    # separate figures — the whole point being that a streak kept by skimming
    # hides the second. Counting overdue cards in both would double them.
    row = con.execute(
        "SELECT COUNT(*) n FROM cards WHERE queue IN (2,3) AND due = ?", (today,)
    ).fetchone()
    due_total = int(row["n"])

    row = con.execute(
        "SELECT COUNT(*) n FROM cards WHERE queue IN (2,3) AND due < ?", (today,)
    ).fetchone()
    backlog = int(row["n"])

    row = con.execute(
        "SELECT COUNT(*) n FROM cards WHERE queue = 1 AND due <= ?",
        (int(time.time()),)
    ).fetchone()
    learning = int(row["n"])

    # Reviews answered today, by Anki's day rather than the calendar's.
    start_ms = end_ms - 86400 * 1000
    row = con.execute(
        "SELECT COUNT(*) n FROM revlog WHERE id >= ? AND id < ?", (start_ms, end_ms)
    ).fetchone()
    done_today = int(row["n"])

    # Seconds per review over 30 days, as BOTH statistics, because they
    # answer different questions and using one for the other is an error.
    #
    #   median — what a typical card costs. Robust to a card left open while
    #            you made coffee, which arrives as a 60-second review.
    #   mean   — what a PILE of cards costs, because total time is n x mean.
    #            A long tail makes the mean larger, and for "how long will
    #            the backlog take" that tail is real work you will do.
    #
    # Estimating a backlog from the median silently assumes every card is
    # typical, which understates it by exactly the tail.
    #
    # Anki caps a single review at `maxTaken` (60s default) before it is
    # written, so both figures are already truncated at the top — the mean
    # here is a floor, not a guess.
    since = end_ms - 30 * 86400 * 1000
    times = [r["time"] for r in con.execute(
        "SELECT time FROM revlog WHERE id >= ? AND time > 0 ORDER BY time", (since,))]
    if times:
        sec_median = round(times[len(times) // 2] / 1000.0, 1)
        sec_mean = round(sum(times) / len(times) / 1000.0, 1)
        n_reviews = len(times)
    else:
        sec_median = sec_mean = None
        n_reviews = 0
    sec_per_card = sec_median          # kept: "a typical card"

    # Streak: consecutive Anki days, walking back from today, with any
    # review in them. Index 0 is today, 1 is yesterday. `end_ms - 1` so a
    # review landing exactly on the boundary counts to the day it closes.
    days = set()
    for r in con.execute("SELECT id FROM revlog WHERE id >= ?",
                         (end_ms - 400 * 86400 * 1000,)):
        idx = (end_ms - 1 - int(r["id"])) // (86400 * 1000)
        if idx >= 0:
            days.add(idx)
    # Today being empty does not break a streak — the day is not over yet — so
    # start counting at yesterday when nothing has been answered today.
    i = 0 if 0 in days else 1
    streak = 0
    while i in days:
        streak += 1
        i += 1

    return {
        "due": due_total + learning,
        "backlog": backlog,
        "doneToday": done_today,
        "streak": streak,
        "secPerCard": sec_per_card,        # median — a typical card
        "secMean": sec_mean,               # mean — what a pile actually costs
        "reviews30d": n_reviews,
        # Totals use the mean, per the note above.
        "minsToday": round((due_total + learning) * sec_mean / 60.0)
        if sec_mean else None,
        "minsBacklog": round(backlog * sec_mean / 60.0) if sec_mean else None,
        "rollover": rollover,
        "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "mac",
    }


def to_firestore(payload, creds_path, project=None, uid=None):
    """Publish where the hub can read it. Kept in its own document rather than
    merged into the doc sync.js owns — sync.js rewrites that one wholesale from
    localStorage, so anything written into it from outside is destroyed on the
    next push from any device."""
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError:
        raise SystemExit("pip3 install firebase-admin")
    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.Certificate(creds_path))
    db = firestore.client()
    uid = uid or json.load(open(creds_path)).get("client_email", "anki")
    db.collection("feeds").document(uid).set({"anki": payload}, merge=True)
    return f"feeds/{uid}"


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--profile", help="Anki profile name, if you have several")
    ap.add_argument("--print", action="store_true", dest="show",
                    help="print the numbers and write nothing")
    ap.add_argument("--out", help="write JSON to this path")
    ap.add_argument("--firestore", help="service-account JSON, to publish for the hub")
    ap.add_argument("--uid", help="Firebase uid to publish under")
    args = ap.parse_args()

    path = find_collection(args.profile)
    con, tmpdir = open_snapshot(path)
    try:
        payload = collect(con)
    finally:
        con.close()
        shutil.rmtree(tmpdir, ignore_errors=True)

    if args.show or not (args.out or args.firestore):
        left = max(0, payload["due"] - payload["doneToday"])
        print(json.dumps(payload, indent=2))
        print(f"\n  {payload['streak']}d streak · {payload['backlog']} behind · "
              f"{payload['doneToday']} done · {left} still due"
              + (f" · ~{payload['minsToday']} min" if payload["minsToday"] else ""))
        if payload["secPerCard"]:
            print(f"  typical card {payload['secPerCard']}s, mean {payload['secMean']}s "
                  f"over {payload['reviews30d']} reviews")
            print(f"  the backlog is ~{payload['minsBacklog']} min of work at the mean")
        print(f"  collection: {path}")
        print(f"  Anki day rolls over at {payload['rollover']}:00")

    if args.out:
        with open(os.path.expanduser(args.out), "w") as f:
            json.dump(payload, f, indent=2)
        print(f"wrote {args.out}")

    if args.firestore:
        where = to_firestore(payload, os.path.expanduser(args.firestore), uid=args.uid)
        print(f"published to {where}")


if __name__ == "__main__":
    sys.exit(main())
