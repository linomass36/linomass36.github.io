"""Read today's anatomy from the Anatomy Prime add-on (it keeps running the anatomy cards). Nothing here changes its
plan; the hub only reads its day and ticks its checklist, the same way its own Today tab does."""
import sys


def _module():
    for name, m in list(sys.modules.items()):
        if "." in name or m is None:
            continue
        app = getattr(m, "APP", None)
        if app is not None and hasattr(app, "deck_browser_panel") and hasattr(app, "browse_day") and "Anatomy Prime" in (m.__doc__ or ""):
            return m
    return None


def available():
    return _module() is not None


def summary(today):
    """{num, title, reads, new, behind, checklist: [(key, label, ticked)], tasks} or None."""
    m = _module()
    if m is None:
        return None
    try:
        app = m.APP
        app.load_state()
        plan = app.plan
        if not app.state.get("setup_done") or plan is None:
            return {"setup": False}
        core = sys.modules[m.__name__ + ".core"]
        ui = sys.modules.get(m.__name__ + ".ui")
        num, day = core.day_info(plan, today)
        out = {"setup": True, "num": num, "title": day["title"] if day else None, "reads": [], "new": None, "behind": 0,
               "checklist": [], "tasks": []}
        if day:
            for r in day.get("read", []):
                if r.get("level") == "core":
                    try:
                        out["reads"].append(ui.read_short(r) if ui else r.get("short", ""))
                    except Exception:
                        out["reads"].append(r.get("short", ""))
            for t in day.get("tasks", []) or []:
                out["tasks"].append(t.get("text") if isinstance(t, dict) else str(t))
        try:
            load = app.engine.day_load(today) if app.engine else None
            if load:
                out["new"] = load["theory"] + load["cadaver"] + load.get("local", 0)
            if app.last_report:
                out["behind"] = app.last_report["totals"].get("behind", 0)
        except Exception:
            pass
        items = [tuple(x) for x in (plan.get("checklist") or [])]
        done = set(app.state.get("checklist", {}).get(core.iso(today), []))
        out["checklist"] = [(k, label, k in done) for k, label in items]
        return out
    except Exception as e:
        print("Year 2 Hub, anatomy:", repr(e))
        return None


def tick(today, key, on):
    m = _module()
    if m is None:
        return
    app = m.APP
    core = sys.modules[m.__name__ + ".core"]
    app.load_state()
    cl = app.state.setdefault("checklist", {})
    day = cl.setdefault(core.iso(today), [])
    if on and key not in day:
        day.append(key)
    if not on and key in day:
        day.remove(key)
    app.save_state()


def open_window():
    m = _module()
    if m:
        m.APP.open_window()


def browse_today(today):
    m = _module()
    if m:
        m.APP.browse_day(today)


def study():
    m = _module()
    if m:
        m.APP.study()


def hide_its_panel(hide=True):
    """The hub replaces the Anatomy Prime panel on the deck screen (its own setting show_deck_browser_panel)."""
    m = _module()
    if m is None:
        return False
    from aqt import mw
    try:
        cfg = mw.addonManager.getConfig(m.__name__) or {}
        cfg["show_deck_browser_panel"] = not hide
        mw.addonManager.writeConfig(m.__name__, cfg)
        return True
    except Exception:
        return False


def its_panel_shown():
    m = _module()
    if m is None:
        return False
    from aqt import mw
    try:
        return (mw.addonManager.getConfig(m.__name__) or {}).get("show_deck_browser_panel", True)
    except Exception:
        return False
