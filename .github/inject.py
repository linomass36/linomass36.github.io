#!/usr/bin/env python3
"""
inject.py — build step for the hub.

Copies the repository into ./_site and, on the way, does three things so the
raw exported files never have to be hand-edited:

  1. Turns the gate into the front door:  index.dc.html -> index.html
  2. Injects config.js + archive.js + backup.js + sync.js into every HUB page (everything except the
     gate), giving them cross-device sync + the owner-only guard.
  3. Stamps the current version (read from the VERSION file, or the
     APP_VERSION env var if set by the workflow) into every page by replacing
     the __APP_VERSION__ token.

Run from the repo root:  python3 .github/inject.py
The GitHub Action calls it at build time and deploys _site/ to Pages.
"""

import json
import os
import re
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vault

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "_site")

# Files/dirs that must never ship to the live site.
SKIP_TOP = {".git", ".github", "_site", "DEPLOY.md", "VAULT.md", "CLAUDE.md", "VERSION",
            ".gitignore", "node_modules"}

# The gate. It already loads config.js + firebase itself and runs the
# sign-in / intruder flow, so it must NOT get the hub sync shim.
GATE_SOURCE = "index.dc.html"   # renamed to index.html in the build
GATE_OUTPUT = "index.html"

# ── the phone layer, on every page ───────────────────────────────────────
# mobile.css was linked by each page individually, and FOURTEEN never linked
# it — Standing.html among them, which is the manifest's start_url and so the
# first thing the installed app opens. Everything in that file was therefore
# absent from the home-screen app: the safe-area insets that keep content out
# from under the status bar, the tap-target floors, the 16px inputs that stop
# iOS zooming on focus, and dark mode.
#
# It is injected rather than linked for the same reason the scripts are: a
# stylesheet every page needs, added by hand to each page, is a stylesheet
# some pages will not have. Idempotent — a page that already links it is left
# alone, and it goes in FIRST so a page's own <style> still wins on anything
# it deliberately overrides.
#
# hub.css is deliberately NOT here. It is a full visual system rather than a
# layer, and the .dc.html exports carry their own; injecting it everywhere
# would restyle pages that never asked for it. See tabs.js, which shipped
# broken on exactly that assumption.
STYLE_SHIM = '<link rel="stylesheet" href="./mobile.css">\n'

# The scripts every hub page needs, in order (sync + nav depend on APP_CONFIG).
SHIM = (
    '<script src="./config.js"></script>\n'
    '<script src="./conditions.js"></script>\n'
    '<script src="./money.js"></script>\n'
    '<script src="./feeds.js"></script>\n'
    '<script src="./archive.js"></script>\n'
    '<script src="./backup.js"></script>\n'
    '<script src="./sync.js"></script>\n'
    '<script src="./sitemap.js"></script>\n'
    '<script src="./screen.js"></script>\n'
    '<script src="./facts.js"></script>\n'
    '<script src="./contact.js"></script>\n'
    # wait.js before mornings.js: the overlay reads window.Wait for the send
    # date and the week rather than keeping a second copy of either.
    '<script src="./wait.js"></script>\n'
    '<script src="./mornings.js"></script>\n'
    '<script src="./calendar.js"></script>\n'
    '<script src="./training.js"></script>\n'
    '<script src="./tabs.js"></script>\n'
    '<script src="./tour.js"></script>\n'
    '<script src="./plates.js"></script>\n'
    '<script src="./nav.js"></script>\n'
    '<script src="./upbar.js"></script>\n'
    '<script src="./capture.js"></script>\n'
)

# Written to the site root at build time; the freshest version number, fetched
# with cache:'no-store' so it always bypasses the browser cache.
VERSION_FILE = "version.txt"

# Injected into every hub page. Mobile browsers cache the HTML aggressively, so
# a page can keep showing an old version after a deploy. This checks the live
# version.txt (uncached) against the version baked into THIS page and, if they
# differ, reloads once with a cache-busting query so fresh HTML is fetched.
# The sessionStorage guard makes it reload at most once per version per session,
# so it can never loop.
#
# Checking only at load isn't enough on a phone: the normal way a phone "uses"
# a tab is to background it and come back, not to reload it, so a tab left
# open across a deploy would run the old JS (old sync.js included) for as
# long as it stayed open — which looks exactly like "I shipped a fix and nothing
# changed" from the outside. So the same check also runs on visibilitychange
# and pageshow (the bfcache-restore event neither fires a normal load nor
# visibilitychange on some browsers), catching the tab back up the moment it's
# looked at again, not just the moment it was opened.
VERSION_CHECK = (
    "<script>(function(){var B=\"__APP_VERSION__\",checking=false;function check(){"
    "if(checking)return;checking=true;try{"
    "fetch(\"version.txt?_=\"+Date.now(),{cache:\"no-store\"})"
    ".then(function(r){return r.ok?r.text():null;})"
    ".then(function(v){checking=false;if(!v)return;v=v.trim();if(!v||v===B)return;"
    "var k=\"__ver_reload_\"+v;if(sessionStorage.getItem(k))return;"
    "sessionStorage.setItem(k,\"1\");"
    "location.replace(location.pathname+\"?v=\"+encodeURIComponent(v)+location.hash);"
    "}).catch(function(){checking=false;});}catch(e){checking=false;}}"
    "check();"
    "document.addEventListener(\"visibilitychange\",function(){if(!document.hidden)check();});"
    "addEventListener(\"pageshow\",check);"
    "})();</script>\n"
)


def read_version():
    env = os.environ.get("APP_VERSION")
    if env:
        return env.strip()
    try:
        with open(os.path.join(ROOT, "VERSION"), "r", encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return "0.0"


def stamp_version(text, version):
    return text.replace("__APP_VERSION__", version)


# Local .js/.css references get a per-version query so a new deploy always
# fetches fresh assets (e.g. the version badge in mobile.css) instead of a
# stale cached copy. External URLs (https:, //) are left alone.
ASSET_RE = re.compile(r'(src|href)="(?!https?:|//)([^"?]+\.(?:js|css))"')


def cachebust(text):
    return ASSET_RE.sub(r'\1="\2?v=__APP_VERSION__"', text)


# PWA head. Goes on EVERY page (gate included) so the hub is installable to
# the home screen (icon + full-screen launch), and registers sw.js.
#
# The worker used to be cache-first, which made installed apps serve stale
# content, so it was ripped out and this snippet unregistered it. It is back,
# but network-first: online it never answers from cache, it only keeps a copy
# of what the network returned, and that copy is used when — and only when —
# a fetch actually fails. See sw.js. Registration waits for load so it never
# competes with the page's own scripts for the connection.
PWA_HEAD = (
    '<link rel="manifest" href="manifest.json">\n'
    '<meta name="theme-color" content="#993C1D">\n'
    '<meta name="apple-mobile-web-app-capable" content="yes">\n'
    '<meta name="mobile-web-app-capable" content="yes">\n'
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
    '<meta name="apple-mobile-web-app-title" content="CT Hub">\n'
    '<link rel="apple-touch-icon" href="icons/apple-touch-180.png">\n'
    "<script>if('serviceWorker' in navigator){try{"
    "addEventListener('load',function(){"
    "navigator.serviceWorker.register('sw.js?v=__APP_VERSION__')"
    ".catch(function(){});});}catch(e){}}</script>\n"
)

# Applies the saved theme before first paint (no flash), on hub pages.
THEME_BOOT = (
    "<script>try{if(localStorage.getItem('hub_theme_v1')==='dark')"
    "document.documentElement.classList.add('hb-dark');}catch(e){}</script>\n"
)

# Add viewport-fit=cover so the CSS env(safe-area-inset-*) values become live
# on notched phones (otherwise they resolve to 0 and the insets do nothing).
VIEWPORT_RE = re.compile(
    r'(<meta[^>]*name="viewport"[^>]*content=")([^"]*)(")', re.IGNORECASE
)


def add_viewport_fit(text):
    def repl(m):
        content = m.group(2)
        if "viewport-fit" in content:
            return m.group(0)
        return m.group(1) + content + ", viewport-fit=cover" + m.group(3)
    return VIEWPORT_RE.sub(repl, text)


def insert_head(text, payload):
    """Insert payload as late in <head> as possible."""
    for anchor in ("</head>", "</helmet>"):
        idx = text.lower().find(anchor)
        if idx != -1:
            return text[:idx] + payload + text[idx:]
    return text


# ── Bundler pages (CT Master Plan) ───────────────────────────────
# These pages carry their real document as JSON in a
# <script type="__bundler/template"> block; at boot the runtime parses it and
# replaces document.documentElement with it, wiping the outer <head> — and with
# it mobile.css and every shim we injected there. Links load and scripts are
# re-created & executed by the runtime, so the fix is to inject our payload
# into the INNER template head, JSON-escaped. The outer page then only needs
# the PWA/viewport tags (it's on screen for a second while unpacking).
BUNDLER_MARK = '<script type="__bundler/template">'

# The inner payload. Cache-busting is written literally (?v=token) because the
# outer cachebust() regex can't see through JSON escaping; stamp_version() runs
# on the whole file afterwards, so the token resolves inside the JSON too.
# The viewport meta re-declares viewport-fit=cover — a later meta wins, which
# saves us from regex-editing the escaped inner one.
BUNDLER_HEAD = (
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    '<link rel="stylesheet" href="./hub.css?v=__APP_VERSION__">\n'
    '<link rel="stylesheet" href="./mobile.css?v=__APP_VERSION__">\n'
    '<script src="./config.js?v=__APP_VERSION__"></script>\n'
    '<script src="./archive.js?v=__APP_VERSION__"></script>\n'
    '<script src="./backup.js?v=__APP_VERSION__"></script>\n'
    '<script src="./sync.js?v=__APP_VERSION__"></script>\n'
    '<script src="./sitemap.js?v=__APP_VERSION__"></script>\n'
    '<script src="./facts.js?v=__APP_VERSION__"></script>\n'
    '<script src="./contact.js?v=__APP_VERSION__"></script>\n'
    '<script src="./wait.js?v=__APP_VERSION__"></script>\n'
    '<script src="./mornings.js?v=__APP_VERSION__"></script>\n'
    '<script src="./calendar.js?v=__APP_VERSION__"></script>\n'
    '<script src="./training.js?v=__APP_VERSION__"></script>\n'
    '<script src="./tabs.js?v=__APP_VERSION__"></script>\n'
    '<script src="./tour.js?v=__APP_VERSION__"></script>\n'
    '<script src="./plates.js?v=__APP_VERSION__"></script>\n'
    '<script src="./nav.js?v=__APP_VERSION__"></script>\n'
    '<script src="./upbar.js?v=__APP_VERSION__"></script>\n'
    '<script src="./capture.js?v=__APP_VERSION__"></script>\n'
)


def esc_json(s):
    """Escape a fragment for insertion inside a JSON string literal. Every '/'
    becomes the (legal) '\\/' escape, which also neutralizes '</script>' for
    the outer HTML parser."""
    return (s.replace("\\", "\\\\")
             .replace('"', '\\"')
             .replace("/", "\\/")
             .replace("\n", "\\n"))


def inject_into_bundler(text):
    start = text.find(BUNDLER_MARK)
    if start == -1:
        return text
    start += len(BUNDLER_MARK)
    end = text.find("</script>", start)  # JSON escapes its own </script>s
    if end == -1:
        return text
    block = text[start:end]
    if "sync.js" in block:
        return text  # already injected — stay idempotent
    payload = esc_json(BUNDLER_HEAD + THEME_BOOT + VERSION_CHECK)
    idx = block.find("</head>")
    if idx == -1:
        idx = block.find("<\\/head>")
    if idx == -1:
        return text
    block = block[:idx] + payload + block[idx:]
    return text[:start] + block + text[end:]


def inject_shim(text):
    """Insert config.js + sync.js + the version self-heal check once, as late
    in <head> as possible. Leaves the __APP_VERSION__ token for stamp_version."""
    if "./sync.js" in text:
        return text  # already injected — stay idempotent
    return insert_head(text, SHIM + VERSION_CHECK)


def process_html(path, version, is_gate):
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    # Inject first (shims carry __APP_VERSION__ tokens), cache-bust local asset
    # URLs, then stamp so everything gets the real version number.
    is_bundler = BUNDLER_MARK in text
    text = add_viewport_fit(text)
    if "manifest.json" not in text:
        text = insert_head(text, PWA_HEAD)
    if not is_gate:
        if is_bundler:
            # The runtime rewrites the document from the inner template, so the
            # shims must live THERE (outer copies would be wiped / double-run).
            text = inject_into_bundler(text)
        else:
            text = inject_shim(text)
            text = insert_head(text, THEME_BOOT)
    # OUTSIDE the is_gate guard, deliberately. The gate is excluded from the
    # shim because it runs its own sign-in flow and must not get the hub's
    # sync layer — that is a reason about SCRIPTS. It is served edge-to-edge
    # like every other page (add_viewport_fit above does not skip it), so
    # without this the sign-in screen is the one page still sitting under the
    # notch.
    #
    # Last insertion wins the parse order: insert_head puts each payload just
    # before </head>, so this ends up after the shims in the file and a page's
    # own <style> still overrides it where it means to.
    if "mobile.css" not in text:
        text = insert_head(text, STYLE_SHIM)
    text = cachebust(text)
    text = stamp_version(text, version)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def process_text_asset(path, version):
    """Stamp the version token into JS/CSS assets too (e.g. config.js)."""
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    if "__APP_VERSION__" not in text:
        return
    with open(path, "w", encoding="utf-8") as f:
        f.write(stamp_version(text, version))


MD_SHELL = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>%(title)s</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="./mobile.css">
<link rel="stylesheet" href="./plan-v2.css">
<style>
  .md{max-width:820px;margin:0 auto;padding:calc(20px + env(safe-area-inset-top,0px)) 18px 140px;
      font-family:var(--sans);color:var(--ink);font-size:15.5px;line-height:1.65}
  .md h1{font-family:var(--serif);font-size:34px;font-weight:500;line-height:1.12;margin:6px 0 12px}
  .md h2{font-family:var(--serif);font-size:23px;font-weight:500;margin:36px 0 8px;
         padding-top:20px;border-top:1px solid var(--rule)}
  .md h3{font-size:15.5px;font-weight:600;margin:22px 0 6px}
  .md p{color:var(--mid);max-width:64ch}
  .md li{color:var(--mid);margin-bottom:5px}
  .md strong{color:var(--ink)}
  .md code{font-family:var(--mono);font-size:12.8px;background:var(--rust-dim);
           color:var(--rust);padding:1px 5px;border-radius:5px}
  .md blockquote{margin:14px 0;padding:11px 15px;border-left:3px solid var(--rule);
                 background:var(--card);border-radius:0 11px 11px 0;color:var(--mid)}
  .md table{border-collapse:collapse;width:100%%;min-width:460px;font-size:13.8px}
  .md .tw{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:12px 0 16px;
          border:1px solid var(--rule);border-radius:14px;background:var(--card)}
  .md th{font-family:var(--mono);font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;
         color:var(--muted);text-align:left;padding:11px 13px;border-bottom:1px solid var(--rule)}
  .md td{padding:11px 13px;border-bottom:1px solid var(--rule);color:var(--mid);vertical-align:top}
  .md hr{border:0;border-top:1px solid var(--rule);margin:30px 0}
  .md a{color:var(--rust)}
</style>
</head>
<body><div class="md">%(body)s</div></body>
</html>
"""


def render_markdown(site):
    """Render every .md in the site into a hub page, then drop the source.

    A .md file cannot decrypt itself, so shipping one would either leave a
    plaintext hole in an otherwise encrypted site or 404 after the vault
    pass removes it. Rendering it into a real page closes both.
    """
    try:
        import markdown as md
    except ImportError:
        print("[inject] WARNING: python-markdown missing; .md files will be dropped")
        md = None
    made = 0
    for dirpath, _dirs, files in os.walk(site):
        for name in files:
            if not name.lower().endswith(".md"):
                continue
            src = os.path.join(dirpath, name)
            if md is not None:
                with open(src, "r", encoding="utf-8") as f:
                    text = f.read()
                html = md.markdown(text, extensions=["tables", "fenced_code", "sane_lists"])
                html = html.replace("<table>", '<div class="tw"><table>').replace("</table>", "</table></div>")
                title = name[:-3]
                for line in text.splitlines():
                    if line.startswith("# "):
                        title = line[2:].strip()
                        break
                out = os.path.join(dirpath, name[:-3] + ".html")
                with open(out, "w", encoding="utf-8") as f:
                    f.write(MD_SHELL % {"title": title, "body": html})
                made += 1
            os.remove(src)
    if made:
        print("[inject] rendered %d markdown page(s) into HTML" % made)


def strip_docs_from_asset_dirs(site):
    """The directories that ship in the clear ship only assets.

    plates/ and fonts/ each carry a README for whoever adds a file to them.
    Those are notes to a maintainer, not part of the site: rendered to HTML
    and left unencrypted in a plaintext directory, they are the one thing the
    verifier is right to refuse. The note stays in the repository, where it
    is read; it just does not deploy.
    """
    for d in sorted(vault.PLAINTEXT_DIRS):
        here = os.path.join(site, d)
        if not os.path.isdir(here):
            continue
        for name in os.listdir(here):
            if name.lower().endswith((".md", ".markdown", ".txt")):
                os.remove(os.path.join(here, name))
                print("[inject] %s/%s is documentation — not deployed" % (d, name))


def write_plates_index(site):
    """List what is actually in plates/, so the site never has to guess.

    plates.js falls back to probing for each catalogued filename when this
    file is absent — which works, but costs a burst of 404s on every page
    load. The build knows the answer for free, so it writes it down. A
    painting added to the repository appears in the next deploy's index; one
    removed disappears from it. Nothing to maintain by hand.
    """
    d = os.path.join(site, "plates")
    if not os.path.isdir(d):
        return
    exts = (".jpg", ".jpeg", ".png", ".webp")
    names = sorted(
        n for n in os.listdir(d)
        if n.lower().endswith(exts) and os.path.isfile(os.path.join(d, n))
    )
    with open(os.path.join(d, "index.json"), "w", encoding="utf-8") as f:
        json.dump(names, f, indent=0)
        f.write("\n")
    print("[inject] plates/index.json lists %d picture(s)" % len(names))


def build():
    version = read_version()
    print("[inject] building _site for version", version)

    if os.path.isdir(SITE):
        shutil.rmtree(SITE)
    os.makedirs(SITE)

    # Copy everything worth shipping into _site.
    for name in os.listdir(ROOT):
        if name in SKIP_TOP:
            continue
        src = os.path.join(ROOT, name)
        dst = os.path.join(SITE, name)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)

    # Drop the freshest version number at the site root for the self-heal check.
    with open(os.path.join(SITE, VERSION_FILE), "w", encoding="utf-8") as f:
        f.write(version + "\n")

    strip_docs_from_asset_dirs(SITE)
    write_plates_index(SITE)

    # Markdown -> HTML before the HTML pass, so rendered pages get the shims
    # and are encrypted with everything else.
    render_markdown(SITE)

    # Gate: index.dc.html becomes index.html (overwriting the committed copy).
    gate_src = os.path.join(SITE, GATE_SOURCE)
    if os.path.isfile(gate_src):
        shutil.move(gate_src, os.path.join(SITE, GATE_OUTPUT))

    # Walk the built tree and process files.
    for dirpath, _dirs, files in os.walk(SITE):
        for name in files:
            path = os.path.join(dirpath, name)
            lower = name.lower()
            if lower.endswith((".html", ".htm")):
                is_gate = os.path.abspath(path) == os.path.abspath(
                    os.path.join(SITE, GATE_OUTPUT)
                )
                process_html(path, version, is_gate)
            elif lower.endswith((".js", ".css")):
                process_text_asset(path, version)

    print("[inject] pages built — applying the vault")
    lock(version)


def lock(version):
    """Encrypt the built site in place.

    Every page is inlined (so it has no local dependencies), encrypted, and
    replaced by a shell that loads vault.js. Every plaintext asset that is
    not needed before unlock is then deleted, because leaving hub-data.js on
    disk would make encrypting the page that reads it pointless.

    Refuses to run without HUB_PASSPHRASE. A build that quietly falls back to
    plaintext is the exact failure this whole mechanism exists to prevent —
    so an unset passphrase is a hard error, not a warning.
    """
    passphrase = os.environ.get("HUB_PASSPHRASE", "")
    if not passphrase:
        sys.exit(
            "[inject] FATAL: HUB_PASSPHRASE is not set.\n"
            "         The site would ship in plaintext to a public origin.\n"
            "         Set the HUB_PASSPHRASE repository secret (Settings -> \n"
            "         Secrets and variables -> Actions), or export it locally."
        )
    if len(passphrase) < 12:
        sys.exit("[inject] FATAL: HUB_PASSPHRASE is under 12 characters. "
                 "The passphrase is the only thing protecting the site.")

    # Deterministic, not random — see vault.salt_for(). A random salt per
    # build silently un-remembers every device on every deploy.
    salt = vault.salt_for(passphrase)
    key = vault.derive(passphrase, salt)
    vault.write_meta(SITE, key, salt)

    # Copy the decryptor in as a plaintext asset, stamped like the rest.
    src = os.path.join(ROOT, "vault.js")
    if os.path.isfile(src):
        with open(src, "r", encoding="utf-8") as f:
            vjs = stamp_version(f.read(), version)
        with open(os.path.join(SITE, "vault.js"), "w", encoding="utf-8") as f:
            f.write(vjs)

    sealed, cleared = 0, 0
    for dirpath, _dirs, files in os.walk(SITE):
        for name in files:
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, SITE)
            if vault.is_plaintext(rel):
                continue
            if name.lower().endswith((".html", ".htm")):
                with open(path, "r", encoding="utf-8", errors="replace") as f:
                    html = f.read()
                html = vault.inline_assets(html, SITE, dirpath)
                with open(path, "w", encoding="utf-8") as f:
                    f.write(vault.shell_for(vault.seal(key, html), version))
                sealed += 1

    # Second pass: nothing else ships. Anything a page needed is now inside it.
    for dirpath, _dirs, files in list(os.walk(SITE, topdown=False)):
        for name in files:
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, SITE)
            if vault.is_plaintext(rel) or name.lower().endswith((".html", ".htm")):
                continue
            os.remove(path)
            cleared += 1
        if not os.listdir(dirpath) and os.path.abspath(dirpath) != os.path.abspath(SITE):
            os.rmdir(dirpath)

    print("[inject] vault: %d pages encrypted, %d plaintext assets removed"
          % (sealed, cleared))
    print("[inject] done — the published site is ciphertext.")


if __name__ == "__main__":
    build()
    sys.exit(0)
