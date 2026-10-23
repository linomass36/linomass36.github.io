"""Year 2 Hub <-> the CT hub website (linomass36.github.io). No Qt here, so it can be tested on its own.

What moves, and which way
  To the website (bridge/{uid}/from/anki): every task from a week back to two weeks ahead, the ticks, the calendar
  with its current dates, today's card plan, the Anatomy Prime day. The Almanac's daily checklist IS this list: the
  website keeps no checklist of its own once one has arrived, so the two can never disagree about what today holds.
  From the website (bridge/{uid}/from/hub): ticks made there, dates moved there (in Study Control), every test result,
  and the whole Study Control store, so an export from either side holds both.

Two writers, one rule
  A tick or a date can change on either side between syncs. Each carries the time it was made, and the newer one wins,
  un-ticking included (an un-tick is a tick with no value). That is the only rule that stays right with two writers and
  no server in between; it is also the one feeds.js uses on the website.
  Each side writes only its own document and reads the other's. Neither can overwrite what the other said.

Credentials
  Pairing stores the website's sign-in token in user_files/bridge.json, on this computer only. It is never written into
  the collection: the collection syncs to AnkiWeb, and the token reads the hub's data. Disconnect deletes the file.
"""
import base64
import csv
import datetime as _dt
import io
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

from .tasks import Calendar, SUBJECTS

VERSION = "3.2"
PAIR_PREFIX = "cthub1."
CREDS_FILE = "bridge.json"
CACHE_FILE = "bridge_cache.json"
DAYS_BACK, DAYS_AHEAD = 7, 14
KEEP_TIMES_DAYS = 45            # the same window Calendar.prune keeps ticks for
CARRY = {"read", "questions", "video", "recall", "cards"}


class BridgeError(Exception):
    """A failure worth showing as it is: the message says what to do."""


def now_iso():
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


# ------------------------------------------------------------------ pairing and credentials
def decode_pairing(code):
    """The code the website's Study Control shows under 'Connect the Anki add-on'."""
    code = "".join((code or "").split())
    if not code.startswith(PAIR_PREFIX):
        raise BridgeError("That is not a pairing code. Copy the whole code from Study Control > The protocol > Anki add-on.")
    raw = code[len(PAIR_PREFIX):]
    try:
        doc = json.loads(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)).decode("utf-8"))
    except Exception:
        raise BridgeError("The pairing code is damaged. Copy it again, all of it.")
    need = ("apiKey", "projectId", "uid", "refreshToken")
    if not isinstance(doc, dict) or any(not doc.get(k) for k in need):
        raise BridgeError("The pairing code is incomplete. Make a new one on the website.")
    return {k: doc[k] for k in need + ("origin",) if doc.get(k)}


def load_creds(folder):
    try:
        with open(os.path.join(folder, CREDS_FILE), encoding="utf-8") as f:
            c = json.load(f)
        return c if c.get("refreshToken") else None
    except Exception:
        return None


def save_creds(folder, creds):
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, CREDS_FILE)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(creds, f)
    try:
        os.chmod(path, 0o600)
    except Exception:
        pass


def clear_creds(folder):
    for name in (CREDS_FILE, CACHE_FILE):
        try:
            os.remove(os.path.join(folder, name))
        except FileNotFoundError:
            pass


def load_cache(folder):
    try:
        with open(os.path.join(folder, CACHE_FILE), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_cache(folder, cache):
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, CACHE_FILE), "w", encoding="utf-8") as f:
        json.dump(cache, f)


# ------------------------------------------------------------------ the network
def _http(method, url, body=None, headers=None, timeout=20):
    """(status, parsed JSON or None). Never raises for an HTTP status; the caller decides what each one means."""
    data = None
    h = dict(headers or {})
    if isinstance(body, dict) and h.get("Content-Type") == "application/x-www-form-urlencoded":
        data = urllib.parse.urlencode(body).encode("utf-8")
    elif body is not None:
        data = json.dumps(body).encode("utf-8")
        h.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            txt = r.read().decode("utf-8")
            return r.status, (json.loads(txt) if txt else None)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8") or "null")
        except Exception:
            return e.code, None
    except urllib.error.URLError as e:
        raise BridgeError("No connection to the website (%s). It will try again on the next sync." % (e.reason,))


class Remote:
    """The two bridge documents in the website's Firestore, read and written as the website's own signed-in user, so
    its security rules apply exactly as they do to the browser."""

    def __init__(self, creds, http=None, clock=None):
        self.creds = dict(creds)
        self.http = http or _http
        self.clock = clock or time.time
        self._token = None
        self._expires = 0
        self.rotated = False

    def _headers(self):
        h = {}
        if self.creds.get("origin"):
            # The browser key may be limited to the website's address; this says which site the call is for.
            h["Referer"] = self.creds["origin"].rstrip("/") + "/"
        return h

    def token(self):
        if self._token and self.clock() < self._expires - 60:
            return self._token
        h = self._headers()
        h["Content-Type"] = "application/x-www-form-urlencoded"
        st, doc = self.http("POST", "https://securetoken.googleapis.com/v1/token?key=" + urllib.parse.quote(self.creds["apiKey"]),
                            {"grant_type": "refresh_token", "refresh_token": self.creds["refreshToken"]}, h)
        if st != 200 or not doc or not doc.get("id_token"):
            msg = ((doc or {}).get("error") or {}).get("message", "") if isinstance(doc, dict) else ""
            raise BridgeError("The website refused the pairing (%s). Make a new pairing code in Study Control and connect again."
                              % (msg or st))
        if doc.get("user_id") and doc["user_id"] != self.creds["uid"]:
            raise BridgeError("The pairing code belongs to a different account.")
        self._token = doc["id_token"]
        self._expires = self.clock() + int(doc.get("expires_in", 3600))
        if doc.get("refresh_token") and doc["refresh_token"] != self.creds["refreshToken"]:
            self.creds["refreshToken"] = doc["refresh_token"]
            self.rotated = True
        return self._token

    def _url(self, side):
        return ("https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/bridge/%s/from/%s"
                % (urllib.parse.quote(self.creds["projectId"]), urllib.parse.quote(self.creds["uid"]), side))

    def _auth(self):
        h = self._headers()
        h["Authorization"] = "Bearer " + self.token()
        return h

    @staticmethod
    def _refused(st, doc):
        if st == 403:
            return BridgeError("The website's database refused the add-on. Publish the 'bridge' rule in the Firebase console "
                               "(the Guide, under the Anki add-on, has the exact text).")
        msg = ((doc or {}).get("error") or {}).get("message", "") if isinstance(doc, dict) else ""
        return BridgeError("The website's database answered %s %s" % (st, msg))

    def get(self, side):
        st, doc = self.http("GET", self._url(side), None, self._auth())
        if st == 404:
            return None
        if st != 200:
            raise self._refused(st, doc)
        try:
            return json.loads(doc["fields"]["json"]["stringValue"])
        except Exception:
            return None

    def put(self, side, payload):
        # One string field rather than Firestore's typed maps: the document is read back whole by both sides, and a
        # string round-trips through JSON without a converter that could drift from the one in the browser.
        body = {"fields": {"at": {"stringValue": payload.get("at", now_iso())},
                           "json": {"stringValue": json.dumps(payload, separators=(",", ":"))}}}
        st, doc = self.http("PATCH", self._url(side), body, self._auth())
        if st != 200:
            raise self._refused(st, doc)
        return True


# ------------------------------------------------------------------ ticks and moves, with the time they were made
def record_tick(state, tid, at=None):
    state.setdefault("check_times", {})[tid] = at or now_iso()


def record_move(state, eid, at=None):
    state.setdefault("event_moved_at", {})[eid] = at or now_iso()


def prune_times(state, today):
    cut = (today - _dt.timedelta(days=KEEP_TIMES_DAYS)).isoformat()
    ct = state.get("check_times", {})
    for k in [k for k in ct if k[:10] < cut]:
        del ct[k]


def apply_inbound(state, plan, hub):
    """Take what the website said. Returns {ticks, moves: [(eid, date)], results}."""
    out = {"ticks": 0, "moves": [], "results": 0}
    if not isinstance(hub, dict):
        return out
    checks = state.setdefault("checks", {})
    times = state.setdefault("check_times", {})
    for tid, x in (hub.get("checks") or {}).items():
        if not isinstance(x, dict) or not x.get("t"):
            continue
        if x["t"] <= times.get(tid, ""):
            continue                        # ours is newer, or the same tick
        v = x.get("v")
        if v in ("done", "skip"):
            changed = checks.get(tid) != v
            checks[tid] = v
        else:
            changed = tid in checks
            checks.pop(tid, None)
        times[tid] = x["t"]
        out["ticks"] += 1 if changed else 0
    cal = Calendar(plan, state)
    moved_at = state.setdefault("event_moved_at", {})
    for eid, x in (hub.get("moves") or {}).items():
        if eid not in cal.events or not isinstance(x, dict) or not x.get("t") or not x.get("date"):
            continue
        if x["t"] <= moved_at.get(eid, ""):
            continue
        try:
            new = _dt.date.fromisoformat(x["date"])
        except Exception:
            continue
        moved_at[eid] = x["t"]
        if cal.date_of(eid) != new:
            cal.set_date(eid, new)          # its card units move with it
            state["baseline"] = None
            out["moves"].append((eid, x["date"]))
    if isinstance(hub.get("results"), list):
        state["hub_results"] = [r for r in hub["results"] if isinstance(r, dict)][-400:]
        state["hub_results_at"] = hub.get("at")
        out["results"] = len(state["hub_results"])
    return out


def build_outbound(plan, state, today, anatomy=None, report=None):
    cal = Calendar(plan, state)
    days = {}
    for i in range(-DAYS_BACK, DAYS_AHEAD + 1):
        dd = today + _dt.timedelta(days=i)
        days[dd.isoformat()] = [{k: t.get(k) for k in ("id", "subject", "kind", "title", "detail", "min", "floor", "event")}
                                for t in cal.tasks(dd)]
    checks = {}
    times = state.get("check_times", {})
    for tid, v in state.get("checks", {}).items():
        checks[tid] = {"v": v, "t": times.get(tid, "")}
    for tid, t in times.items():
        if tid not in checks:
            checks[tid] = {"v": None, "t": t}         # un-ticked here: it has to be able to win too
    moved = state.get("event_moved_at", {})
    events = []
    for eid, e in cal.events.items():
        dt_ = cal.date_of(eid)
        events.append({"id": eid, "subject": e.get("subject"), "kind": e.get("kind"), "label": e.get("label"),
                       "title": e.get("title"), "date": dt_.isoformat() if dt_ else None, "tbc": cal.tbc(eid),
                       "moved_at": moved.get(eid)})
    day = state.get("day") or {}
    run = (report or {}).get("run") or {}
    card = {"date": day.get("date"), "target": day.get("target", {}), "mode": day.get("mode", {}),
            "moved": {k: v for k, v in (run.get("moved") or {}).items()} if run.get("date") == day.get("date") else {}}
    an = None
    if anatomy and anatomy.get("setup"):
        an = {"num": anatomy.get("num"), "title": anatomy.get("title"), "new": anatomy.get("new"),
              "checklist": [[k, l, bool(on)] for k, l, on in anatomy.get("checklist", [])]}
    return {"v": 1, "at": now_iso(), "addon": VERSION, "plan": {"id": plan.get("id"), "version": plan.get("version")},
            "today": today.isoformat(), "hub_start": state.get("hub_start"), "subjects": [list(x) for x in SUBJECTS],
            "days": days, "checks": checks, "events": events, "card": card,
            "leftovers": [t["id"] for t in cal.leftovers(today)], "anatomy": an}


# ------------------------------------------------------------------ export
def all_tasks(plan, state, today):
    """Every task from the first day the hub was used to today, with what became of it."""
    cal = Calendar(plan, state)
    start = state.get("hub_start") or state.get("first_run") or today.isoformat()
    try:
        d0 = _dt.date.fromisoformat(start)
    except Exception:
        d0 = today
    d0 = max(d0, today - _dt.timedelta(days=KEEP_TIMES_DAYS))   # older ticks are pruned, so older days would read as undone
    out = []
    dd = d0
    while dd <= today:
        for t in cal.tasks(dd):
            out.append(dict(t, status=cal.status(t["id"]) or ""))
        dd += _dt.timedelta(days=1)
    return out


def export_bundle(plan, state, today, cfg, cache):
    return {"exported": now_iso(), "what": "Year 2 Hub study data: the add-on's state and tasks, and the website's "
                                          "results and Study Control as last synced",
            "addon": {"version": VERSION, "plan_id": plan.get("id"), "plan_version": plan.get("version"),
                      "config": cfg, "state": state, "tasks": all_tasks(plan, state, today),
                      "calendar": build_outbound(plan, state, today)["events"]},
            "website": {"synced_at": (cache or {}).get("at"), "results": state.get("hub_results", []),
                        "ticks": (cache or {}).get("checks", {}), "moves": (cache or {}).get("moves", {}),
                        "study_control": (cache or {}).get("studyControl")}}


def _csv(rows, cols):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(cols)
    for r in rows:
        w.writerow(["" if r.get(c) is None else r.get(c) for c in cols])
    return buf.getvalue()


def results_csv(results):
    rows = []
    for r in results:
        pct = round(100.0 * r["score"] / r["max"], 1) if r.get("max") else None
        rows.append(dict(r, percent=pct, causes=";".join(r.get("causes") or [])))
    return _csv(sorted(rows, key=lambda r: (r.get("date") or "", r.get("createdAt") or "")),
                ["date", "subject", "kind", "title", "score", "max", "percent", "estimate", "causes", "errorCards", "id"])


def tasks_csv(tasks):
    return _csv(tasks, ["date", "subject", "kind", "title", "min", "floor", "status", "detail", "id"])


def write_export(folder, bundle, today):
    stem = "year2-study-data-%s" % today.isoformat()
    paths = []
    for name, text in ((stem + ".json", json.dumps(bundle, indent=1, default=str)),
                       (stem + "-results.csv", results_csv(bundle["website"]["results"])),
                       (stem + "-tasks.csv", tasks_csv(bundle["addon"]["tasks"]))):
        p = os.path.join(folder, name)
        with open(p, "w", encoding="utf-8", newline="") as f:
            f.write(text)
        paths.append(p)
    return paths
