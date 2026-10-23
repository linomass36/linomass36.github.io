"""Direction C planner v2: a level-loaded, self-correcting schedule. No Qt imports here, so it can be tested on a bare
collection.

How it works
  Units. A plan is a list of units (a Step week, a physiology lab, a histology class, a seminar, a SecondLook chapter
  set), each with a release date, a deck and the tags that select its cards. AnKing cards are split by AnKing's yield
  tags: core tiers (on the schedule) and extra tiers (only on days with room to spare).

  Schedule. Every unseen core card gets a planned day. Days are filled in priority order (course units first, then Step
  weeks, then the October catch-up, then extra cards), never above `reserve` x the day's ceiling. The ceiling is the
  normal pace, a light pace in Crunch weeks, 0 on Rest days and 1.5 x in Push weeks. The unused share of each day (15%)
  is the spare capacity for weak days.

  Baseline. The first schedule is kept as the baseline: each unit's planned finish date.

  Each day (first run of the day)
    1. Re-schedule from today with what is still unseen.
    2. If every unit still finishes on or before its baseline date: on track; today's number is the plan's.
    3. If not: try again using the spare capacity (full ceiling). If that brings every unit back to its baseline date:
       catching up; today's number is higher (never above the ceiling).
    4. If even that cannot: the plan is re-based with spare capacity kept, and the units that move are named with the
       number of days they move. Course units are scheduled first, so the Step weeks absorb the shift.
    5. Anki's new-card limit for today is set to the day's number (today only), and the cards planned for today and the
       next `buffer_days` days are unsuspended (so a phone session or a good day can go ahead).
    6. New cards are ordered by plan day: UWorld-miss cards first, then the schedule.
  A light day or a day off can be declared; the shortfall is absorbed the same way. Missed days need no special case:
  whatever is unseen is simply re-scheduled.
State lives in the collection config (key dcp_state), so it syncs with the collection.
"""
import datetime as _dt
import json
import math

STATE_KEY = "dcp_state"
TIERS = {"1-highyield": 1, "2-relativelyhighyield": 2, "3-highyield-temporary": 3, "4-loweryield": 4, "5-lowyield": 5}
YIELD_ROOT = "#ak_step1_v12::#low/highyield::"
UWORLD_ROOT = "#ak_step1_v12::#uworld::step::"
KEYS = ("anking", "slides")

DEFAULTS = {
    "auto_run": True,
    "decks": {"anking": "AnKing Step Deck", "slides": "SecondLook Histology"},
    "ceiling": {"anking": 25, "slides": 10},
    "crunch_ceiling": {"anking": 10, "slides": 10},
    "reserve": 0.85,
    "buffer_days": 2,
    "light_day_factor": 0.5,
    "core_tiers": {"physio": [0, 1], "default": [0, 1]},
    "extra_tiers": [2, 3],
    "extra": True,
    "course_tracks": ["physio", "histo", "embryo", "slides"],
    "confirm_tracks": [],
    "apply_limits": True,
    "set_queue_order": True,
    "qid_cap_per_question": 5,
    "horizon": "2027-07-31",
    "tolerance_days": 2,
}


def d(s):
    return _dt.date.fromisoformat(s) if isinstance(s, str) else s


def iso(x):
    return x.isoformat() if x else None


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def default_state():
    return {"version": 2, "first_run": None, "baseline": None, "day": None, "confirmed": [], "skipped": [],
            "overrides": {}, "day_factor": {}, "ahead": {}, "qid_runs": [], "log": [], "released": []}


def get_state(col):
    st = col.get_config(STATE_KEY, None) or {}
    if st and st.get("version") != 2:
        old = st
        st = {k: old[k] for k in ("confirmed", "skipped", "overrides", "qid_runs", "first_run") if k in old}
        st["version"] = 2
    base = default_state()
    base.update(st)
    return base


def set_state(col, st):
    st["log"] = st.get("log", [])[-120:]
    st["qid_runs"] = st.get("qid_runs", [])[-200:]
    st["released"] = st.get("released", [])[-60:]
    keep = (_dt.date.today() - _dt.timedelta(days=60)).isoformat()
    st["ahead"] = {k: v for k, v in st.get("ahead", {}).items() if k >= keep}
    col.set_config(STATE_KEY, st)


def merged_config(cfg):
    out = json.loads(json.dumps(DEFAULTS))
    for k, v in (cfg or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k].update(v)
        else:
            out[k] = v
    return out


class DeckIndex:
    """One pass over a deck's cards: tag ancestors per note, yield tier, type, queue, position."""

    def __init__(self, col, deck_name):
        self.name = deck_name
        self.did = col.decks.id_for_name(deck_name) if deck_name else None
        self.cards = {}       # cid -> [nid, tier, type, queue, due]
        self.note_anc = {}
        if not self.did:
            return
        ids = ",".join(str(i) for i in col.decks.deck_and_child_ids(self.did))
        rows = col.db.all("select c.id, c.nid, c.type, c.queue, c.due, n.tags from cards c "
                          "join notes n on n.id = c.nid where c.did in (%s)" % ids)
        for cid, nid, typ, queue, due, tags in rows:
            if nid not in self.note_anc:
                anc = set()
                for t in tags.lower().split():
                    p = t.split("::")
                    for i in range(1, len(p) + 1):
                        anc.add("::".join(p[:i]))
                self.note_anc[nid] = anc
            anc = self.note_anc[nid]
            tier = 0
            for k, v in TIERS.items():
                if YIELD_ROOT + k in anc:
                    tier = v
                    break
            self.cards[cid] = [nid, tier, typ, queue, due]

    @property
    def exists(self):
        return bool(self.did)

    def _build_inverted(self):
        self.by_tag = {}
        self.note_cards = {}
        for cid, c in self.cards.items():
            self.note_cards.setdefault(c[0], []).append(cid)
        for nid, anc in self.note_anc.items():
            for t in anc:
                self.by_tag.setdefault(t, []).append(nid)
        self._cache = {}

    def match(self, tags):
        """Cards with any of the tags (or a child tag), in the order of the tag list, then by note and card."""
        if not hasattr(self, "by_tag"):
            self._build_inverted()
        key = tuple(tags)
        if key in self._cache:
            return list(self._cache[key])
        first = {}
        for i, t in enumerate(tags):
            for nid in self.by_tag.get(t.lower(), ()):
                if nid not in first:
                    first[nid] = i
        out = []
        for nid in sorted(first, key=lambda n: (first[n], n)):
            out += sorted(self.note_cards.get(nid, []))
        self._cache[key] = out
        return list(out)

    def is_new(self, cid):
        c = self.cards.get(cid)
        return bool(c) and c[2] == 0

    def is_live_new(self, cid):
        c = self.cards.get(cid)
        return bool(c) and c[2] == 0 and c[3] == 0

    def is_suspended_new(self, cid):
        c = self.cards.get(cid)
        return bool(c) and c[2] == 0 and c[3] == -1

    def live_new(self):
        return [cid for cid, c in self.cards.items() if c[2] == 0 and c[3] == 0]


class Engine:
    def __init__(self, col, plan, state, today, cfg=None):
        self.col = col
        self.plan = plan
        self.state = state
        self.today = d(today)
        self.cfg = merged_config(cfg)
        self.units = {u["id"]: u for u in plan["units"]}
        self.order = [u["id"] for u in plan["units"]]
        self._idx = {}
        self._jobs = None
        self._last_plans = None
        if not self.state.get("first_run"):
            self.state["first_run"] = self.today.isoformat()
        self.first = d(self.state["first_run"])

    # ------------------------------------------------------------ basics
    def deck_name(self, key):
        return self.cfg["decks"].get(key) or self.plan.get("decks", {}).get(key)

    def idx(self, key):
        if key not in self._idx:
            self._idx[key] = DeckIndex(self.col, self.deck_name(key))
        return self._idx[key]

    def dates(self, uid):
        u = self.units[uid]
        o = self.state["overrides"].get(uid, {})
        rel = o.get("release", u.get("release"))
        due = o.get("due", u.get("due"))
        return (d(rel) if rel else None), (d(due) if due else None)

    def core_tiers(self, u):
        ct = self.cfg["core_tiers"]
        return set(ct.get(u["track"], ct["default"]))

    def legacy(self, uid):
        u = self.units[uid]
        rel, due = self.dates(uid)
        return u["deck"] == "anking" and due is not None and due < self.first

    def priority(self, uid):
        if self.legacy(uid):
            return 2
        return 0 if self.units[uid]["track"] in self.cfg["course_tracks"] else 1

    def gated(self, uid):
        u = self.units[uid]
        return u["track"] in self.cfg["confirm_tracks"] and uid not in self.state["confirmed"]

    def limit_entry(self, key, day):
        lim = None
        for L in self.plan.get("limits", []):
            if L["deck"] == key and L["start"] <= day.isoformat() <= L["end"]:
                lim = L
        return lim

    def day_kind(self, key, day):
        L = self.limit_entry(key, day)
        if L is None:
            return "normal"
        why = L.get("why", "")
        if "factor" in L:
            return "push"
        if "Rest" in why or "Finals" in why:
            return "rest"
        if "Crunch" in why:
            return "crunch"
        return "special"

    def ceiling(self, key, day):
        """The most new cards a day can hold in a deck."""
        base = int(self.cfg["ceiling"][key])
        L = self.limit_entry(key, day)
        kind = self.day_kind(key, day)
        if kind == "push":
            base = int(round(base * float(L["factor"])))
        elif kind == "rest":
            base = 0
        elif kind == "crunch":
            base = int(self.cfg["crunch_ceiling"][key])
        elif kind == "special":
            base = int(L.get("limit", base))
        f = self.state["day_factor"].get(day.isoformat())
        if f is not None:
            base = int(math.floor(base * float(f)))
        return base

    # ------------------------------------------------------------ jobs: which unseen cards belong to which unit
    def jobs(self):
        """Ordered (priority, release, uid, kind, [cids]); every unseen card is owned by one unit."""
        if self._jobs is not None:
            return self._jobs
        horizon = d(self.cfg["horizon"])
        out, owned = [], {k: set() for k in KEYS}
        uids = []
        for uid in self.order:
            rel, due = self.dates(uid)
            if rel is None or rel > horizon or uid in self.state["skipped"]:
                continue
            if not self.idx(self.units[uid]["deck"]).exists:
                continue
            uids.append((self.priority(uid), rel, self.order.index(uid), uid))
        uids.sort()
        for pri, rel, _, uid in uids:
            u = self.units[uid]
            ix = self.idx(u["deck"])
            matched = ix.match(u["tags"])
            if u["deck"] == "slides":
                core = [c for c in matched if ix.is_new(c) and c not in owned["slides"]]
                extra = []
            else:
                ct = self.core_tiers(u)
                et = set(self.cfg["extra_tiers"]) if self.cfg["extra"] else set()
                core = [c for c in matched if ix.cards[c][1] in ct and ix.is_new(c) and c not in owned["anking"]]
                extra = [c for c in matched if ix.cards[c][1] in et and ix.is_new(c) and c not in owned["anking"]]
            owned[u["deck"]] |= set(core) | set(extra)
            out.append((pri, rel, uid, "core", core))
            if extra:
                out.append((3, rel, uid, "extra", extra))
        out.sort(key=lambda j: (j[0], j[1], self.order.index(j[2])))
        self._jobs = out
        return out

    # ------------------------------------------------------------ the scheduler
    def schedule(self, key, reserve, done_today=0):
        """Level-load the unseen cards of a deck from today.
        Returns (planned day per card, finish day per unit (None = cannot finish), cards per day)."""
        jobs = [j for j in self.jobs() if self.units[j[2]]["deck"] == key and j[4]]
        horizon = d(self.cfg["horizon"])
        stop = horizon + _dt.timedelta(days=400)
        day_of, finish, per_day = {}, {}, {}
        pending = [[j[0], max(j[1], self.today), j[2], j[3], list(j[4])] for j in jobs]
        day = self.today
        while pending and day <= stop:
            c = int(math.floor(self.ceiling(key, day) * reserve))
            if day == self.today:
                c = max(0, c - done_today)
            used = 0
            notes_today = set()
            ix = self.idx(key)
            for p in pending:
                if used >= c:
                    break
                if p[1] > day or not p[4]:
                    continue
                take, keep = [], []
                for cid in p[4]:
                    if len(take) >= c - used:
                        keep.append(cid)
                        continue
                    nid = ix.cards[cid][0]
                    if nid in notes_today:          # Anki buries siblings: one card of a note a day
                        keep.append(cid)
                    else:
                        notes_today.add(nid)
                        take.append(cid)
                p[4] = keep
                for cid in take:
                    day_of[cid] = day
                used += len(take)
                if not p[4] and p[3] == "core":
                    finish[p[2]] = day
            if used:
                per_day[day] = used
            pending = [p for p in pending if p[4] and not (p[3] == "extra" and day >= horizon)]
            day += _dt.timedelta(days=1)
        for j in jobs:
            if j[3] == "core" and j[2] not in finish:
                finish[j[2]] = None
        return day_of, finish, per_day

    def drift(self, finish):
        """Units finishing later than in the baseline: {uid: days later}."""
        base = (self.state.get("baseline") or {}).get("finish", {})
        out = {}
        for uid, f in finish.items():
            b = base.get(uid)
            if b is None:
                continue
            if f is None:
                out[uid] = 999
            elif f > d(b):
                out[uid] = (f - d(b)).days
        return out

    def learned_today(self, key):
        """Cards planned this morning that are no longer new (learned today)."""
        day = self.state.get("day") or {}
        if day.get("date") != self.today.isoformat():
            return 0
        start = day.get("planned", {}).get(key, [])
        ix = self.idx(key)
        return sum(1 for c in start if c in ix.cards and not ix.is_new(c))

    # ------------------------------------------------------------ the daily run
    def run(self, apply=True, force=False):
        st, today = self.state, self.today
        rec = {"date": today.isoformat(), "mode": {}, "target": {}, "released": 0, "moved": {}, "rebased": False,
               "missing_decks": [self.deck_name(k) for k in KEYS if not self.idx(k).exists]}
        if not apply:
            return self.report(rec)
        if self.cfg["set_queue_order"]:
            self.ensure_queue_order()

        day = st.get("day") or {}
        new_day = day.get("date") != today.isoformat()
        plans = {}
        for key in KEYS:
            if not self.idx(key).exists:
                continue
            done = 0 if new_day else self.learned_today(key)
            day_of, finish, per_day = self.schedule(key, float(self.cfg["reserve"]), done)
            mode = "on track"
            base = st.get("baseline")
            if base is None or key not in base.get("decks", []):
                self.set_baseline(key, finish)
                mode = "new plan"
            elif self.drift(finish):
                day_of2, finish2, per_day2 = self.schedule(key, 1.0, done)
                tol = int(self.cfg["tolerance_days"])
                late2 = {u: n for u, n in self.drift(finish2).items() if n > tol}
                if not late2:
                    day_of, finish, per_day = day_of2, finish2, per_day2
                    mode = "catching up"
                else:
                    rec["moved"].update(self.drift(finish))
                    self.set_baseline(key, finish)
                    rec["rebased"] = True
                    mode = "plan moved"
            plans[key] = (day_of, finish, per_day)
            if new_day or force:
                rec["target"][key] = per_day.get(today, 0) + done
            else:
                rec["target"][key] = int(day.get("target", {}).get(key, per_day.get(today, 0) + done))
            rec["mode"][key] = mode if (new_day or force) else day.get("mode", {}).get(key, mode)

        if new_day or force:
            keep_planned = day.get("planned", {}) if (not new_day) else {}
            st["day"] = {"date": today.isoformat(), "target": dict(rec["target"]), "mode": dict(rec["mode"]),
                         "planned": {k: sorted(set(keep_planned.get(k, [])) |
                                               {c for c, dd in plans[k][0].items() if dd == today}) for k in plans}}

        ahead = st.get("ahead", {}).get(today.isoformat(), {}) or {}
        for key, (day_of, finish, per_day) in plans.items():
            ix = self.idx(key)
            target = rec["target"][key] + int(ahead.get(key, 0)) + (int(ahead.get("anking_qid", 0)) if key == "anking" else 0)
            rec["target"][key] = target
            if self.cfg["apply_limits"]:
                self.set_limit_today(ix.did, target)
            last = today + _dt.timedelta(days=int(self.cfg["buffer_days"]))
            want = [c for c, dd in day_of.items() if dd <= last]
            if ahead.get(key):
                later = sorted((dd, c) for c, dd in day_of.items() if dd > last)
                want += [c for _, c in later[:int(ahead[key])]]
            if self.cfg["confirm_tracks"]:
                owner = {c: j[2] for j in self.jobs() for c in j[4]}
                want = [c for c in want if not (owner.get(c) and self.gated(owner[c]))]
            rec["released"] += self._unsuspend(key, [c for c in want if ix.is_suspended_new(c)])
            self.reposition(key, day_of)
        st["released"].append({"date": today.isoformat(), "n": rec["released"]})
        if new_day or force or rec["rebased"]:
            st["log"].append(dict(rec))
        self._last_plans = plans
        return self.report(rec)

    def set_baseline(self, key, finish):
        b = self.state.get("baseline") or {"made": self.today.isoformat(), "finish": {}, "decks": []}
        for uid, f in finish.items():
            if self.units[uid]["deck"] == key:
                b["finish"][uid] = iso(f)
        if key not in b["decks"]:
            b["decks"].append(key)
        b["made"] = self.today.isoformat()
        self.state["baseline"] = b

    def _unsuspend(self, key, cids):
        if cids:
            self.col.sched.unsuspend_cards(cids)
            ix = self.idx(key)
            for c in cids:
                ix.cards[c][3] = 0
        return len(cids)

    def set_limit_today(self, did, limit):
        deck = self.col.decks.get(did)
        deck["newLimitToday"] = {"limit": int(limit), "today": self.col.sched.today}
        self.col.decks.save(deck)

    def ensure_queue_order(self):
        for key in KEYS:
            ix = self.idx(key)
            if not ix.exists:
                continue
            conf = self.col.decks.config_dict_for_deck_id(ix.did)
            if conf.get("id") == 1:
                continue
            want = int(self.cfg["ceiling"][key])
            if conf.get("newGatherPriority") != 1 or conf.get("newSortOrder") != 1 or conf["new"].get("perDay") != want:
                conf["newGatherPriority"] = 1
                conf["newSortOrder"] = 1
                conf["new"]["perDay"] = want     # a phone day: at most the ceiling, from the released buffer
                self.col.decks.update_config(conf)

    def reposition(self, key, day_of):
        ix = self.idx(key)
        live = set(ix.live_new())
        order, seen = [], set()
        if key == "anking":
            for r in reversed(self.state.get("qid_runs", [])):
                for c in r.get("cids", []):
                    if c in live and c not in seen:
                        order.append(c)
                        seen.add(c)
        rank = {}
        for i, (pri, rel, uid, kind, cids) in enumerate(self.jobs()):
            for j, c in enumerate(cids):
                rank[c] = (i, j)
        planned = sorted((c for c in live if c in day_of and c not in seen),
                         key=lambda c: (day_of[c], rank.get(c, (1e9, 0))))
        order += planned
        seen |= set(planned)
        order += sorted((c for c in live if c not in seen), key=lambda c: (ix.cards[c][4], c))
        if not order or all(ix.cards[c][4] == i + 1 for i, c in enumerate(order)):
            return 0
        self.col.sched.reposition_new_cards(card_ids=order, starting_from=1, step_size=1, randomize=False,
                                            shift_existing=False)
        for i, c in enumerate(order):
            ix.cards[c][4] = i + 1
        return len(order)

    def cards_for(self, key, day):
        """Card ids planned for a day (today: the morning's plan plus anything studied ahead or added)."""
        day = d(day)
        if not self.idx(key).exists:
            return []
        if self._last_plans and key in self._last_plans:
            day_of = self._last_plans[key][0]
        else:
            day_of = self.schedule(key, float(self.cfg["reserve"]))[0]
        out = [c for c, dd in day_of.items() if dd == day]
        if day == self.today:
            st = self.state.get("day") or {}
            if st.get("date") == day.isoformat():
                out = sorted(set(out) | set(st.get("planned", {}).get(key, [])))
            if key == "anking":
                for r in self.state.get("qid_runs", []):
                    if r.get("on") == day.isoformat():
                        out = sorted(set(out) | set(r.get("cids", [])))
        return out

    # ------------------------------------------------------------ manual actions
    def light_day(self, factor=None):
        """Declare today light (default half) or off (0); the shortfall goes into the spare capacity."""
        f = self.cfg["light_day_factor"] if factor is None else factor
        self.state["day_factor"][self.today.isoformat()] = f
        return self.run(force=True)

    def normal_day(self):
        self.state["day_factor"].pop(self.today.isoformat(), None)
        return self.run(force=True)

    def study_ahead(self, key, n):
        a = self.state.setdefault("ahead", {}).setdefault(self.today.isoformat(), {})
        a[key] = int(a.get(key, 0)) + int(n)
        return self.run()

    def confirm(self, uids):
        for uid in uids:
            if uid not in self.state["confirmed"]:
                self.state["confirmed"].append(uid)

    def skip(self, uid, on=True):
        if on and uid not in self.state["skipped"]:
            self.state["skipped"].append(uid)
        if not on and uid in self.state["skipped"]:
            self.state["skipped"].remove(uid)
        self.state["baseline"] = None

    def set_dates(self, uid, release=None, due=None):
        o = self.state["overrides"].setdefault(uid, {})
        if release is not None:
            o["release"] = release
        if due is not None:
            o["due"] = due
        self.state["baseline"] = None

    def replan(self):
        """A fresh baseline from today (after a change of pace or dates)."""
        self.state["baseline"] = None
        return self.run(force=True)

    def qid_release(self, qids, cap=None):
        cap = self.cfg["qid_cap_per_question"] if cap is None else cap
        ix = self.idx("anking")
        res = {"questions": len(qids), "found": 0, "already_live": 0, "learned": 0, "released": 0, "no_cards": []}
        chosen = []
        for q in qids:
            cids = sorted(ix.match([UWORLD_ROOT + str(q)]), key=lambda c: (ix.cards[c][0], c))
            if not cids:
                res["no_cards"].append(q)
                continue
            res["found"] += len(cids)
            res["learned"] += sum(1 for c in cids if not ix.is_new(c))
            res["already_live"] += sum(1 for c in cids if ix.is_live_new(c))
            sus = [c for c in cids if ix.is_suspended_new(c)]
            chosen += sus[:cap] if cap else sus
        res["released"] = self._unsuspend("anking", chosen)
        self.state.setdefault("qid_runs", []).append({"on": self.today.isoformat(), "qids": list(qids), "cids": chosen})
        # misses come on top of today's plan
        a = self.state.setdefault("ahead", {}).setdefault(self.today.isoformat(), {})
        a["anking_qid"] = int(a.get("anking_qid", 0)) + len(chosen)
        if ix.exists:
            day_of = self.schedule("anking", float(self.cfg["reserve"]), self.learned_today("anking"))[0]
            self.reposition("anking", day_of)
            if self.cfg["apply_limits"]:
                t = (self.state.get("day") or {}).get("target", {}).get("anking", 0)
                self.set_limit_today(ix.did, t + int(a.get("anking", 0)) + a["anking_qid"])
        return res

    # ------------------------------------------------------------ reporting
    def report(self, rec):
        finish = {}
        if self._last_plans:
            for k in self._last_plans:
                finish.update(self._last_plans[k][1])
        else:
            for key in KEYS:
                if self.idx(key).exists:
                    finish.update(self.schedule(key, float(self.cfg["reserve"]))[1])
        base = (self.state.get("baseline") or {}).get("finish", {})
        owned = {}
        for pri, rel_, uid_, kind, cids_ in self.jobs():
            if kind == "core":
                owned[uid_] = owned.get(uid_, 0) + len(cids_)
        rows = []
        for uid in self.order:
            u = self.units[uid]
            rel, due = self.dates(uid)
            ix = self.idx(u["deck"])
            cids = ix.match(u["tags"]) if ix.exists else []
            if u["deck"] == "anking":
                ct = self.core_tiers(u)
                cids = [c for c in cids if ix.cards[c][1] in ct]
            seen = sum(1 for c in cids if not ix.is_new(c))
            if uid in self.state["skipped"]:
                status = "skipped"
            elif rel is None:
                status = "undated"
            elif self.gated(uid) and rel <= self.today:
                status = "awaiting"
            elif owned.get(uid, 0) > 0:
                if uid in finish and finish[uid] is None:
                    status = "beyond plan"
                elif rel > self.today:
                    status = "upcoming"
                else:
                    status = "in progress"
            elif not cids:
                status = "nothing new"
            elif seen >= len(cids):
                status = "done"
            else:
                status = "shared"        # its unseen cards are planned with other units
            rows.append(dict(id=uid, track=u["track"], label=u["label"], release=iso(rel), due=iso(due),
                             finish=iso(finish.get(uid)), baseline=base.get(uid), status=status,
                             tbc=u.get("tbc", False) and uid not in self.state["overrides"],
                             total=len(cids), seen=seen, note=u.get("note", "")))
        backlog = {}
        for key in KEYS:
            ix = self.idx(key)
            if ix.exists:
                backlog[self.deck_name(key)] = len(ix.live_new())
        upcoming = {}
        if self._last_plans:
            for key, (day_of, finish_k, per_day) in self._last_plans.items():
                upcoming[key] = [(iso(dd), n) for dd, n in sorted(per_day.items())[:14]]
        return {"run": rec, "units": rows, "backlog": backlog, "today": self.today.isoformat(), "next_days": upcoming}
