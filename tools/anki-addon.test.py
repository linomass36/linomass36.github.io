#!/usr/bin/env python3
"""
anki-addon.test.py — the Year 2 Hub add-on and the website keep one checklist between them.

Run with `python3 tools/anki-addon.test.py` from the repo root. Also run by the deploy.

WHY. The add-on (tools/anki-addon/year2_hub) builds the day's tasks and the card plan inside Anki; the website's Almanac
now shows that list and ticks it. Two places can tick the same task, or move the same test, between syncs, so each
change carries the time it was made and the newer one wins — un-ticking included. These are the cases where a sync
that "mostly works" would quietly lose a tick or a moved date: a stale website tick arriving after a fresh one in
Anki, an un-tick, a date moved in both places, a refused database, a rotated sign-in token.

bridge.py has no Qt, so the add-on package is loaded without its __init__ (which needs Anki). The network is a fake;
"now" is set, never read (CLAUDE.md).
"""
import datetime as dt
import importlib.util
import json
import os
import sys
import tempfile
import types

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PKG = os.path.join(ROOT, "tools", "anki-addon", "year2_hub")

pkg = types.ModuleType("year2_hub")
pkg.__path__ = [PKG]
sys.modules["year2_hub"] = pkg


def load(name):
    spec = importlib.util.spec_from_file_location("year2_hub." + name, os.path.join(PKG, name + ".py"))
    m = importlib.util.module_from_spec(spec)
    sys.modules["year2_hub." + name] = m
    spec.loader.exec_module(m)
    return m


T = load("tasks")
BR = load("bridge")
PLAN = json.load(open(os.path.join(PKG, "plan.json")))

failed = 0


def ok(cond, what):
    global failed
    print(("  pass  " if cond else "  FAIL  ") + what)
    if not cond:
        failed += 1


def group(n):
    print("\n" + n)


TODAY = dt.date(2026, 10, 26)        # a Monday


def state():
    return {"version": 2, "checks": {}, "overrides": {}, "baseline": {"made": "x"}, "hub_start": "2026-10-20"}


# ── pairing ──────────────────────────────────────────────────────────────
group("A pairing code is the website's sign-in, and nothing else is accepted")
import base64
code = "cthub1." + base64.urlsafe_b64encode(json.dumps(
    {"v": 1, "apiKey": "AIza-test", "projectId": "ct-hub", "uid": "u1", "refreshToken": "r1",
     "origin": "https://linomass36.github.io"}).encode()).decode().rstrip("=")
c = BR.decode_pairing(code[:20] + "\n  " + code[20:])
ok(c == {"apiKey": "AIza-test", "projectId": "ct-hub", "uid": "u1", "refreshToken": "r1",
         "origin": "https://linomass36.github.io"}, "a pasted code survives line breaks and spaces")
for bad, why in (("hello", "not a code"), ("cthub1.!!!", "damaged"), ("cthub1." + base64.urlsafe_b64encode(b'{"apiKey":"x"}').decode(), "incomplete")):
    try:
        BR.decode_pairing(bad)
        ok(False, "%s is refused" % why)
    except BR.BridgeError as e:
        ok(len(str(e)) > 20, "%s is refused, with what to do (%s)" % (why, str(e)[:40]))

folder = tempfile.mkdtemp()
BR.save_creds(folder, c)
ok(BR.load_creds(folder)["uid"] == "u1", "the sign-in is kept in user_files, outside the collection")
ok(oct(os.stat(os.path.join(folder, BR.CREDS_FILE)).st_mode)[-3:] == "600", "readable by this user only")
BR.clear_creds(folder)
ok(BR.load_creds(folder) is None, "disconnect deletes it")

# ── the network ──────────────────────────────────────────────────────────
group("The database is reached as the signed-in user, and a refusal says what to do")
calls = []
store = {}


def fake(method, url, body=None, headers=None, timeout=20):
    calls.append((method, url, body, headers))
    if "securetoken" in url:
        if body["refresh_token"] == "dead":
            return 400, {"error": {"message": "TOKEN_EXPIRED"}}
        return 200, {"id_token": "id-" + body["refresh_token"], "refresh_token": "r2", "expires_in": "3600", "user_id": "u1"}
    side = url.rsplit("/", 1)[1]
    if headers.get("Authorization") != "Bearer id-r1" and headers.get("Authorization") != "Bearer id-r2":
        return 401, None
    if "deny" in url:
        return 403, {"error": {"message": "Missing or insufficient permissions."}}
    if method == "GET":
        return (200, store[side]) if side in store else (404, None)
    store[side] = body
    return 200, body


clock = [1000.0]
r = BR.Remote(c, http=fake, clock=lambda: clock[0])
ok(r.get("hub") is None, "no website document yet reads as nothing, not an error")
ok(r.rotated and r.creds["refreshToken"] == "r2", "a rotated refresh token is noticed, so the caller can save it")
ok(calls[0][3].get("Referer") == "https://linomass36.github.io/", "the token call names the website, for a key limited to it")
r.put("anki", {"at": "2026-10-26T10:00:00Z", "x": 1})
ok(set(store["anki"]["fields"]) == {"at", "json"} and json.loads(store["anki"]["fields"]["json"]["stringValue"])["x"] == 1,
   "a payload is written as one JSON string field, read back whole by the browser")
n = len([x for x in calls if "securetoken" in x[1]])
clock[0] += 1200
r.get("anki")
ok(len([x for x in calls if "securetoken" in x[1]]) == n, "the ID token is reused until it is near expiry")
clock[0] += 3000
r.get("anki")
ok(len([x for x in calls if "securetoken" in x[1]]) == n + 1, "and refreshed after")
try:
    BR.Remote(dict(c, refreshToken="dead"), http=fake).get("hub")
    ok(False, "a dead pairing is refused")
except BR.BridgeError as e:
    ok("pairing code" in str(e), "a dead pairing says to make a new code")
try:
    BR.Remote(dict(c, projectId="deny"), http=fake).get("hub")
    ok(False, "a refused read is an error")
except BR.BridgeError as e:
    ok("bridge" in str(e) and "rule" in str(e), "a 403 says to publish the bridge rule")

# ── ticks: the newer one wins ────────────────────────────────────────────
group("A tick made in both places keeps the newer one, un-ticking included")
st = state()
tid_a, tid_b, tid_c = "2026-10-26|physio|x", "2026-10-26|histo|y", "2026-10-26|embryo|z"
st["checks"] = {tid_a: "done", tid_b: "done"}
st["check_times"] = {tid_a: "2026-10-26T09:00:00Z", tid_b: "2026-10-26T09:00:00Z"}
got = BR.apply_inbound(st, PLAN, {"checks": {
    tid_a: {"v": None, "t": "2026-10-26T08:00:00Z"},     # older un-tick from the website: ours stands
    tid_b: {"v": None, "t": "2026-10-26T10:00:00Z"},     # newer un-tick: it wins
    tid_c: {"v": "done", "t": "2026-10-26T10:00:00Z"}}})  # a tick only the website has
ok(st["checks"].get(tid_a) == "done", "an older website un-tick does not undo a newer tick in Anki")
ok(tid_b not in st["checks"], "a newer website un-tick does")
ok(st["checks"].get(tid_c) == "done", "a tick made only on the website arrives")
ok(got["ticks"] == 2, "and two ticks changed (%s)" % got["ticks"])
again = BR.apply_inbound(st, PLAN, {"checks": {tid_c: {"v": "done", "t": "2026-10-26T10:00:00Z"}}})
ok(again["ticks"] == 0, "the same tick read twice changes nothing")

out = BR.build_outbound(PLAN, st, TODAY)
ok(out["checks"][tid_b] == {"v": None, "t": "2026-10-26T10:00:00Z"}, "an un-tick goes back out with its time, so it can win there too")
ok(out["checks"][tid_a]["v"] == "done", "and a tick goes out as a tick")

# ── dates: moved on the website, the cards follow ────────────────────────
group("A date moved in Study Control moves the add-on's event, and its cards with it")
st = state()
cal = T.Calendar(PLAN, st)
eid = "phys-lab06"
was = cal.date_of(eid)
got = BR.apply_inbound(st, PLAN, {"moves": {eid: {"date": "2026-11-05", "t": "2026-10-26T10:00:00Z"}}})
cal = T.Calendar(PLAN, st)
ok(was.isoformat() == "2026-11-06" and cal.date_of(eid).isoformat() == "2026-11-05", "physiology lab 6 moves from 6 to 5 Nov")
ok(got["moves"] == [(eid, "2026-11-05")] and st["baseline"] is None, "and the card plan is told to re-plan")
link = PLAN["calendar"]["events"]
links = [e for e in link if e["id"] == eid][0].get("links", [])
ok(links and st["overrides"][links[0][0]]["release"] == "2026-11-05", "its linked card unit's release moved too")
ok(not cal.tbc(eid), "a date set on the website is no longer 'to confirm'")
st["event_moved_at"][eid] = "2026-10-27T10:00:00Z"
cal.set_date(eid, dt.date(2026, 11, 7))
again = BR.apply_inbound(st, PLAN, {"moves": {eid: {"date": "2026-11-05", "t": "2026-10-26T10:00:00Z"}}})
ok(not again["moves"] and T.Calendar(PLAN, st).date_of(eid).isoformat() == "2026-11-07",
   "a move made later in Anki is not undone by the website's older one")
ok(not BR.apply_inbound(st, PLAN, {"moves": {"nope": {"date": "2026-11-05", "t": "2027-01-01T00:00:00Z"}}})["moves"],
   "a move for an event the plan does not have is ignored")

# ── results ──────────────────────────────────────────────────────────────
group("The website's results are kept, for the subject pages and the export")
st = state()
res = [{"id": "r1", "date": "2026-10-23", "subject": "physiology", "kind": "entrance", "title": "Ch 47-49", "score": 9, "max": 10,
        "causes": ["recall", "time"], "createdAt": "2026-10-23T14:00:00Z"}]
got = BR.apply_inbound(st, PLAN, {"at": "2026-10-26T10:00:00Z", "results": res})
ok(got["results"] == 1 and st["hub_results"][0]["score"] == 9, "results land in the state")
csv_text = BR.results_csv(st["hub_results"])
ok(csv_text.splitlines()[1].startswith("2026-10-23,physiology,entrance,Ch 47-49,9,10,90.0,,recall;time"),
   "and export as CSV with the percentage worked out (%s)" % csv_text.splitlines()[1][:60])

# ── what goes out ────────────────────────────────────────────────────────
group("What the website receives")
st = state()
out = BR.build_outbound(PLAN, st, TODAY)
ok(len(out["days"]) == BR.DAYS_BACK + BR.DAYS_AHEAD + 1 and "2026-10-19" in out["days"] and "2026-11-09" in out["days"],
   "a week back and two weeks ahead, so the phone has the plan when Anki has not been opened")
mon = out["days"]["2026-10-26"]
ok(mon and all(set(t) >= {"id", "subject", "title", "min", "floor"} for t in mon), "each day's tasks, as the hub makes them")
ok(any(e["id"] == "phys-lab06" and e["date"] == "2026-11-06" and e["tbc"] for e in out["events"]), "the calendar, with what is still to confirm")
ok(json.loads(json.dumps(out)) == out, "and it is plain JSON")

# ── export ───────────────────────────────────────────────────────────────
group("Export holds both sides")
st = state()
st["checks"] = {"2026-10-26|physio|phys-lab05-cz": "done"}
BR.apply_inbound(st, PLAN, {"results": res})
b = BR.export_bundle(PLAN, st, TODAY, {"ceiling": {"anking": 25}}, {"at": "2026-10-26T10:00:00Z", "studyControl": {"events": {}}})
ok(b["addon"]["tasks"][0]["date"] == "2026-10-20" and b["addon"]["tasks"][-1]["date"] == "2026-10-26", "every day since the hub started, to today")
ok(any(t["status"] == "done" for t in b["addon"]["tasks"]), "with what was ticked")
ok(b["website"]["results"] == res and b["website"]["study_control"] == {"events": {}}, "and the website's results and Study Control")
paths = BR.write_export(tempfile.mkdtemp(), b, TODAY)
ok([os.path.basename(p) for p in paths] == ["year2-study-data-2026-10-26.json", "year2-study-data-2026-10-26-results.csv",
                                             "year2-study-data-2026-10-26-tasks.csv"], "three files: everything, results, tasks")

# ── the add-on's own wiring ──────────────────────────────────────────────
group("The add-on stamps its own ticks and moves, and keeps them through a plan run")
src = open(os.path.join(PKG, "__init__.py")).read()
ok("BR.record_tick(st, tid)" in src and "BR.record_move(st, eid)" in src, "a tick and a moved date in Anki carry their time")
ok('"check_times", "hub_results", "hub_results_at"' in src, "a plan run does not write over ticks or results synced while it ran")
ok("USER = os.path.join(HERE, \"user_files\")" in src and "set_config" not in src.split("def bridge_sync")[1].split("def ")[0],
   "the token is kept in user_files, never in the collection")

print("\n%d failed" % failed if failed else "\nall green")
sys.exit(1 if failed else 0)
