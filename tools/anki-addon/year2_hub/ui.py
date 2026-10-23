"""The hub window: one web page (web.py) in an AnkiWebView. Ticks change the page in place; actions run the card plan in
the background and then swap in the new sections, so the window never reloads or freezes."""
import datetime
import json
import re

from aqt.qt import QDialog, QVBoxLayout, Qt
from aqt.utils import restoreGeom, saveGeom, showInfo, tooltip

from . import anatomy_bridge as AB
from . import web

TABS = {"today": "today", "week": "week", "this week": "week", "cards": "cards", "card plan": "cards",
        "subjects": "subjects", "uworld": "uworld", "uworld misses": "uworld", "how to study": "guide", "guide": "guide",
        "settings": "settings"}
SUBS = ("anatomy", "physio", "histo", "embryo", "step")


class HubWindow(QDialog):
    def __init__(self, app):
        super().__init__(None)
        from aqt.webview import AnkiWebView
        self.app = app
        self.tab = "today"
        self.sub = "physio"
        self.loaded = False
        self.dirty = False
        self.setWindowTitle("Year 2 Hub")
        self.setWindowFlags(self.windowFlags() | Qt.WindowType.WindowMinMaxButtonsHint)
        self.resize(1200, 880)
        lay = QVBoxLayout(self)
        lay.setContentsMargins(0, 0, 0, 0)
        self.web = AnkiWebView(self, title="year2 hub")
        lay.addWidget(self.web)
        self.web.set_bridge_command(self.on_cmd, self)
        try:
            restoreGeom(self, "year2hub")
        except Exception:
            pass

    # ------------------------------------------------------------ drawing
    def show_tab(self, name):
        n = (name or "").lower()
        if n in SUBS:
            self.tab, self.sub = "subjects", n
        else:
            self.tab = TABS.get(n, "today")
        if self.loaded:
            self.web.eval("y2.go(%s);y2.sub(%s)" % (json.dumps(self.tab), json.dumps(self.sub)))

    def refresh(self):
        s = self.app.snapshot()
        cfg = self.app.cfg_merged()
        if not self.loaded:
            self.web.stdHtml(web.page(s, cfg, self.tab, self.sub), js=[], context=self)
            self.loaded = True
        else:
            self.web.eval("y2.fill(%s)" % json.dumps(web.parts(s, cfg, self.sub)))
        self.dirty = False

    def busy(self, on, text=""):
        if self.loaded:
            self.web.eval("y2.busy(%s,%s)" % ("true" if on else "false", json.dumps(text)))

    def reject(self):
        try:
            saveGeom(self, "year2hub")
        except Exception:
            pass
        super().reject()

    # ------------------------------------------------------------ commands from the page
    def on_cmd(self, cmd):
        if not cmd.startswith("y2:"):
            return None
        try:
            return self._cmd(cmd[3:])
        except Exception as e:
            print("Year 2 Hub command %s: %r" % (cmd, e))
            self.busy(False)
            showInfo("The Year 2 Hub could not do that: %r" % (e,), parent=self)

    def _cmd(self, c):
        app = self.app
        head, _, rest = c.partition(":")
        if head == "tab":
            self.tab = rest
            if self.dirty and rest == "week":
                self.refresh()
        elif head == "sub":
            self.sub = rest
        elif head == "tick":
            on, tid = rest.split(":", 1)
            app.tick(tid, "done" if on == "1" else None, window=False)
            self.dirty = True
        elif head == "drop":
            app.tick(rest, "skip", window=False)
            self.dirty = True
        elif head == "atick":
            on, key = rest.split(":", 1)
            app.tick_anatomy(key, on == "1")
        elif head == "light":
            app.light_day(None)
        elif head == "off":
            app.light_day(0.0)
        elif head == "normal":
            app.normal_day()
        elif head == "ahead":
            app.study_ahead()
        elif head == "replan":
            app.replan(ask=False)
        elif head == "run":
            app.run(quiet=False)
        elif head == "browse":
            app.browse_today("anking")
        elif head == "study":
            app.study(rest)
        elif head == "unit":
            app.browse_unit(rest)
        elif head == "date":
            eid, val = rest.rsplit(":", 1)
            if not val:
                self.busy(False)
                return None
            app.set_event_date(eid, datetime.date.fromisoformat(val))
        elif head == "qidbrowse":
            app.browse_qids(qids(rest))
        elif head == "qid":
            cap, text = rest.split(":", 1)
            q = qids(text)
            if not q:
                self.busy(False)
                self.say("No question IDs found in the text.")
                return None
            app.qid_release(q, int(cap), done=self.qid_done)
        elif head == "savecards":
            ceil, res, conf = rest.split(":")
            cfg = app.cfg_raw()
            cfg.setdefault("ceiling", {})["anking"] = max(5, min(80, int(float(ceil))))
            cfg["reserve"] = round(max(0.5, min(1.0, float(res))), 2)
            cfg["confirm_tracks"] = ["physio"] if conf == "1" else []
            app.write_cfg(cfg)
            app.replan(ask=False, done=lambda rep: tooltip("Saved. The card plan was re-made from today.", parent=self))
        elif head == "panel":
            app.set_cfg("show_panel", rest == "1")
        elif head == "appanel":
            AB.hide_its_panel(rest == "1")
            app.refresh_main()
        elif head == "config":
            app.edit_config()
        elif head == "anatomy":
            {"open": AB.open_window, "browse": lambda: AB.browse_today(app.today()), "study": AB.study}[rest]()
        return None

    def say(self, txt):
        self.web.eval("var r=document.getElementById('qres'); if(r) r.textContent=%s" % json.dumps(txt))

    def qid_done(self, res):
        if res:
            self.say("%d questions: %d AnKing cards tagged; %d unsuspended and added to today, %d were already waiting, %d "
                     "you've already studied.%s" % (res["questions"], res["found"], res["released"], res["already_live"],
                                                    res["learned"], (" No AnKing cards for: %s." % ", ".join(map(str, res["no_cards"])))
                                                    if res["no_cards"] else ""))


def qids(text):
    return [int(x) for x in re.findall(r"\d{3,7}", text or "")]
