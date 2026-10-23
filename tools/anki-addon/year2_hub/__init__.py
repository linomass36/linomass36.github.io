"""Year 2 Hub: one place for every subject of year 2 (anatomy, physiology, histology, embryology, USMLE Step 1).

The deck screen shows the hub: each subject's tasks of the day, its next graded event and the day's new cards. The hub
window (menu Year 2, or Tools > Year 2 Hub) has Today with a checklist, the Week, each Subject with its calendar and
material, the card plan (AnKing and SecondLook, planned to fit with spare capacity for weak days), UWorld misses, How to
study and Settings. Anatomy cards stay with the Anatomy Prime add-on: the hub shows its day and ticks its checklist.
The state is stored in the collection, so it syncs."""
import datetime
import os

from aqt import gui_hooks, mw
from aqt.qt import QAction, QMenu, QTimer
from aqt.utils import askUser, showInfo, tooltip

from . import anatomy_bridge as AB
from . import core
from . import tasks as T
from . import web as W

ADDON = __name__
HERE = os.path.dirname(os.path.abspath(__file__))
DECK_LABEL = {"anking": "AnKing", "slides": "SecondLook"}


class App:
    def __init__(self):
        self.window = None
        self.last = None
        self.plan = core.load_json(os.path.join(HERE, "plan.json"))
        self._refresh_pending = False
        self._main_pending = False
        self.busy = False
        self._failed = None

    # ------------------------------------------------------------ config and basics
    def cfg_raw(self):
        try:
            return mw.addonManager.getConfig(ADDON) or {}
        except Exception:
            return {}

    def cfg_merged(self):
        c = core.merged_config(self.cfg_raw())
        c.setdefault("show_panel", True)
        return c

    def write_cfg(self, cfg):
        try:
            mw.addonManager.writeConfig(ADDON, cfg)
        except Exception as e:
            print("Year 2 Hub config:", repr(e))

    def set_cfg(self, key, value):
        c = self.cfg_raw()
        c[key] = value
        self.write_cfg(c)
        self.refresh_main()

    def edit_config(self):
        try:
            from aqt.addons import ConfigEditor
            ConfigEditor(self.window or mw, ADDON, self.cfg_raw())
        except Exception:
            showInfo("Open Tools > Add-ons, select Year 2 Hub, then Config.")

    def today(self):
        if os.environ.get("DCP_TODAY"):          # testing only
            return core.d(os.environ["DCP_TODAY"])
        try:
            roll = mw.col.get_preferences().scheduling.rollover
        except Exception:
            roll = 4
        return (datetime.datetime.now() - datetime.timedelta(hours=roll)).date()

    def engine(self):
        return core.Engine(mw.col, self.plan, core.get_state(mw.col), self.today(), self.cfg_raw())

    def refresh_main(self, now=False):
        """Redraw the deck screen; repeated calls within a quarter second draw once."""
        if now:
            self._refresh_main()
        elif not self._main_pending:
            self._main_pending = True
            QTimer.singleShot(250, self._refresh_main)

    def _refresh_main(self):
        self._main_pending = False
        try:
            mw.deckBrowser.refresh() if mw.state == "deckBrowser" else mw.reset()
        except Exception:
            try:
                mw.reset()
            except Exception:
                pass

    def refresh_window(self):
        if self.window is not None and not self._refresh_pending:
            self._refresh_pending = True

            def go():
                self._refresh_pending = False
                try:
                    self.window.refresh()
                except Exception as e:
                    print("Year 2 Hub window:", repr(e))
            QTimer.singleShot(0, go)

    # ------------------------------------------------------------ card plan
    def do(self, fn, quiet=False, done=None, label="Updating the card plan…"):
        """Run fn(engine) on a background thread (Anki stays usable), then store the state and redraw. Ticks made
        meanwhile are kept. Without Anki's task manager (tests) it runs at once and returns the result."""
        if not mw.col:
            return None
        if self.busy:
            if not quiet:
                tooltip("The hub is still updating; try again in a moment.")
            return None
        self.busy = True
        if self.window is not None:
            self.window.busy(True, label)

        def op(col=None):
            eng = self.engine()
            rep = fn(eng)
            return rep, eng.state

        def ok(res):
            self.busy = False
            rep, state = res
            fresh = core.get_state(mw.col)
            for k in ("checks", "hub_start"):          # ticked while the plan ran
                if k in fresh:
                    state[k] = fresh[k]
            core.set_state(mw.col, state)
            if isinstance(rep, dict) and "run" in rep:
                self.last = rep
                self._failed = None
            self.refresh_main()
            self.refresh_window()
            if done:
                done(rep)
            return rep

        def fail(e):
            self.busy = False
            self._failed = self.today()
            print("Year 2 Hub:", repr(e))
            if self.window is not None:
                self.window.busy(False)
            if not quiet:
                showInfo("The Year 2 Hub could not run: %r" % (e,))
            return None

        if getattr(mw, "taskman", None) is not None and not os.environ.get("Y2_SYNC"):
            from aqt.operations import QueryOp
            QueryOp(parent=mw, op=op, success=ok).failure(fail).run_in_background()
            return None
        try:
            res = op()
        except Exception as e:
            return fail(e)
        return ok(res)

    def run(self, quiet=True, force=False):
        if quiet and not self.cfg_merged().get("auto_run", True):
            return None

        def told(rep):
            if not rep:
                return
            r = rep["run"]
            if not quiet:
                tooltip("<b>Year 2 Hub</b><br>" + "<br>".join("%s today: %d new (%s)" % (DECK_LABEL.get(k, k), n, r["mode"].get(k, ""))
                                                              for k, n in r["target"].items()), period=6000)
            elif r.get("rebased") or r.get("missing_decks"):
                msg = ("Deck not found: %s" % ", ".join(r["missing_decks"])) if r.get("missing_decks") else \
                      "The card plan moved: %d unit(s) finish later (Year 2 > Cards)" % len(r["moved"])
                tooltip("<b>Year 2 Hub</b><br>" + msg, period=8000)
        return self.do(lambda e: e.run(force=force), quiet=quiet, done=told)

    def ensure_today(self):
        """Run the card plan once a day, also when Anki stays open overnight; build the report if there is none. Both in
        the background: the window shows what it has and fills in when they finish."""
        if self.busy or not mw.col or self._failed == self.today():
            return
        st = core.get_state(mw.col)
        if (st.get("day") or {}).get("date") != self.today().isoformat():
            self.run(quiet=True)
        elif self.last is None:
            day = st.get("day") or {}
            rec = {"date": self.today().isoformat(), "mode": day.get("mode", {}), "target": day.get("target", {}),
                   "released": 0, "moved": {}, "rebased": False, "missing_decks": []}
            self.do(lambda e: e.report(rec), quiet=True, label="Loading the card plan…")

    def light_day(self, f):
        msg = ("Day off: no new cards today; they are spread over the next days." if f == 0 else
               "Light day: the rest of today's cards are spread over the next days.")
        self.do(lambda e: e.light_day(f), done=lambda rep: tooltip(msg))

    def normal_day(self):
        self.do(lambda e: e.normal_day(), done=lambda rep: tooltip("Back to a normal day."))

    def study_ahead(self):
        self.do(lambda e: e.study_ahead("anking", 10), done=lambda rep: tooltip("Ten more AnKing cards today."))

    def replan(self, ask=True, done=None):
        if ask and not askUser("Make a fresh card plan from today? Finish dates are recalculated and become the new first plan."):
            return
        self.do(lambda e: e.replan(), done=done)

    def skip_unit(self, uid):
        def act(e):
            e.skip(uid, uid not in e.state["skipped"])
            return e.run(force=True)
        self.do(act)

    def qid_release(self, qids, cap, done=None):
        return self.do(lambda e: e.qid_release(qids, cap), done=done, label="Unsuspending…")

    # ------------------------------------------------------------ tasks and calendar
    def calendar(self, state=None):
        return T.Calendar(self.plan, state if state is not None else core.get_state(mw.col))

    def tick(self, tid, value, window=True):
        st = core.get_state(mw.col)
        cal = self.calendar(st)
        cal.tick(tid, value)
        cal.prune()
        core.set_state(mw.col, st)
        self.refresh_main()
        if window:
            self.refresh_window()

    def tick_anatomy(self, key, on):
        AB.tick(self.today(), key, on)
        self.refresh_main()

    def ask_event_date(self, eid):
        from aqt.qt import QInputDialog
        cal = self.calendar()
        e = cal.events[eid]
        cur = cal.date_of(eid)
        txt, ok = QInputDialog.getText(self.window or mw, "Date", "New date (YYYY-MM-DD) for\n%s:" % e["label"],
                                       text=cur.isoformat() if cur else "")
        if not ok:
            return
        try:
            new = datetime.date.fromisoformat(txt.strip())
        except Exception:
            showInfo("Use the form YYYY-MM-DD, for example 2026-11-23.")
            return
        self.set_event_date(eid, new)

    def set_event_date(self, eid, new):
        def act(e):
            T.Calendar(self.plan, e.state).set_date(eid, new)
            e.state["baseline"] = None
            return e.run(force=True)
        self.do(act, done=lambda rep: tooltip("Moved. Its tasks and cards moved with it."), label="Moving the date…")

    def snapshot(self, full=True):
        today = self.today()
        st = core.get_state(mw.col)
        if not st.get("hub_start") and mw.col:
            st["hub_start"] = today.isoformat()
            core.set_state(mw.col, st)
        cal = self.calendar(st)
        tasks = cal.tasks(today)
        for t in tasks:
            t["status"] = cal.status(t["id"])
        week = []
        for i in range(7 if full else 0):
            dd = today + datetime.timedelta(days=i)
            ts = cal.tasks(dd)
            for t in ts:
                t["status"] = cal.status(t["id"])
            week.append((dd, ts))
        nxt = {}
        for key, _ in T.SUBJECTS:
            kinds = ("test", "partial", "lab", "seminar", "exam", "stepsat")
            ev = cal.next_events(key, today, 1, kinds)
            if ev:
                dt_, eid = ev[0]
                nxt[key] = {"date": dt_.isoformat(), "label": cal.events[eid]["label"], "tbc": cal.tbc(eid), "id": eid}
        graded = [(dt_, eid) for dt_, eid in cal.dated() if dt_ >= today and cal.events[eid]["kind"] in ("test", "partial", "exam")]
        next_any = None
        if graded:
            dt_, eid = graded[0]
            next_any = {"date": dt_.isoformat(), "label": cal.events[eid]["label"], "tbc": cal.tbc(eid)}
        if full:
            self.ensure_today()
        report = self.last
        if not full and report is None:
            day = st.get("day") or {}
            if day.get("date") == today.isoformat():
                report = {"run": {"target": day.get("target", {}), "mode": day.get("mode", {})}, "units": []}
        return {"today": today, "cal": cal, "tasks": tasks, "leftovers": cal.leftovers(today), "week": week, "next": nxt,
                "next_any": next_any, "anatomy": AB.summary(today), "report": report,
                "ap_hidden": AB.available() and not AB.its_panel_shown()}

    # ------------------------------------------------------------ browser and decks
    def select_in_browser(self, cids, what, attempt=0):
        """Anki's browser on these cards, one row per card, all selected (like the Anatomy Prime add-on)."""
        cids = sorted({int(c) for c in cids})
        if not cids:
            tooltip("No cards for %s." % what, period=4000)
            return
        import aqt
        q = "cid:" + ",".join(str(c) for c in cids)
        browser = aqt.dialogs.open("Browser", mw)
        done = []

        def alive():
            try:
                from aqt.qt import sip
                if sip.isdeleted(browser):
                    return False
            except Exception:
                pass
            try:
                return aqt.dialogs._dialogs["Browser"][1] is browser and not browser._closeEventHasCleanedUp
            except Exception:
                return True

        def show():
            if done:
                return
            done.append(1)
            if not alive():
                if attempt < 3:
                    QTimer.singleShot(300, lambda: self.select_in_browser(cids, what, attempt + 1))
                return
            try:
                t = browser.table
                switched = False
                try:
                    if t.is_notes_mode():
                        sw = browser._switch
                        sw.blockSignals(True)
                        sw.setChecked(False)
                        sw.blockSignals(False)
                        t.toggle_state(False, q)
                        switched = True
                except Exception as e:
                    print("Year 2 Hub, browser mode:", repr(e))
                try:
                    t.clear_selection()
                except Exception:
                    pass
                browser.search_for(q)
                try:
                    t.select_all()
                except Exception:
                    pass
                note = "%d cards, all selected: %s. Sort by the Due column for the plan's order." % (len(cids), what)
                if switched:
                    note += " The browser now shows cards, not notes."
                tooltip(note, period=8000, parent=browser)
            except Exception as e:
                print("Year 2 Hub, browser:", repr(e))
        try:
            browser.editor.call_after_note_saved(show)
        except Exception:
            show()

    def browse_today(self, key="anking"):
        eng = self.engine()
        if self.last is None:
            self.ensure_today()
        self.select_in_browser(eng.cards_for(key, eng.today), "today's %s plan" % DECK_LABEL.get(key, key))

    def browse_unit(self, uid):
        eng = self.engine()
        u = eng.units[uid]
        ix = eng.idx(u["deck"])
        cids = ix.match(u["tags"])
        if u["deck"] == "anking":
            ct = eng.core_tiers(u)
            cids = [c for c in cids if ix.cards[c][1] in ct]
        self.select_in_browser(cids, u["label"])

    def browse_qids(self, qids):
        if not qids:
            showInfo("No question IDs found in the text.")
            return
        ix = self.engine().idx("anking")
        self.select_in_browser(ix.match([core.UWORLD_ROOT + str(q) for q in qids]), "UWorld questions")

    def study(self, key):
        name = self.cfg_merged()["decks"].get(key) or key
        did = mw.col.decks.id_for_name(name) if mw.col else None
        if not did:
            showInfo("Deck not found: %s" % name)
            return
        mw.col.decks.select(did)
        mw.moveToState("overview")

    def study_misses(self):
        did = mw.col.decks.id_for_name("Misses") if mw.col else None
        if not did:
            showInfo("No Misses deck in this collection.")
            return
        mw.col.decks.select(did)
        mw.moveToState("overview")

    # ------------------------------------------------------------ window and panel
    def open_window(self, tab=None):
        from . import ui
        if not mw.col:
            return
        if self.window is None:
            self.window = ui.HubWindow(self)
        if tab:
            self.window.show_tab(tab)
        self.window.refresh()
        self.window.show()
        self.window.raise_()
        self.window.activateWindow()

    def panel(self):
        if not self.cfg_merged().get("show_panel", True):
            return ""
        s = self.snapshot(full=False)
        today = s["today"]
        by = {}
        for t in s["tasks"]:
            by.setdefault(t["subject"], []).append(t)
        an = s["anatomy"]
        mu = "<span class='mu'>%s</span>"
        rows = []
        for key, label in T.SUBJECTS + [("all", "Every subject")]:
            items = [t for t in by.get(key, []) if t["kind"] != "note"]
            todo = [t for t in items if not t["status"]]
            if key == "all" and not items:
                continue
            if key == "anatomy" and an and an.get("setup"):
                ticks = an.get("checklist", [])
                left = [l for k, l, on in ticks if not on]
                what = "Day %s · %s" % (an.get("num") or "—", W.E(an.get("title") or "no plan day"))
                extra = []
                if an.get("new") is not None:
                    extra.append("%d new cards" % an["new"])
                if ticks:
                    extra.append("%d/%d ticked" % (len(ticks) - len(left), len(ticks)))
                if extra:
                    what += " " + mu % ("· " + " · ".join(extra))
                for t in todo[:1]:
                    what += "<br>%s" % W.E(t["title"])
            elif todo:
                what = W.E(todo[0]["title"]) + ((" " + mu % ("· +%d more" % (len(todo) - 1))) if len(todo) > 1 else "")
            elif items:
                what = "<span class='ok'>&#10003; all %d done</span>" % len(items)
            else:
                what = mu % "Reviews only"
            ev = s["next"].get(key)
            nxt = ""
            if ev:
                nxt = "%s<br>%s%s" % (W.E(ev["label"].split(":")[0]), W.until(ev["date"], today), " · tbc" if ev["tbc"] else "")
            rows.append((key, what, nxt))
        tasks = [t for t in s["tasks"] if t["kind"] != "note"]
        done = sum(1 for t in tasks if t["status"])
        total = len(tasks)
        if an and an.get("setup"):
            total += len(an.get("checklist", []))
            done += sum(1 for k, l, on in an.get("checklist", []) if on)
        mins = sum(t["min"] for t in tasks if not t["status"])
        rep = s["report"]
        bits = []
        if rep:
            r = rep["run"]
            for key, n in r.get("target", {}).items():
                bits.append("%s <b>%d</b> new%s" % (DECK_LABEL.get(key, key), n,
                                                    " · catching up" if r["mode"].get(key) == "catching up" else ""))
        if an and an.get("new") is not None:
            bits.append("Anatomy <b>%d</b> new" % an["new"])
        nx = s.get("next_any")
        if nx:
            bits.append("Next graded: %s, %s" % (W.E(nx["label"].split(" (")[0]), W.until(nx["date"], today)))
        links = [("Open the hub", "y2hub:open"), ("Today's AnKing cards", "y2hub:browse")]
        if an and an.get("setup"):
            links.append(("Anatomy Prime", "y2hub:anatomy"))
        return W.panel(s, bits, rows, done, total, mins, len(s["leftovers"]), links)


def ui_hm(minutes):
    h, m = divmod(int(minutes), 60)
    return ("%d h %02d min" % (h, m)) if h else ("%d min" % m)


APP = App()


# ---------------------------------------------------------------- hooks
def _on_open():
    QTimer.singleShot(1500, lambda: APP.run(quiet=True))


def _on_sync():
    APP.run(quiet=True)


def _on_close():
    if APP.window is not None:
        try:
            APP.window.close()
        except Exception:
            pass
        APP.window = None
    APP.last = None


def _deck_browser(deck_browser, content):
    try:
        if not mw.col:
            return
        st = core.get_state(mw.col)
        if (st.get("day") or {}).get("date") != APP.today().isoformat() and APP.cfg_merged().get("auto_run", True):
            QTimer.singleShot(300, lambda: APP.run(quiet=True))      # a new day while Anki stayed open
        html = APP.panel()
        if html:
            content.stats = html + content.stats
    except Exception as e:
        print("Year 2 Hub panel:", repr(e))


def _on_js(handled, message, context):
    if message == "y2hub:open":
        APP.open_window()
        return (True, None)
    if message.startswith("y2hub:open:"):
        APP.open_window(message.split(":", 2)[2])
        return (True, None)
    if message == "y2hub:browse":
        APP.browse_today("anking")
        return (True, None)
    if message == "y2hub:anatomy":
        AB.open_window()
        return (True, None)
    return handled


action = QAction("Year 2 Hub…", mw)
action.triggered.connect(lambda: APP.open_window())
mw.form.menuTools.addAction(action)

TOP_MENU = QMenu("Year 2", mw)


def _fill_menu():
    m = TOP_MENU
    m.clear()

    def add(label, fn):
        a = m.addAction(label)
        a.triggered.connect(lambda _=False, f=fn: f())
    add("Today", lambda: APP.open_window("Today"))
    add("This week", lambda: APP.open_window("Week"))
    sub = m.addMenu("Subjects")
    for key, label in T.SUBJECTS:
        a = sub.addAction(label)
        a.triggered.connect(lambda _=False, k=key: APP.open_window(k))
    add("Card plan", lambda: APP.open_window("Cards"))
    add("UWorld misses", lambda: APP.open_window("UWorld misses"))
    add("How to study", lambda: APP.open_window("How to study"))
    m.addSeparator()
    add("Today's AnKing cards in the browser", lambda: APP.browse_today("anking"))
    add("Study AnKing", lambda: APP.study("anking"))
    add("Study SecondLook", lambda: APP.study("slides"))
    add("Study the Misses decks", APP.study_misses)
    if AB.available():
        add("Anatomy Prime", AB.open_window)
    m.addSeparator()
    add("Light day", lambda: APP.light_day(None))
    add("Day off", lambda: APP.light_day(0.0))
    add("Run the card plan now", lambda: APP.run(quiet=False))
    add("Settings", lambda: APP.open_window("Settings"))


TOP_MENU.aboutToShow.connect(_fill_menu)
_fill_menu()
try:
    mw.form.menubar.addMenu(TOP_MENU)
except Exception as e:
    print("Year 2 Hub menu:", repr(e))

gui_hooks.profile_did_open.append(_on_open)
gui_hooks.profile_will_close.append(_on_close)
gui_hooks.sync_did_finish.append(_on_sync)
gui_hooks.deck_browser_will_render_content.append(_deck_browser)
gui_hooks.webview_did_receive_js_message.append(_on_js)
mw.addonManager.setConfigAction(ADDON, lambda: APP.open_window("Settings"))
