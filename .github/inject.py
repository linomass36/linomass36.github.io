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

# The two scripts every hub page needs, in order (sync depends on APP_CONFIG).
SHIM = (
    '<script src="./config.js"></script>\n'
    '<script src="./sync.js"></script>\n'
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


def inject_shim(text):
    """Insert config.js + sync.js once, as late in <head> as possible."""
    if "./sync.js" in text:
        return text  # already injected — stay idempotent
    # Prefer the very end of <head>; fall back to the </helmet> block the
    # DC runtime hoists into <head>.
    for anchor in ("</head>", "</helmet>"):
        idx = text.lower().find(anchor)
        if idx != -1:
            return text[:idx] + SHIM + text[idx:]
    return text  # no head at all — leave it untouched


def process_html(path, version, is_gate):
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    text = stamp_version(text, version)
    if not is_gate:
        text = inject_shim(text)
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
