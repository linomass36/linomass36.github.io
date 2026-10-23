"""Year 2 Hub: the daily tasks of every subject, made from the calendar in plan.json (graded events and Step weeks)
and the weekly cycles of the Year 2 Study Protocol (Direction C). No Qt here.

A task: {id, date, subject, kind, title, detail, min, event, floor}
  kind: read, questions, video, test, recall, cards, lab, group, admin, note
  floor: part of the subject's weekly Floor (never cut)
Ticks live in the collection config with the rest of the state (state["checks"][task id] = "done" or "skip").
"""
import datetime as _dt

SUBJECTS = [("anatomy", "Anatomy"), ("physio", "Physiology"), ("histo", "Histology"), ("embryo", "Embryology"),
            ("step", "USMLE Step 1")]
NAME = dict(SUBJECTS)
CARRY_KINDS = {"read", "questions", "video", "recall", "cards"}


def d(s):
    return _dt.date.fromisoformat(s) if isinstance(s, str) else s


def iso(x):
    return x.isoformat() if x else None


def split_pages(pages):
    """Two halves of a page list [(chapter, first, last)], by page count."""
    total = sum(b - a + 1 for c, a, b in pages)
    target, run, first, second = total / 2.0, 0, [], []
    for c, a, b in pages:
        n = b - a + 1
        if run >= target:
            second.append((c, a, b))
        elif run + n <= target:
            first.append((c, a, b))
        else:
            cut = a + int(round(target - run)) - 1
            if cut >= a:
                first.append((c, a, cut))
            if cut < b:
                second.append((c, cut + 1, b))
        run += n
    return first, second


def ptxt(pages):
    return "; ".join("Ch %s, pp. %d-%d" % (c, a, b) for c, a, b in pages)


def npages(pages):
    return sum(b - a + 1 for c, a, b in pages)


class Calendar:
    def __init__(self, plan, state):
        cal = plan.get("calendar", {})
        self.events = {e["id"]: e for e in cal.get("events", [])}
        self.weeks = cal.get("weeks", [])
        self.uworld_start = d(cal.get("uworld_start", "2026-11-02"))
        self.state = state
        self._by_date = None

    def date_of(self, eid):
        o = self.state.get("event_dates", {}).get(eid)
        e = self.events[eid]
        v = o if o else e.get("date")
        return d(v) if v else None

    def tbc(self, eid):
        return bool(self.events[eid].get("tbc")) and eid not in self.state.get("event_dates", {})

    def set_date(self, eid, day):
        """Move an event; its linked card units move with it."""
        self.state.setdefault("event_dates", {})[eid] = iso(day)
        for uid, rel_off, due_off in self.events[eid].get("links", []):
            o = self.state.setdefault("overrides", {}).setdefault(uid, {})
            o["release"] = iso(day + _dt.timedelta(days=rel_off))
            o["due"] = iso(day + _dt.timedelta(days=due_off))
        self._by_date = None
        self.__dict__.pop("_memo", None)

    def dated(self):
        if self._by_date is not None:
            return self._by_date
        out = []
        for eid, e in self.events.items():
            dt_ = self.date_of(eid)
            if dt_:
                out.append((dt_, eid))
        out.sort()
        self._by_date = out
        return out

    def week_of(self, day):
        best = None
        for w in self.weeks:
            if d(w["monday"]) <= day:
                best = w
        return best

    def crunch(self, day):
        w = self.week_of(day)
        return bool(w) and w["mode"] in ("Crunch",)

    def next_events(self, subject, day, n=3, kinds=None):
        out = []
        for dt_, eid in self.dated():
            e = self.events[eid]
            if dt_ >= day and (e["subject"] == subject or (subject == "any")) and (kinds is None or e["kind"] in kinds):
                out.append((dt_, eid))
            if len(out) >= n:
                break
        return out

    # ------------------------------------------------------------ tasks
    def tasks(self, day):
        day = d(day)
        memo = self.__dict__.setdefault("_memo", {})
        if day in memo:
            return [dict(t) for t in memo[day]]
        out = self._make_tasks(day)
        memo[day] = out
        return [dict(t) for t in out]

    def _make_tasks(self, day):
        out = []

        def T(subject, key, kind, title, detail="", minutes=0, event=None, floor=False):
            out.append({"id": "%s|%s|%s" % (day.isoformat(), subject, key), "date": day.isoformat(), "subject": subject,
                        "kind": kind, "title": title, "detail": detail, "min": minutes, "event": event, "floor": floor})

        for dt_, eid in self.dated():
            off = (dt_ - day).days
            if off < -4 or off > 21:
                continue
            e = self.events[eid]
            s, k = e["subject"], e["kind"]
            if s == "physio" and k == "test":
                self._physio(T, e, eid, off, dt_)
            elif s == "histo":
                self._histo(T, e, eid, off, dt_)
            elif s == "embryo":
                self._embryo(T, e, eid, off, dt_)
            elif s == "anatomy":
                if off == 0:
                    T("anatomy", eid, "test" if k == "partial" else "lab", e["title"], event=eid, floor=True)
                    if k == "lab":
                        T("anatomy", eid + "-miss", "cards", "Within 24 h: card every dissection miss; one clinical "
                          "correlation card per classic lesion (Moore's)", minutes=30, event=eid, floor=True)
                if k == "lab" and off == 5 and day.weekday() == 5:
                    T("anatomy", eid + "-build", "cards", "Build the next lab with Claude: " + e["title"],
                      "The authored cards must be learned by Wednesday", minutes=90, event=eid, floor=True)
            elif s == "step" and k == "stepsat" and off == 0:
                T("step", eid, "test", "Step Saturday: 4 timed mixed blocks on the last four weeks' systems, then the "
                  "top-miss review and a 15-minute retro", minutes=150, event=eid)
            elif s == "step" and k == "milestone" and off == 0:
                T("step", eid, "note", e["label"], "Activate UWorld, count the unused Physiology, Anatomy, Histology and "
                  "Embryology questions (Direction C 8.7)", event=eid)
            if k in ("partial", "exam") and s != "histo":
                self._countdown(T, e, eid, off, dt_)
        self._step(T, day)
        if day.weekday() == 6:
            T("all", "sunday-review", "admin", "Sunday review (30 min, before 21:00)",
              "Anki export to Study control; hours per subject; next 21 days of graded events; one written change at most",
              minutes=30, floor=True)
            T("all", "retest", "questions", "Re-test hour: AI sets from 1 week and 1 month ago, all three subjects, cold",
              "At least 80%: nothing more. Under 70%: the topic goes back into next week", minutes=45, floor=True)
        return out

    def _countdown(self, T, e, eid, off, dt_):
        # one countdown per stacked partial: a second partial of the same subject within 4 days rides on the first
        for odt, oid in self.dated():
            o = self.events[oid]
            if oid != eid and o["subject"] == e["subject"] and o["kind"] in ("partial", "exam") and 0 < (dt_ - odt).days <= 4:
                return
        if off == 21:
            T(e["subject"], eid + "-t21", "admin", "In 21 days: " + e["label"],
              "List every graded event that week in all subjects and the reading left; Step drops to Floor from T-7", event=eid)
        elif off == 14:
            T(e["subject"], eid + "-t14", "admin", "Boost starts: " + e["label"],
              "Extra hours from the cut order; first reading ends by %s" % (dt_ - _dt.timedelta(days=7)).strftime("%a %d %b"), event=eid)
        elif off == 7:
            T(e["subject"], eid + "-t7", "admin", "No first reading from today: " + e["label"],
              "Mocks and weak spots only; misses carded the same day", event=eid)

    def _physio(self, T, e, eid, off, dt_):
        pages = [tuple(p) for p in e.get("pages", [])]
        title = e["title"]
        if pages:
            p1, p2 = split_pages(pages)
            all_txt = ptxt(pages)
        else:
            p1 = p2 = []
            all_txt = e.get("guyton", "the set Guyton pages")
        if off == 4:
            if not e.get("costanzo", "").startswith("none"):
                T("physio", eid + "-cz", "read", "Costanzo map: " + e["costanzo"], "Read for the map (what controls what), "
                  "no notes, 30-45 min, before Guyton", minutes=40, event=eid)
            T("physio", eid + "-g1", "read", "Guyton set pages, part 1: " + (ptxt(p1) if p1 else all_txt),
              "For Friday's test (%s). After each section, close the book and say the mechanism aloud" % title,
              minutes=max(45, int(npages(p1) * 2.5)) if p1 else 90, event=eid, floor=True)
        elif off == 3:
            T("physio", eid + "-g2", "read", "Guyton set pages, part 2: " + (ptxt(p2) if p2 else all_txt),
              "Then skim the rest of the chapter: headings, figures, every graph", minutes=max(45, int(npages(p2) * 2.5)) if p2 else 60,
              event=eid, floor=True)
            if e.get("optional"):
                T("physio", eid + "-opt", "read", "Not on the entrance test, worth it for Step: " + ptxt([tuple(p) for p in e["optional"]]),
                  minutes=30, event=eid)
        elif off == 2:
            T("physio", eid + "-s1", "questions", "AI course set 1 (15 questions, cold) on " + all_txt,
              "Card every miss and every guess (Misses::Physiology)", minutes=45, event=eid, floor=True)
            when = dt_ - _dt.timedelta(days=2)
            if when >= self.uworld_start:
                T("physio", eid + "-uw", "questions", "UWorld block 1: Physiology, %s (20 Q, timed 30 min)" % e.get("system", ""),
                  "Review every miss and flagged guess (40-60 min). Paste the missed IDs in UWorld misses", minutes=90, event=eid, floor=True)
            else:
                T("physio", eid + "-brs", "questions", "BRS Physiology: 20-30 questions on " + title, minutes=45, event=eid)
        elif off == 1:
            T("physio", eid + "-s2", "questions", "AI set 2: 20 new questions on the misses of set 1 (and the UWorld block)",
              "Re-read only the missed sections", minutes=60, event=eid, floor=True)
        elif off == 0:
            T("physio", eid, "test", "Physiology entrance test 12:45: " + title, event=eid, floor=True)
            T("physio", eid + "-recall", "recall", "Recall page: the mechanism, the curves, the numbers, from memory; log the score",
              minutes=15, event=eid, floor=True)
        elif off == -1:
            T("physio", eid + "-depth", "read", "Depth add-on: " + e.get("depth", ""), minutes=90, event=eid)

    def _histo(self, T, e, eid, off, dt_):
        k = e["kind"]
        if k == "lab":
            if off == 4:
                T("histo", eid + "-wh", "read", "Wheater: " + e["wheater"], "Every image and caption; name the features "
                  "that identify each tissue (for %s)" % e["title"], minutes=60, event=eid, floor=True)
            elif off == 3:
                T("histo", eid + "-jq", "read", "Junqueira: " + e["junqueira"], "Program sections only", minutes=75, event=eid, floor=True)
            elif off == 2:
                T("histo", eid + "-draw", "questions", "Draw each tissue from memory (labelled), then this class's SecondLook sets",
                  minutes=45, event=eid, floor=True)
            elif off == 1:
                T("histo", eid + "-ai", "questions", "Histology AI set (20 Q): 8 recall, 6 tell-apart, 6 Step vignettes; card the misses",
                  minutes=45, event=eid, floor=True)
            elif off == 0:
                T("histo", eid, "lab", "Histology lab + quiz: " + e["title"], "Photograph every slide you name", event=eid, floor=True)
                T("histo", eid + "-after", "cards", "Within 24 h: miss cards and the recall page (how to tell the slides apart)" +
                  ("; disease cards: " + e["diseases"] if e.get("diseases") else ""), minutes=30, event=eid, floor=True)
            elif off == -1:
                T("histo", eid + "-next", "admin", "Confirm the next lab's topic with the group (2 min)", event=eid, floor=True)
        elif k == "partial":
            if 8 <= off <= 21:
                T("histo", eid + "-rot", "questions", "SecondLook rotation: 10 min across every finished lab",
                  "For " + e["label"], minutes=10, event=eid, floor=True)
            if off in (7, 5, 3):
                T("histo", eid + "-mock", "questions", "20-slide timed mock (unlabelled atlas images)",
                  "Each misidentified slide becomes a tell-apart card today", minutes=40, event=eid, floor=True)
            if off == 1:
                T("histo", eid + "-sheet", "recall", "Recall pages of every lab, read as one revision sheet per tissue",
                  minutes=45, event=eid, floor=True)
            if off == 0:
                T("histo", eid, "test", e["label"], event=eid, floor=True)
            if off in (21, 14, 7):
                self._countdown(T, e, eid, off, dt_)
        elif k == "review" and off == 0:
            T("histo", eid, "lab", e["label"], event=eid)

    def _embryo(self, T, e, eid, off, dt_):
        if off == 4:
            b = e.get("bwab", "")
            what = ("Read for the seminar: " + b.strip("()")) if b.startswith("(") else ("Before We Are Born: " + b)
            T("embryo", eid + "-read", "read", what, "For seminar: " + e["title"],
              minutes=60, event=eid, floor=True)
        elif off == 2:
            T("embryo", eid + "-timeline", "recall", "Draw the timeline (week by week) and the key structure at each stage",
              minutes=30, event=eid, floor=True)
        elif off == 1:
            T("embryo", eid + "-ai", "questions", "Embryology AI set (20 Q): timeline and derivatives, failed process to defect, "
              "Step vignettes; card the misses", minutes=45, event=eid, floor=True)
        elif off == 0:
            T("embryo", eid, "lab", "Embryology seminar 13:00: " + e["title"], event=eid, floor=True)
            T("embryo", eid + "-after", "cards", "Malformation cards" + (" (" + e["malformations"] + ")" if e.get("malformations") else "") +
              "; recall page with the timeline from memory", minutes=30, event=eid, floor=True)
        elif off == -3:
            T("embryo", eid + "-brs", "questions", "BRS Embryology: the chapter on this seminar's topic", minutes=30, event=eid)

    def _step(self, T, day):
        w = self.week_of(day)
        if not w:
            return
        mode, wd = w["mode"], day.weekday()
        fa = [tuple(p) for p in w.get("fa", [])]
        fa_txt = lambda ps: ", ".join(("%d" % a) if a == b else ("%d-%d" % (a, b)) for a, b in ps)
        uw = day >= self.uworld_start
        blocks = int(w.get("blocks", 0))
        sysname = w.get("system", "")
        tag = "wk%d" % w["week"]
        if mode == "Rest":
            if wd == 0:
                T("step", tag + "-rest", "note", "Rest week: AnKing reviews (at most 20 minutes), no questions")
            return
        if mode == "Crunch":
            if wd == 0:
                T("step", tag + "-crunch", "note", "Crunch week: Step at Floor (AnKing + 1 block in the subject being tested)",
                  "AnKing new cards are low this week")
            if wd == 2 and blocks:
                T("step", tag + "-b1", "questions", ("UWorld" if uw else "BRS") + ": 1 block in the subject being tested this week",
                  minutes=75, floor=True)
            return
        if mode == "Buffer" and wd == 0:
            T("step", tag + "-buffer", "note", "Buffer week: redo misses, no new material; catch up anything left")
        if fa and mode in ("Build", "Push", "Set-up"):
            half = (len(fa) + 1) // 2
            if wd == 0:
                T("step", tag + "-fa1", "read", "First Aid pp. " + fa_txt(fa[:half]), w.get("label", ""), minutes=45, floor=True)
            if wd == 2 and fa[half:]:
                T("step", tag + "-fa2", "read", "First Aid pp. " + fa_txt(fa[half:]), w.get("label", ""), minutes=45, floor=True)
            if wd == 1 and mode != "Set-up":
                T("step", tag + "-bb", "video", "Boards & Beyond: %s (1.5x, before its questions)" % (w.get("label") or sysname),
                  "Target, not Floor", minutes=60)
        if mode in ("Build", "Buffer"):
            plan_days = {5: "block 2: Anatomy + Histology + Embryology", 6: "block 3 (Target): all four subjects"}
            if blocks >= 2 and wd == 5:
                T("step", tag + "-b2", "questions", "%s %s, %s" % ("UWorld" if uw else "BRS", plan_days[5], sysname),
                  "20 Q timed, then review 40-60 min; star the best miss for the group", minutes=90, floor=True)
            if blocks >= 3 and wd == 6:
                T("step", tag + "-b3", "questions", "%s %s, %s" % ("UWorld" if uw else "BRS", plan_days[6], sysname),
                  minutes=90)
            if not self._physio_week(day) and blocks >= 1 and wd == 2:
                T("step", tag + "-b1", "questions", "%s block 1: Physiology, %s" % ("UWorld" if uw else "BRS", sysname),
                  minutes=90, floor=True)
        elif mode == "Push" and wd < 5 and blocks:
            per = max(1, blocks // 5 + (1 if wd < blocks % 5 else 0))
            if wd < blocks:
                T("step", tag + "-p%d" % wd, "questions", "%s: %d block%s, %s" % ("UWorld" if uw else "BRS", per, "" if per == 1 else "s", sysname),
                  minutes=90 * per)
        if wd == 5 and mode != "Set-up":
            T("step", tag + "-group", "group", "Step group session, 75 min: bring 2 starred misses", minutes=75)
        if wd == 6 and mode != "Set-up":
            T("step", tag + "-numbers", "admin", "Post the Step numbers by 21:00; error log (5 misses, 1 starred)", minutes=15, floor=True)

    def _physio_week(self, day):
        """Is there a physiology test this week (Mon-Sun)? Then block 1 is the physiology task."""
        mon = day - _dt.timedelta(days=day.weekday())
        for dt_, eid in self.dated():
            e = self.events[eid]
            if e["subject"] == "physio" and e["kind"] == "test" and mon <= dt_ <= mon + _dt.timedelta(days=6):
                return dt_ - _dt.timedelta(days=2) >= self.uworld_start
        return False

    # ------------------------------------------------------------ ticks and leftovers
    def status(self, tid):
        return self.state.get("checks", {}).get(tid)

    def tick(self, tid, value="done"):
        ch = self.state.setdefault("checks", {})
        if value is None:
            ch.pop(tid, None)
        else:
            ch[tid] = value

    def leftovers(self, day, back=3):
        """Unticked tasks of the last days that are still worth doing (their event has not passed)."""
        day = d(day)
        out = []
        start = self.state.get("hub_start")
        for i in range(back, 0, -1):
            past = day - _dt.timedelta(days=i)
            if start and past.isoformat() < start:
                continue        # before the hub was in use
            for t in self.tasks(past):
                if t["kind"] not in CARRY_KINDS or self.status(t["id"]):
                    continue
                if t["event"]:
                    ed = self.date_of(t["event"])
                    if ed and ed < day and t["kind"] in ("read", "questions"):
                        continue      # prep for a test that has been sat
                out.append(t)
        return out

    def prune(self, keep_days=45):
        cut = (_dt.date.today() - _dt.timedelta(days=keep_days)).isoformat()
        ch = self.state.get("checks", {})
        for k in [k for k in ch if k[:10] < cut]:
            del ch[k]
