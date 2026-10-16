#!/usr/bin/env python3
"""
anki-sync.test.py — the study week the Mac sends is the one worked by hand.

Run with `python3 tools/anki-sync.test.py` from the repo root. Also run by
the deploy.

WHY. Study Control's Anki row used to be typed every Sunday from numbers
worked out of an export. anki_sync.py now sends them, so the arithmetic that
was done by hand is pinned here on a history small enough to add up: real
time from the gaps between answers (Anki's logged time stops at 60 s), the
04:00 day boundary, review-only recall, a filtered deck counting toward its
home deck, a deck with no subject in its name, and a reschedule that is not
an answer.

"Now" is passed in, never read from the clock (CLAUDE.md).
"""
import importlib.util
import json
import os
import sqlite3
import sys
import tempfile
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("anki_sync", os.path.join(ROOT, "tools", "anki_sync.py"))
A = importlib.util.module_from_spec(spec)
spec.loader.exec_module(A)

failed = 0


def ok(cond, what):
    global failed
    print(("  pass  " if cond else "  FAIL  ") + what)
    if not cond:
        failed += 1


def at(d, h, m=0, s=0):
    return int(datetime(2026, 10, d, h, m, s).timestamp() * 1000)


def collection(modern):
    path = os.path.join(tempfile.mkdtemp(), "c.anki2")
    c = sqlite3.connect(path)
    c.execute("create table col (id integer primary key, crt int, conf text, decks text)")
    c.execute("create table cards (id integer primary key, did int, odid int, queue int)")
    c.execute("create table revlog (id integer primary key, cid int, ease int, type int, time int)")
    decks = {1: "Year 2\x1fAnatomy", 2: "Year 2\x1fHistology\x1fW2", 3: "Physiology (Guyton)",
             4: "Misc", 5: "Filtered Deck 1"}
    if modern:
        c.execute("create table decks (id integer primary key, name text)")
        for k, v in decks.items():
            c.execute("insert into decks values (?,?)", (k, v))
        c.execute("insert into col values (1,0,'{}','{}')")
    else:
        dj = {str(k): {"id": k, "name": v.replace("\x1f", "::")} for k, v in decks.items()}
        c.execute("insert into col values (1,0,?,?)", (json.dumps({"rollover": 4}), json.dumps(dj)))
    for row in [(101, 1, 0, 2), (102, 1, 0, 1), (103, 1, 0, 0), (201, 2, 0, 2), (301, 5, 3, 2), (401, 4, 0, 2)]:
        c.execute("insert into cards values (?,?,?,?)", row)
    for row in [
        (at(8, 10), 101, 3, 0, 10000),          # last week: 101's first answer, a learning step
        (at(13, 20), 101, 3, 1, 20000),         # after a long gap: Anki's 20 s
        (at(13, 20, 0, 50), 102, 3, 0, 30000),  # 50 s gap; first-ever answer
        (at(13, 20, 2, 20), 101, 1, 1, 60000),  # 90 s gap; a failed review
        (at(13, 20, 30), 201, 3, 1, 15000),     # 27 min gap is a break: 15 s
        (at(14, 2), 301, 4, 1, 70000),          # 02:00 is still the 13th; capped at 60 s; filtered deck
        (at(14, 2, 0, 30), 401, 3, 1, 5000),    # a deck with no subject
        (at(14, 2, 1), 301, 0, 4, 0),           # a reschedule, not an answer
    ]:
        c.execute("insert into revlog values (?,?,?,?,?)", row)
    c.commit()
    c.row_factory = sqlite3.Row
    return c


NOW = at(15, 12)   # Thursday 15 October 2026, noon: day four of the week

for modern in (True, False):
    print("\n%s collection" % ("Modern (decks table)" if modern else "Older (col.decks JSON)"))
    r = A.study_weeks(collection(modern), 4, now_ms=NOW)
    wk = r["weeks"].get("2026-10-12")
    ok(sorted(r["weeks"]) == ["2026-10-05", "2026-10-12"], "this week and last are sent")
    ok(wk and wk["days"] == 4, "this week has had four days, Monday to Thursday (%s)" % (wk and wk["days"]))
    an = wk["subjects"]["anatomy"]
    ok(an["reviews"] == 3, "anatomy has three answers")
    ok(an["min"] == 1, "20 + 50 + 90 s over four days is about 1 min a day (%s)" % an["min"])
    ok(an["recall"] == 50, "recall counts review answers only: one pass, one fail (%s%%)" % an["recall"])
    ok(an["newc"] == 0, "one new card over four days rounds to 0 a day (%s)" % an["newc"])
    ok(an["backlog"] == 1, "one anatomy card is still new and unshown (%s)" % an["backlog"])
    ok(wk["subjects"]["histology"]["reviews"] == 1 and wk["subjects"]["histology"]["newc"] == 0,
       "a card whose first answer is a review was not new that week")
    ph = wk["subjects"]["physiology"]
    ok(ph["reviews"] == 1 and ph["recall"] == 100,
       "a card in a filtered deck counts toward its home deck, and 02:00 belongs to the day before")
    ok("embryology" not in wk["subjects"], "a subject with no deck is left out rather than shown as zero")
    ok(r["unmatched"] == ["Misc"], "a deck with no subject in its name is named, not dropped (%s)" % r["unmatched"])
    last = r["weeks"]["2026-10-05"]
    ok(last["days"] == 7 and last["subjects"]["anatomy"]["backlog"] is None,
       "last week divides by seven, and leaves new-waiting blank: the queue is only known now")

print("\nDeck names map to subjects")
for name, want in [("Year 2::Anatomy::Upper limb", "anatomy"), ("HISTOLOGY", "histology"),
                   ("Guyton ch 4-5", "physiology"), ("Embryology - BWAB", "embryology"), ("Spanish", None)]:
    ok(A.subject_of(name) == want, '"%s" -> %s' % (name, want))

print("\nThe sync opens the front door")
src = open(os.path.join(ROOT, "tools", "anki_sync.py")).read()
ok('default="https://linomass36.github.io/Almanac.html"' in src, "--open lands on the Almanac, which files the week")

print("\n%d failed" % failed if failed else "\nall green")
sys.exit(1 if failed else 0)
