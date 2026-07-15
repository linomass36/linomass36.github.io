#!/usr/bin/env python3
"""
inject.py — build step for the hub.

Copies the repository into ./_site and, on the way, does three things so the
raw exported files never have to be hand-edited:

  1. Turns the gate into the front door:  index.dc.html -> index.html
  2. Injects config.js + sync.js into every HUB page (everything except the
     gate), giving them cross-device sync + the owner-only guard.
  3. Stamps the current version (read from the VERSION file, or the
     APP_VERSION env var if set by the workflow) into every page by replacing
     the __APP_VERSION__ token.

Run from the repo root:  python3 .github/inject.py
The GitHub Action calls it at build time and deploys _site/ to Pages.
"""

import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "_site")

# Files/dirs that must never ship to the live site.
SKIP_TOP = {".git", ".github", "_site", "DEPLOY.md", "VERSION", ".gitignore"}

# The gate. It already loads config.js + firebase itself and runs the
# sign-in / intruder flow, so it must NOT get the hub sync shim.
GATE_SOURCE = "index.dc.html"   # renamed to index.html in the build
GATE_OUTPUT = "index.html"

# The scripts every hub page needs, in order (sync + nav depend on APP_CONFIG).
SHIM = (
    '<script src="./config.js"></script>\n'
    '<script src="./sync.js"></script>\n'
    '<script src="./nav.js"></script>\n'
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
VERSION_CHECK = (
    "<script>(function(){var B=\"__APP_VERSION__\";try{"
    "fetch(\"version.txt?_=\"+Date.now(),{cache:\"no-store\"})"
    ".then(function(r){return r.ok?r.text():null;})"
    ".then(function(v){if(!v)return;v=v.trim();if(!v||v===B)return;"
    "var k=\"__ver_reload_\"+v;if(sessionStorage.getItem(k))return;"
    "sessionStorage.setItem(k,\"1\");"
    "location.replace(location.pathname+\"?v=\"+encodeURIComponent(v)+location.hash);"
    "}).catch(function(){});}catch(e){}})();</script>\n"
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


# PWA head + service-worker registration. Goes on EVERY page (gate included)
# so the hub is installable to the home screen and updates in place.
PWA_HEAD = (
    '<link rel="manifest" href="manifest.json">\n'
    '<meta name="theme-color" content="#993C1D">\n'
    '<meta name="apple-mobile-web-app-capable" content="yes">\n'
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
    '<meta name="apple-mobile-web-app-title" content="CT Hub">\n'
    '<link rel="apple-touch-icon" href="icons/apple-touch-180.png">\n'
    "<script>if('serviceWorker' in navigator){addEventListener('load',function(){"
    "navigator.serviceWorker.register('sw.js').catch(function(){});});}</script>\n"
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
    text = add_viewport_fit(text)
    if "manifest.json" not in text:
        text = insert_head(text, PWA_HEAD)
    if not is_gate:
        text = inject_shim(text)
        text = insert_head(text, THEME_BOOT)
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

    print("[inject] done — hub pages carry sync.js, gate left clean.")


if __name__ == "__main__":
    build()
    sys.exit(0)
