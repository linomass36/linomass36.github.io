"""Year 2 Hub pages: one HTML page per window (all sections in it, switched without reloading), and the deck-screen
card. Plain HTML, CSS and a little JS; actions go back to Python through pycmd('y2:...')."""
import datetime as _dt
import html

from .tasks import SUBJECTS

E = html.escape
COLOR = {"anatomy": "anat", "physio": "phys", "histo": "hist", "embryo": "embr", "step": "step", "all": "all"}
NUM = {"anatomy": "I", "physio": "II", "histo": "III", "embryo": "IV", "step": "V", "all": "·"}
SHORT = {"anatomy": "Anatomy", "physio": "Physiology", "histo": "Histology", "embryo": "Embryology", "step": "USMLE",
         "all": "Every subject"}
DECK = {"anking": "AnKing", "slides": "SecondLook"}
MODE = {"on track": "On track", "catching up": "Catching up", "plan moved": "Plan moved", "new plan": "New plan"}
STATUS = {"done": "Done", "in progress": "In progress", "upcoming": "Upcoming", "awaiting": "Waiting for OK",
          "skipped": "Skipped", "undated": "No date", "nothing new": "Nothing new", "beyond plan": "Beyond plan",
          "shared": "With other units"}

CSS = r"""
:root{
  --paper:#f7f3ea; --surface:#fffdf8; --raised:#ffffff; --line:#e7dfcf; --line2:#efe8da; --ink:#1f1b16; --ink2:#4a4339;
  --muted:#857a69; --accent:#9a3f2b; --accent-soft:#f4e7df; --ok:#3f7a52; --warn:#b4671e; --bad:#a1362b;
  --anat:#9a3f2b; --phys:#2f5d7c; --hist:#6a4c93; --embr:#3f7a5a; --step:#a87418; --all:#857a69;
  --shadow:0 1px 2px rgba(60,40,10,.05),0 4px 14px rgba(60,40,10,.06);
  --serif:"Iowan Old Style","Charter","Newsreader","Georgia","Palatino",serif;
  --sans:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","Inter","Helvetica Neue",Arial,sans-serif;
}
.nightMode,.night-mode,body.dark{
  --paper:#15130f; --surface:#1c1915; --raised:#221e19; --line:#2f2a23; --line2:#28241e; --ink:#ece5d8; --ink2:#cfc6b6;
  --muted:#958b7a; --accent:#d47f63; --accent-soft:#33241e; --ok:#8cc29b; --warn:#e3a35f; --bad:#e08a7a;
  --anat:#d47f63; --phys:#7fb0d3; --hist:#b49ae0; --embr:#86c4a0; --step:#e0b45a; --all:#958b7a;
  --shadow:0 1px 2px rgba(0,0,0,.3),0 6px 18px rgba(0,0,0,.25);
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--paper);color:var(--ink);font:13.5px/1.45 var(--sans);-webkit-font-smoothing:antialiased}
.app{max-width:1180px;margin:0 auto;padding:18px 22px 40px}
.top{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--line)}
.eyebrow{font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--accent)}
.title{font:italic 400 30px/1.1 var(--serif);margin:4px 0 0}
.sub{color:var(--muted);margin-top:4px}
.ring{display:flex;align-items:center;gap:12px}
.ring svg{width:54px;height:54px}
.ring .big{font:600 15px var(--sans)}
nav{display:flex;gap:4px;margin:14px 0 18px;flex-wrap:wrap}
nav a{padding:6px 13px;border-radius:999px;color:var(--ink2);text-decoration:none;cursor:pointer;border:1px solid transparent;user-select:none}
nav a:hover{background:var(--accent-soft)}
nav a.on{background:var(--ink);color:var(--paper)}
section{display:none;animation:fade .18s ease}
section.on{display:block}
@keyframes fade{from{opacity:.6;transform:translateY(3px)}to{opacity:1;transform:none}}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:14px}
.tile{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;box-shadow:var(--shadow)}
.tile .k{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.tile .v{font:italic 400 30px/1.15 var(--serif);margin:2px 0}
.tile .s{color:var(--muted);font-size:12px}
.pill{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;background:var(--accent-soft);color:var(--accent)}
.pill.ok{background:rgba(63,122,82,.12);color:var(--ok)} .pill.warn{background:rgba(180,103,30,.13);color:var(--warn)}
.pill.bad{background:rgba(161,54,43,.12);color:var(--bad)} .pill.muted{background:var(--line2);color:var(--muted)}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 16px}
button,.btn{font:500 12.5px var(--sans);padding:6px 12px;border-radius:8px;border:1px solid var(--line);background:var(--raised);color:var(--ink);cursor:pointer;transition:border-color .12s,background .12s}
button:hover,.btn:hover{border-color:var(--accent)}
button.primary{background:var(--accent);border-color:var(--accent);color:#fff}
button.ghost{background:transparent}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(440px,1fr));gap:14px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);overflow:hidden}
.card .hd{display:flex;align-items:center;gap:10px;padding:12px 14px 8px}
.badge{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font:italic 600 13px var(--serif);color:#fff;flex:none}
.card .nm{font:italic 400 19px var(--serif);flex:1}
.card .nx{font-size:11.5px;color:var(--muted);text-align:right}
.card .nx b{color:var(--ink2);font-weight:600}
.bar{height:3px;background:var(--line2);margin:0 14px}
.bar i{display:block;height:3px;border-radius:3px;transition:width .25s ease}
.tasks{list-style:none;margin:0;padding:6px 6px 10px}
.task{display:flex;gap:10px;padding:7px 8px;border-radius:9px;cursor:pointer;align-items:flex-start;transition:background .12s}
.task:hover{background:var(--line2)}
.chk{width:18px;height:18px;border-radius:50%;border:1.6px solid var(--muted);flex:none;margin-top:1px;display:flex;align-items:center;justify-content:center;transition:all .15s}
.task.done .chk{background:var(--ok);border-color:var(--ok)}
.task.done .chk:after{content:"";width:5px;height:9px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg) translate(-1px,-1px)}
.task .t{flex:1;min-width:0}
.task .tt{color:var(--ink)}
.task.done .tt{color:var(--muted);text-decoration:line-through;text-decoration-color:var(--line)}
.task .m{font-size:11.5px;color:var(--muted);margin-top:1px}
.task.event .tt{font-weight:600}
.task.note{cursor:default}.task.note .chk{border-style:dashed;opacity:.5}
.tag{font-size:10.5px;padding:0 6px;border-radius:5px;background:var(--line2);color:var(--muted);margin-left:4px;white-space:nowrap}
.tag.floor{background:transparent;border:1px solid var(--line);}
.tag.evt{background:var(--accent-soft);color:var(--accent)}
.empty{padding:10px 16px 14px;color:var(--muted);font-style:italic}
.left{border-color:rgba(180,103,30,.35)}
.left .hd .nm{font-size:16px}
.drop{margin-left:auto;font-size:11px;padding:2px 8px;opacity:.0;transition:opacity .12s}
.task:hover .drop{opacity:1}
.anat-info{padding:0 16px 4px;color:var(--ink2)}
.anat-info .r{color:var(--muted);font-size:12px}
.foot{display:flex;gap:6px;padding:0 14px 12px;flex-wrap:wrap}
h2{font:italic 400 22px var(--serif);margin:6px 0 10px}
h3{font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent);font-weight:500;margin:22px 0 8px}
.muted{color:var(--muted)} .small{font-size:12px}
/* week */
.week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}
.day{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 9px;min-height:220px}
.day.today{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft)}
.day .dh{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}
.day .dn{font:italic 400 18px var(--serif)} .day .dw{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.day .dm{font-size:11px;color:var(--muted);margin-bottom:6px}
.it{display:flex;gap:6px;font-size:11.8px;line-height:1.3;padding:4px 0;border-top:1px solid var(--line2)}
.it .dot{width:7px;height:7px;border-radius:50%;margin-top:5px;flex:none}
.it.done{color:var(--muted);text-decoration:line-through}
.it.evt{font-weight:600}
/* timeline */
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.chips a{padding:5px 12px;border-radius:999px;border:1px solid var(--line);cursor:pointer;color:var(--ink2);user-select:none}
.chips a.on{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.sub-sec{display:none}.sub-sec.on{display:block}
.lede{color:var(--ink2);background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin-bottom:12px}
.tl{display:flex;flex-direction:column;gap:6px}
.ev{display:flex;gap:14px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:10px 14px;align-items:flex-start}
.ev.past{opacity:.55}
.ev.today{border-color:var(--accent)}
.cal{width:46px;text-align:center;flex:none}
.cal .d{font:italic 400 24px/1 var(--serif)} .cal .mo{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.ev .body{flex:1;min-width:0}
.ev .h{font-weight:600}
.ev .x{font-size:12px;color:var(--muted);margin-top:2px}
.ev .side{text-align:right;font-size:11.5px;color:var(--muted);flex:none}
input[type=date]{font:12px var(--sans);padding:3px 6px;border:1px solid var(--line);border-radius:6px;background:var(--raised);color:var(--ink);margin-top:4px}
/* cards */
.chart{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px 6px}
table.u{width:100%;border-collapse:separate;border-spacing:0;background:var(--surface);border:1px solid var(--line);border-radius:12px;overflow:hidden}
table.u th{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:500;text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);background:var(--raised)}
table.u th,td.nw{white-space:nowrap}
table.u td{padding:7px 10px;border-bottom:1px solid var(--line2);vertical-align:middle}
table.u tr:last-child td{border-bottom:none}
.pb{height:5px;background:var(--line2);border-radius:5px;width:90px;display:inline-block;vertical-align:middle;margin-right:6px}
.pb i{display:block;height:5px;border-radius:5px;background:var(--ok)}
/* forms */
.form{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:12px}
.row{display:flex;align-items:center;gap:10px;margin:8px 0;flex-wrap:wrap}
.row label{min-width:240px;color:var(--ink2)}
input[type=number],select,textarea{font:13px var(--sans);padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--raised);color:var(--ink)}
textarea{width:100%;min-height:120px}
.switch{display:flex;align-items:center;gap:8px;cursor:pointer;margin:8px 0}
.result{margin-top:10px;color:var(--ink2)}
.prose{max-width:760px;line-height:1.6;color:var(--ink2)}
.prose p{margin:6px 0 10px}
.banner{border:1px solid rgba(161,54,43,.35);background:rgba(161,54,43,.06);color:var(--ink2);border-radius:12px;padding:10px 14px;margin-bottom:14px}
.busy{position:fixed;top:14px;right:18px;font-size:11.5px;color:var(--muted);background:var(--raised);border:1px solid var(--line);border-radius:999px;padding:4px 10px;display:none}
.busy.on{display:block}
@media (max-width:980px){.week{grid-template-columns:repeat(4,minmax(0,1fr))}.grid{grid-template-columns:1fr}}
"""

JS = r"""
var y2 = {
  go: function(name){
    document.querySelectorAll('nav a').forEach(function(a){a.classList.toggle('on', a.dataset.s===name)});
    document.querySelectorAll('section').forEach(function(s){s.classList.toggle('on', s.id==='s-'+name)});
    window.scrollTo(0,0); if(window.pycmd) pycmd('y2:tab:'+name);
  },
  sub: function(name){
    document.querySelectorAll('.chips a').forEach(function(a){a.classList.toggle('on', a.dataset.k===name)});
    document.querySelectorAll('.sub-sec').forEach(function(s){s.classList.toggle('on', s.id==='k-'+name)});
    pycmd('y2:sub:'+name);
  },
  fill: function(p){
    var y = window.scrollY;
    for(var k in p){ var el = document.getElementById(k==='top' ? 'top' : 's-'+k); if(el) el.innerHTML = p[k]; }
    y2.busy(false); window.scrollTo(0, y);
  },
  tick: function(el){
    if(el.classList.contains('note')) return;
    var on = !el.classList.contains('done');
    el.classList.toggle('done', on);
    pycmd('y2:tick:'+(on?'1':'0')+':'+el.dataset.id);
    y2.recount();
  },
  atick: function(el){
    var on = !el.classList.contains('done');
    el.classList.toggle('done', on);
    pycmd('y2:atick:'+(on?'1':'0')+':'+el.dataset.k);
    y2.recount();
  },
  drop: function(ev, el){
    ev.stopPropagation();
    var row = el.closest('.task'); row.style.display='none';
    pycmd('y2:drop:'+row.dataset.id);
  },
  recount: function(){
    document.querySelectorAll('.card[data-subj]').forEach(function(c){
      var all = c.querySelectorAll('.task:not(.note)'), done = c.querySelectorAll('.task.done:not(.note)');
      var b = c.querySelector('.bar i'); if(b) b.style.width = (all.length ? 100*done.length/all.length : 0)+'%';
    });
    var all = document.querySelectorAll('#s-today .task[data-today]:not(.note)');
    var done = document.querySelectorAll('#s-today .task[data-today].done:not(.note)');
    var mins = 0; all.forEach(function(t){ if(!t.classList.contains('done')) mins += parseInt(t.dataset.min||'0'); });
    var p = all.length ? done.length/all.length : 0;
    var c = document.getElementById('ringc'); if(c){ c.setAttribute('stroke-dasharray', (p*138.2)+' 138.2'); c.style.opacity = done.length ? 1 : 0; }
    var t = document.getElementById('ringt'); if(t) t.textContent = done.length+'/'+all.length;
    var s = document.getElementById('ringm'); if(s) s.textContent = y2.hm(mins)+' left';
  },
  hm: function(m){ var h=Math.floor(m/60); m=m%60; return h ? h+' h '+(m<10?'0':'')+m+' min' : m+' min'; },
  busy: function(on, text){ var b=document.getElementById('busy'); b.textContent = text||'Updating…'; b.classList.toggle('on', !!on); },
  cmd: function(c){ y2.busy(true); pycmd(c); }
};
"""


def fmt(day, short=False):
    if not day:
        return "—"
    x = _dt.date.fromisoformat(day) if isinstance(day, str) else day
    return x.strftime("%a %d %b" if short else "%A %d %B").replace(" 0", " ")


def hm(m):
    h, m = divmod(int(m), 60)
    return ("%d h %02d min" % (h, m)) if h else ("%d min" % m)


def until(day, today):
    x = _dt.date.fromisoformat(day) if isinstance(day, str) else day
    n = (x - today).days
    return "today" if n == 0 else "tomorrow" if n == 1 else ("in %d days" % n if n > 0 else "%d days ago" % -n)


def ring(done, total, mins):
    p = done / total if total else 0
    return ("<div class='ring'><svg viewBox='0 0 54 54'><circle cx='27' cy='27' r='22' fill='none' stroke='var(--line)' stroke-width='5'/>"
            "<circle id='ringc' cx='27' cy='27' r='22' fill='none' stroke='var(--accent)' stroke-width='5' stroke-linecap='round' "
            "stroke-dasharray='%.1f 138.2' transform='rotate(-90 27 27)' style='transition:stroke-dasharray .3s;opacity:%d'/></svg>"
            "<div><div class='big' id='ringt'>%d/%d</div><div class='muted small'>tasks · <span id='ringm'>%s left</span></div></div></div>"
            % (p * 138.2, 1 if done else 0, done, total, hm(mins)))


def task_li(t, today_flag=True, show_date=False, drop=False):
    cls = ["task"]
    if t.get("status"):
        cls.append("done")
    if t["kind"] == "note":
        cls.append("note")
    if t["kind"] in ("test", "lab"):
        cls.append("event")
    meta = []
    if show_date:
        meta.append(fmt(t["date"], True))
    if t["min"]:
        meta.append(hm(t["min"]))
    if t.get("detail"):
        meta.append(E(t["detail"]))
    tags = ""
    if t["kind"] in ("test", "lab"):
        tags += "<span class='tag evt'>%s</span>" % ("Test" if t["kind"] == "test" else "Class")
    if t.get("floor") and t["kind"] not in ("test", "lab"):
        tags += "<span class='tag floor'>Floor</span>"
    return ("<li class='%s' data-id='%s' data-min='%d'%s onclick='y2.tick(this)'><span class='chk'></span>"
            "<div class='t'><div class='tt'>%s%s</div>%s</div>%s</li>"
            % (" ".join(cls), E(t["id"]), 0 if t.get("status") else int(t["min"] or 0), " data-today='1'" if today_flag else "",
               E(t["title"]), tags, ("<div class='m'>%s</div>" % " · ".join(meta)) if meta else "",
               "<button class='ghost drop' onclick='y2.drop(event,this)'>Drop</button>" if drop else ""))


# ====================================================================== the window page
def top_html(s):
    today = s["today"]
    real = [t for t in s["tasks"] if t["kind"] != "note"]
    done = sum(1 for t in real if t.get("status"))
    mins = sum(t["min"] for t in real if not t.get("status"))
    an = s.get("anatomy")
    if an and an.get("setup"):
        real_a = an.get("checklist", [])
        done += sum(1 for k, l, on in real_a if on)
        real = real + list(real_a)
    nxt = s.get("next_any")
    return ("<div><div class='eyebrow'>❦ &nbsp;Year 2 Hub</div><div class='title'>%s</div><div class='sub'>%s</div></div>%s"
            % (fmt(today), ("Next graded: <b>%s</b>, %s" % (E(nxt["label"].split(" (")[0]), until(nxt["date"], today))) if nxt else "",
               ring(done, len(real), mins)))


def parts(s, cfg, sub="physio"):
    return {"top": top_html(s), "today": today_html(s, cfg), "week": week_html(s), "subjects": subjects_html(s, sub),
            "cards": cards_html(s), "settings": settings_html(s, cfg)}


def page(s, cfg, tab="today", sub="physio"):
    p = parts(s, cfg, sub)
    nav = [("today", "Today"), ("week", "Week"), ("subjects", "Subjects"), ("cards", "Cards"), ("uworld", "UWorld misses"),
           ("guide", "How to study"), ("settings", "Settings")]
    out = ["<style>%s</style><script>%s</script><div class='app'>" % (CSS, JS),
           "<div id='busy' class='busy'>Updating…</div>",
           "<div class='top' id='top'>%s</div>" % p["top"]]
    out.append("<nav>%s</nav>" % "".join("<a data-s='%s' class='%s' onclick=\"y2.go('%s')\">%s</a>" % (k, "on" if k == tab else "", k, v)
                                         for k, v in nav))
    for name in ("today", "week", "subjects", "cards"):
        out.append(sec(name, tab, p[name]))
    out.append(sec("uworld", tab, uworld_html(cfg)))
    out.append(sec("guide", tab, GUIDE))
    out.append(sec("settings", tab, p["settings"]))
    out.append("</div>")
    return "".join(out)


def sec(name, tab, body):
    return "<section id='s-%s' class='%s'>%s</section>" % (name, "on" if name == tab else "", body)


def today_html(s, cfg):
    today = s["today"]
    rep = s.get("report")
    an = s.get("anatomy")
    h = []
    r = rep["run"] if rep else {"target": {}, "mode": {}}
    tiles = []
    for key in ("anking", "slides"):
        if key in r.get("target", {}):
            m = r["mode"].get(key, "")
            cls = {"on track": "ok", "catching up": "warn", "plan moved": "bad"}.get(m, "muted")
            tiles.append(("%s new" % DECK[key], str(r["target"][key]), "<span class='pill %s'>%s</span>" % (cls, MODE.get(m, m))))
    if an and an.get("setup") and an.get("new") is not None:
        tiles.append(("Anatomy Prime new", str(an["new"]), "day %s%s" % (an.get("num") or "—",
                                                                        (" · %d from earlier" % an["behind"]) if an.get("behind") else "")))
    nxt = s.get("next_any")
    if nxt:
        u = until(nxt["date"], today)
        tiles.append(("Next graded", u.replace("in ", ""), E(nxt["label"].split(" (")[0])))
    h.append("<div class='tiles'>%s</div>" % "".join("<div class='tile'><div class='k'>%s</div><div class='v'>%s</div><div class='s'>%s</div></div>"
                                                     % (k, v, sub) for k, v, sub in tiles))
    h.append("<div class='actions'>"
             "<button onclick=\"y2.cmd('y2:light')\" title='Halve today&#39;s new cards; the rest is spread over the next days'>Light day</button>"
             "<button onclick=\"y2.cmd('y2:off')\" title='No new cards today'>Day off</button>"
             "<button onclick=\"y2.cmd('y2:normal')\">Normal day</button>"
             "<button onclick=\"y2.cmd('y2:ahead')\" title='Ten more AnKing cards today'>Study ahead +10</button>"
             "<span style='flex:1'></span>"
             "<button class='ghost' onclick=\"pycmd('y2:browse')\">Today's AnKing cards</button>"
             "<button class='primary' onclick=\"pycmd('y2:study:anking')\">Study AnKing</button></div>")
    if rep and rep["run"].get("moved"):
        units = {u["id"]: u for u in rep.get("units", [])}
        mv = ", ".join("%s (%s)" % (E(units[u]["label"]), "%d d" % n if n < 999 else "beyond the plan")
                       for u, n in sorted(rep["run"]["moved"].items(), key=lambda x: -x[1])[:5] if u in units)
        h.append("<div class='banner'><b>The card plan moved today.</b> Too much was missed to catch up with the spare capacity: %s.</div>" % mv)
    if s.get("leftovers"):
        h.append("<div class='card left' style='margin-bottom:14px'><div class='hd'><div class='badge' style='background:var(--warn)'>↺</div>"
                 "<div class='nm'>Left from earlier days</div><div class='nx'>%d open</div></div><ul class='tasks'>%s</ul></div>"
                 % (len(s["leftovers"]), "".join(task_li(t, False, True, True) for t in s["leftovers"])))
    by = {}
    for t in s["tasks"]:
        by.setdefault(t["subject"], []).append(t)
    cards = []
    for key, label in SUBJECTS + [("all", "Every subject")]:
        items = by.get(key, [])
        if key == "anatomy":
            cards.append(anatomy_card(s, items))
            continue
        if key == "all" and not items:
            continue
        cards.append(subject_card(s, key, items))
    h.append("<div class='grid'>%s</div>" % "".join(cards))
    return "".join(h)


def nx_html(s, key):
    ev = s["next"].get(key)
    if not ev:
        return ""
    return "Next <b>%s</b><br>%s%s" % (E(ev["label"].split(":")[0]), until(ev["date"], s["today"]), " · tbc" if ev["tbc"] else "")


def subject_card(s, key, items):
    real = [t for t in items if t["kind"] != "note"]
    done = sum(1 for t in real if t.get("status"))
    pct = 100 * done / len(real) if real else 0
    body = "<ul class='tasks'>%s</ul>" % "".join(task_li(t) for t in items) if items else \
        "<div class='empty'>Nothing scheduled today: reviews only.</div>"
    return ("<div class='card' data-subj='%s'><div class='hd'><div class='badge' style='background:var(--%s)'>%s</div>"
            "<div class='nm'>%s</div><div class='nx'>%s</div></div><div class='bar'><i style='width:%.0f%%;background:var(--%s)'></i></div>%s</div>"
            % (key, COLOR[key], NUM[key], SHORT[key], nx_html(s, key), pct, COLOR[key], body))


def anatomy_card(s, items):
    an = s.get("anatomy")
    info, checks, foot = "", "", ""
    if an is None:
        info = "<div class='empty'>The Anatomy Prime add-on isn't loaded: only lab and partial dates show here.</div>"
    elif not an.get("setup"):
        info = "<div class='empty'>Anatomy Prime isn't set up in this profile yet.</div>"
    else:
        reads = (" <span class='r'>· Read first: %s</span>" % E(", ".join(an["reads"]))) if an.get("reads") else ""
        new = ("<div class='r'>%d new anatomy cards today%s</div>" % (an["new"], (", %d from earlier days" % an["behind"]) if an.get("behind") else "")) \
            if an.get("new") is not None else ""
        info = "<div class='anat-info'><b>Day %s.</b> %s%s%s</div>" % (an.get("num") or "—", E(an.get("title") or "No plan day today"), reads, new)
        checks = "".join("<li class='task%s' data-k='%s' data-today='1' data-min='0' onclick='y2.atick(this)'><span class='chk'></span>"
                         "<div class='t'><div class='tt'>%s</div></div></li>" % (" done" if on else "", E(k), E(label))
                         for k, label, on in an.get("checklist", []))
        foot = ("<div class='foot'><button onclick=\"pycmd('y2:anatomy:open')\">Open Anatomy Prime</button>"
                "<button class='ghost' onclick=\"pycmd('y2:anatomy:browse')\">Today's anatomy cards</button>"
                "<button class='ghost' onclick=\"pycmd('y2:anatomy:study')\">Study anatomy</button></div>")
    allitems = (checks or "") + "".join(task_li(t) for t in items)
    n_all = len(an.get("checklist", [])) if an and an.get("setup") else 0
    n_all += len([t for t in items if t["kind"] != "note"])
    n_done = (sum(1 for k, l, on in an.get("checklist", []) if on) if an and an.get("setup") else 0) + sum(1 for t in items if t.get("status"))
    pct = 100 * n_done / n_all if n_all else 0
    return ("<div class='card' data-subj='anatomy'><div class='hd'><div class='badge' style='background:var(--anat)'>I</div>"
            "<div class='nm'>Anatomy</div><div class='nx'>%s</div></div><div class='bar'><i style='width:%.0f%%;background:var(--anat)'></i></div>"
            "%s<ul class='tasks'>%s</ul>%s</div>" % (nx_html(s, "anatomy"), pct, info, allitems, foot))


def week_html(s):
    days = []
    for dd, tasks in s["week"]:
        items = [t for t in tasks if t["kind"] != "note"]
        mins = sum(t["min"] for t in items)
        rows = "".join("<div class='it%s%s'><span class='dot' style='background:var(--%s)'></span><span>%s</span></div>"
                       % (" done" if t.get("status") else "", " evt" if t["kind"] in ("test", "lab") else "", COLOR.get(t["subject"], "all"),
                          E(t["title"] if len(t["title"]) < 80 else t["title"][:77] + "…")) for t in items)
        days.append("<div class='day%s'><div class='dh'><span class='dw'>%s</span><span class='dn'>%s</span></div>"
                    "<div class='dm'>%s</div>%s</div>" % (" today" if dd == s["today"] else "", dd.strftime("%a"), dd.day,
                                                         hm(mins) if mins else "light", rows or "<div class='muted small'>Reviews only</div>"))
    legend = " &nbsp; ".join("<span><span class='dot' style='display:inline-block;width:8px;height:8px;border-radius:50%%;background:var(--%s)'></span> %s</span>"
                             % (COLOR[k], SHORT[k]) for k, _ in SUBJECTS)
    return "<h2>The next seven days</h2><div class='muted small' style='margin-bottom:10px'>%s</div><div class='week'>%s</div>" % (legend, "".join(days))


def subjects_html(s, sub="physio"):
    chips = "".join("<a data-k='%s' class='%s' onclick=\"y2.sub('%s')\">%s</a>" % (k, "on" if k == sub else "", k, SHORT[k])
                    for k, _ in SUBJECTS)
    secs = []
    for key, label in SUBJECTS:
        secs.append("<div class='sub-sec%s' id='k-%s'>%s</div>" % (" on" if key == sub else "", key, subject_page(s, key)))
    return "<div class='chips'>%s</div>%s" % (chips, "".join(secs))


LEDE = {
    "physio": "Entrance test every Friday at 12:45. Mon: Costanzo map + set pages part 1 · Tue: part 2 · Wed: AI set 1 + UWorld block 1 · "
              "Thu: AI set 2 · Fri: test + recall page · Sat: depth add-on.",
    "histo": "Lab with a quiz every Monday. Thu: Wheater · Fri: Junqueira · Sat: draw + SecondLook · Sun: AI set · Mon: lab, then miss and "
             "disease cards within 24 h. Slide partial: rotation from 21 days out, three timed mocks in the last week.",
    "embryo": "Seminar every Wednesday at 13:00. Sat: Before We Are Born · Mon: draw the timeline · Tue: AI set · Wed: seminar, then "
              "malformation cards and a recall page · Sat: BRS Embryology.",
    "step": "Build week: Mon and Wed First Aid pages · Tue Boards & Beyond · Wed block 1 · Sat group session + block 2 · Sun block 3 + "
            "numbers. Crunch: AnKing + 1 block. Rest: AnKing only.",
    "anatomy": "Labs on Thursdays, partials as listed. The cards and readings run in the Anatomy Prime add-on.",
}


def subject_page(s, key):
    cal = s["cal"]
    today = s["today"]
    h = ["<div class='lede'>%s</div>" % E(LEDE[key])]
    if key == "step":
        rows = []
        for w in cal.weeks:
            if not w.get("label") and w["mode"] not in ("Crunch", "Buffer", "Rest", "Push"):
                continue
            mon = _dt.date.fromisoformat(w["monday"])
            fa = ", ".join(("%d" % a) if a == b else ("%d–%d" % (a, b)) for a, b in w.get("fa", []))
            cls = "past" if mon + _dt.timedelta(days=6) < today else ("today" if mon <= today <= mon + _dt.timedelta(days=6) else "")
            mode = w["mode"]
            pc = {"Crunch": "bad", "Push": "warn", "Rest": "muted", "Buffer": "muted"}.get(mode, "ok")
            rows.append("<div class='ev %s'><div class='cal'><div class='d'>%d</div><div class='mo'>%s</div></div><div class='body'>"
                        "<div class='h'>Week %d · %s</div><div class='x'>%s%s</div></div><div class='side'><span class='pill %s'>%s</span>"
                        "<br>%s block%s</div></div>" % (cls, mon.day, mon.strftime("%b"), w["week"], E(w.get("label") or mode),
                                                        " · ".join(p for p in [("First Aid pp. " + fa) if fa else "", ("UWorld: " + E(w["system"])) if w.get("system") else ""] if p), "",
                                                        pc, mode, w.get("blocks", 0), "" if w.get("blocks") == 1 else "s"))
        h.append("<div class='tl'>%s</div>" % "".join(rows))
    else:
        evs = [(dt_, eid) for dt_, eid in cal.dated() if cal.events[eid]["subject"] == key]
        und = [eid for eid, e in cal.events.items() if e["subject"] == key and not cal.date_of(eid)]
        rows = [event_row(cal, eid, dt_, today) for dt_, eid in evs] + [event_row(cal, eid, None, today) for eid in und]
        h.append("<div class='tl'>%s</div>" % "".join(rows))
    h.append(unit_table(s, key))
    return "".join(h)


def event_row(cal, eid, dt_, today):
    e = cal.events[eid]
    x = []
    if e["subject"] == "physio":
        pg = "; ".join("Ch %s pp. %d–%d" % tuple(p) for p in e.get("pages", [])) or e.get("guyton", "")
        x.append(pg if pg.startswith("Guyton") else "Guyton: " + pg)
        if not e.get("costanzo", "").startswith("none"):
            x.append("Costanzo: " + e.get("costanzo", ""))
        if e.get("system"):
            x.append("UWorld: " + e["system"])
    elif e["subject"] == "histo":
        if e.get("wheater"):
            x.append("Wheater: " + e["wheater"])
        if e.get("junqueira"):
            x.append("Junqueira: " + e["junqueira"])
        if e.get("diseases"):
            x.append("Disease cards: " + e["diseases"])
    elif e["subject"] == "embryo":
        x.append("Before We Are Born: " + e.get("bwab", "").strip("()"))
        if e.get("malformations"):
            x.append("Malformations: " + e["malformations"])
    cls = "" if dt_ is None else ("past" if dt_ < today else "today" if dt_ == today else "")
    dpart = ("<div class='d'>%d</div><div class='mo'>%s</div>" % (dt_.day, dt_.strftime("%b"))) if dt_ else "<div class='d'>?</div><div class='mo'>date</div>"
    tbc = "<span class='pill warn'>to confirm</span><br>" if cal.tbc(eid) or dt_ is None else ""
    kindp = {"test": "Test", "partial": "Partial", "lab": "Lab", "seminar": "Seminar", "review": "Review", "exam": "Exam"}.get(e["kind"], "")
    return ("<div class='ev %s'><div class='cal'>%s</div><div class='body'><div class='h'>%s</div><div class='x'>%s</div></div>"
            "<div class='side'>%s%s%s<br><input type='date' value='%s' onchange=\"y2.cmd('y2:date:%s:'+this.value)\" title='Change the date'></div></div>"
            % (cls, dpart, E(e.get("title") or e["label"]), E(" · ".join(x)), tbc, kindp,
               (" · " + until(dt_, today)) if dt_ and dt_ >= today else "", dt_.isoformat() if dt_ else "", E(eid)))


def unit_table(s, key):
    rep = s.get("report")
    if not rep or key == "anatomy" or not rep.get("units"):
        return ""
    track = {"physio": ["physio"], "histo": ["histo", "slides"], "embryo": ["embryo"], "step": ["step"]}[key]
    rows = []
    for u in rep["units"]:
        if u["track"] not in track or u["total"] == 0:
            continue
        pct = 100 * u["seen"] / u["total"] if u["total"] else 0
        rows.append("<tr><td>%s</td><td class='nw'><span class='pb'><i style='width:%.0f%%'></i></span><span class='small muted'>%d/%d</span></td>"
                    "<td>%s</td><td><span class='small'>%s</span></td></tr>" % (E(u["label"]), pct, u["seen"], u["total"],
                                                                                fmt(u["finish"], True) if u["finish"] else "—",
                                                                                STATUS.get(u["status"], u["status"])))
    if not rows:
        return ""
    return "<h3>Cards</h3><table class='u'><tr><th>Unit</th><th>Learned</th><th>Planned finish</th><th>Status</th></tr>%s</table>" % "".join(rows)


def cards_html(s):
    rep = s.get("report")
    if not rep:
        return "<div class='lede'>The card plan is being made…</div>"
    r = rep["run"]
    h = ["<h2>The card plan</h2><div class='tiles'>"]
    for key, n in r.get("target", {}).items():
        m = r["mode"].get(key, "")
        cls = {"on track": "ok", "catching up": "warn", "plan moved": "bad"}.get(m, "muted")
        h.append("<div class='tile'><div class='k'>%s today</div><div class='v'>%d</div><div class='s'><span class='pill %s'>%s</span></div></div>"
                 % (DECK.get(key, key), n, cls, MODE.get(m, m)))
    h.append("</div>")
    nd = rep.get("next_days", {})
    if nd:
        h.append("<h3>The next two weeks</h3><div class='chart'>%s</div>" % bars(nd))
    units = rep.get("units", [])
    if units:
        rows = []
        for u in sorted(units, key=lambda u: (u["release"] or "9999", u["id"])):
            if u["total"] == 0:
                continue
            pct = 100 * u["seen"] / u["total"]
            rows.append("<tr><td class='small muted'>%s%s</td><td><span class='dot' style='display:inline-block;width:7px;height:7px;border-radius:50%%;"
                        "background:var(--%s);margin-right:6px'></span>%s</td><td class='nw'><span class='pb'><i style='width:%.0f%%'></i></span>"
                        "<span class='small muted'>%d/%d</span></td><td class='nw'>%s</td><td class='small nw'>%s</td><td><button class='ghost' "
                        "onclick=\"pycmd('y2:unit:%s')\">Browse</button></td></tr>"
                        % (fmt(u["release"], True), " · tbc" if u["tbc"] else "",
                           COLOR.get({"slides": "histo"}.get(u["track"], u["track"]), "all"), E(u["label"]), pct, u["seen"], u["total"],
                           fmt(u["finish"], True) if u["finish"] else "—", STATUS.get(u["status"], u["status"]), E(u["id"])))
        h.append("<h3>Units</h3><table class='u'><tr><th>Release</th><th>Unit</th><th>Learned</th><th>Planned finish</th><th>Status</th><th></th></tr>%s</table>"
                 % "".join(rows))
    h.append("<div class='actions' style='margin-top:14px'><button onclick=\"y2.cmd('y2:replan')\">Re-plan from today</button>"
             "<button class='ghost' onclick=\"y2.cmd('y2:run')\">Run now</button></div>")
    return "".join(h)


def bars(nd):
    keys = list(nd.keys())
    days = sorted({dd for k in keys for dd, n in nd[k]})[:14]
    vals = {k: dict(nd[k]) for k in keys}
    mx = max([sum(vals[k].get(dd, 0) for k in keys) for dd in days] + [1])
    W, H, gap, top = 1100, 120, 8, 16
    bw = (W - gap * (len(days) - 1)) / max(1, len(days))
    out = ["<svg viewBox='0 %d %d %d' width='100%%'>" % (-top, W, H + 34 + top)]
    colors = {"anking": "var(--accent)", "slides": "var(--hist)"}
    for i, dd in enumerate(days):
        x = i * (bw + gap)
        y = H
        for k in keys:
            n = vals[k].get(dd, 0)
            hgt = H * n / mx
            y -= hgt
            out.append("<rect x='%.1f' y='%.1f' width='%.1f' height='%.1f' rx='3' fill='%s' opacity='.85'><title>%s %s: %d</title></rect>"
                       % (x, y, bw, hgt, colors.get(k, "var(--muted)"), DECK.get(k, k), dd, n))
        tot = sum(vals[k].get(dd, 0) for k in keys)
        out.append("<text x='%.1f' y='%.1f' text-anchor='middle' font-size='10' fill='var(--muted)'>%d</text>" % (x + bw / 2, y - 3, tot))
        x_d = _dt.date.fromisoformat(dd)
        out.append("<text x='%.1f' y='%d' text-anchor='middle' font-size='10' fill='var(--muted)'>%s</text>"
                   "<text x='%.1f' y='%d' text-anchor='middle' font-size='10' fill='var(--muted)'>%d</text>"
                   % (x + bw / 2, H + 14, x_d.strftime("%a"), x + bw / 2, H + 27, x_d.day))
    out.append("</svg><div class='small muted'>%s</div>" % " &nbsp; ".join(
        "<span style='color:%s'>■</span> %s" % (colors.get(k, "var(--muted)"), DECK.get(k, k)) for k in keys))
    return "".join(out)


def uworld_html(cfg):
    return ("<h2>UWorld misses</h2><div class='lede'>Paste the question IDs you missed in a block, in any format. Their AnKing cards are "
            "unsuspended, put first and added on top of today's number.</div><div class='form'><textarea id='qids' placeholder='e.g. 2107, 10234, 11873'></textarea>"
            "<div class='row'><label style='min-width:auto'>Cards per question, at most</label><select id='qcap'>%s</select>"
            "<span style='flex:1'></span><button class='ghost' onclick=\"pycmd('y2:qidbrowse:'+document.getElementById('qids').value)\">Show in Browse</button>"
            "<button class='primary' onclick=\"y2.cmd('y2:qid:'+document.getElementById('qcap').value+':'+document.getElementById('qids').value)\">Unsuspend</button></div>"
            "<div class='result' id='qres'></div></div>" % "".join("<option value='%d'%s>%s</option>" % (n, " selected" if n == int(cfg.get("qid_cap_per_question", 5)) else "",
                                                                                                          "no limit" if n == 0 else n) for n in (3, 5, 8, 0)))


def settings_html(s, cfg):
    an = s.get("anatomy")
    return ("<h2>Settings</h2><div class='form'><h3 style='margin-top:0'>Cards</h3>"
            "<div class='row'><label>AnKing ceiling (new cards on a normal day)</label><input type='number' id='ceil' min='5' max='80' value='%d'></div>"
            "<div class='row'><label>Planned share of each day (spare capacity: the rest)</label><input type='number' id='res' min='0.5' max='1' step='0.05' value='%.2f'></div>"
            "<label class='switch'><input type='checkbox' id='conf'%s> Physiology cards wait for my OK after each test</label>"
            "<div class='row'><button class='primary' onclick=\"y2.cmd('y2:savecards:'+document.getElementById('ceil').value+':'+document.getElementById('res').value+':'+(document.getElementById('conf').checked?1:0))\">Save and re-plan from today</button></div></div>"
            "<div class='form'><h3 style='margin-top:0'>Deck screen</h3>"
            "<label class='switch'><input type='checkbox'%s onchange=\"pycmd('y2:panel:'+(this.checked?1:0))\"> Show the hub on the deck screen</label>"
            "<label class='switch'><input type='checkbox'%s%s onchange=\"pycmd('y2:appanel:'+(this.checked?1:0))\"> Hide the Anatomy Prime panel there (the hub already shows anatomy)</label></div>"
            "<button class='ghost' onclick=\"pycmd('y2:config')\">All settings (advanced)…</button>"
            % (int(cfg["ceiling"]["anking"]), float(cfg["reserve"]), " checked" if "physio" in cfg.get("confirm_tracks", []) else "",
               " checked" if cfg.get("show_panel", True) else "", " checked" if s.get("ap_hidden") else "",
               "" if an is not None else " disabled"))


GUIDE = """<h2>How to study with the hub</h2><div class='prose'>
<p>Every subject of year 2 is on one page: what to read, which questions to do, what is graded next and the cards of the day.
Tick tasks as you finish them. Anything still open from the last three days comes back under <i>Left from earlier days</i> while it is
still useful; prep for a test you've already sat drops out.</p>
<h3>Cards</h3><p>AnKing and SecondLook follow a plan that fits: each card has a day, and a day never holds more than 85% of its ceiling
(AnKing 25, 10 in Crunch weeks, 0 on Rest days, 1.5&times; in Push weeks). The rest is spare capacity. Missed cards are re-spread over it
(<i>catching up</i>); only when that is impossible does the plan move, and the hub names what moved. Anatomy cards stay with the Anatomy
Prime add-on: the hub shows its day and ticks its checklist.</p>
<h3>Physiology</h3><p>Questions are the engine. Monday Costanzo for the map, then the set Guyton pages in two halves. Wednesday a cold AI
course set and UWorld block 1. Thursday a second set on the misses. Friday the test and a recall page. Saturday the depth add-on.
Misses become cards in Misses::Physiology; AnKing physiology arrives after the test.</p>
<h3>Histology</h3><p>Thursday Wheater (images first), Friday Junqueira, Saturday draw each tissue and do the class's SecondLook sets, Sunday
an AI set. After the lab: miss cards, disease cards and a recall page within 24 hours. Slides are learned only from images.</p>
<h3>Embryology</h3><p>Saturday Before We Are Born, Monday the timeline, Tuesday an AI set, Wednesday the seminar, then malformation cards
(failed process &rarr; defect &rarr; presentation) and a recall page.</p>
<h3>USMLE Step 1</h3><p>Monday and Wednesday the week's First Aid pages, Tuesday Boards &amp; Beyond, blocks on Wednesday, Saturday and
Sunday. Paste every missed ID in <i>UWorld misses</i>. Crunch weeks: AnKing and one block. Rest weeks: AnKing only.</p>
<h3>Every day</h3><p>All reviews before new cards, Anki done by 22:00, sleep 7 hours. A broken day: due reviews, 10 questions in the subject
graded next, AnKing at most 30 minutes, then press <i>Light day</i>.</p>
<h3>Dates</h3><p>Dates marked <i>to confirm</i> are estimates. Change them in Subjects: tasks and cards move with them.</p></div>"""


# ====================================================================== deck-screen card
PANEL_CSS = r"""
#y2hub{--p:#fffdf8;--l:#e7dfcf;--l2:#efe8da;--i:#1f1b16;--m:#857a69;--a:#9a3f2b;--as:#f4e7df;--ok:#3f7a52;
 --anat:#9a3f2b;--phys:#2f5d7c;--hist:#6a4c93;--embr:#3f7a5a;--step:#a87418;
 max-width:760px;margin:14px auto 6px;text-align:left;background:var(--p);color:var(--i);border:1px solid var(--l);border-radius:14px;
 box-shadow:0 1px 2px rgba(60,40,10,.05),0 6px 18px rgba(60,40,10,.07);font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI","Inter",Arial,sans-serif;overflow:hidden}
.nightMode #y2hub,.night-mode #y2hub{--p:#1c1915;--l:#2f2a23;--l2:#28241e;--i:#ece5d8;--m:#958b7a;--a:#d47f63;--as:#33241e;--ok:#8cc29b;
 --anat:#d47f63;--phys:#7fb0d3;--hist:#b49ae0;--embr:#86c4a0;--step:#e0b45a;box-shadow:0 6px 18px rgba(0,0,0,.3)}
#y2hub .h{display:flex;align-items:center;gap:14px;padding:12px 16px 10px;cursor:pointer}
#y2hub .e{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--a)}
#y2hub .t{font:italic 400 21px/1.15 "Iowan Old Style",Charter,Georgia,serif}
#y2hub .r{margin-left:auto;text-align:right;color:var(--m);font-size:12px}
#y2hub .r b{color:var(--i);font-size:15px}
#y2hub .pb{height:3px;background:var(--l2)} #y2hub .pb i{display:block;height:3px;background:var(--a)}
#y2hub .chips{display:flex;gap:6px;flex-wrap:wrap;padding:10px 16px 2px}
#y2hub .chip{font-size:11.5px;padding:2px 9px;border-radius:999px;background:var(--l2);color:var(--i)}
#y2hub .chip.w{background:var(--as);color:var(--a)}
#y2hub table{width:100%;border-collapse:collapse;margin:6px 0 4px}
#y2hub td{padding:6px 16px;border-top:1px solid var(--l2);vertical-align:top}
#y2hub td.n{width:112px;white-space:nowrap;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--m)}
#y2hub .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;vertical-align:1px}
#y2hub td.x{color:var(--m);font-size:12px;text-align:right;white-space:nowrap}
#y2hub .ok{color:var(--ok)} #y2hub .mu{color:var(--m)}
#y2hub .f{display:flex;gap:8px;padding:8px 16px 12px;border-top:1px solid var(--l2)}
#y2hub .f a{font-size:12px;padding:4px 11px;border-radius:8px;border:1px solid var(--l);color:var(--i);text-decoration:none;cursor:pointer}
#y2hub .f a.p{background:var(--a);border-color:var(--a);color:#fff}
#y2hub .f a:hover{border-color:var(--a)}
"""


def panel(s, bits, rows, done, total, mins, leftovers, links):
    pct = 100 * done / total if total else 0
    chips = "".join("<span class='chip'>%s</span>" % b for b in bits)
    if leftovers:
        chips += "<span class='chip w'>%d left from earlier days</span>" % leftovers
    trs = "".join("<tr><td class='n'><span class='dot' style='background:var(--%s)'></span>%s</td><td>%s</td><td class='x'>%s</td></tr>"
                  % (COLOR[k], SHORT[k], what, nxt) for k, what, nxt in rows)
    lk = "".join("<a class='%s' onclick=\"pycmd('%s');return false;\">%s</a>" % ("p" if i == 0 else "", cmd, E(t))
                 for i, (t, cmd) in enumerate(links))
    return ("<style>%s</style><div id='y2hub'><div class='h' onclick=\"pycmd('y2hub:open')\"><div><div class='e'>❦ Year 2 Hub</div>"
            "<div class='t'>%s</div></div><div class='r'><b>%d/%d</b> tasks<br>%s left</div></div><div class='pb'><i style='width:%.0f%%'></i></div>"
            "<div class='chips'>%s</div><table>%s</table><div class='f'>%s</div></div>"
            % (PANEL_CSS, fmt(s["today"]), done, total, hm(mins), pct, chips, trs, lk))
