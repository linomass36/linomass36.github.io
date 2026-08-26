#!/usr/bin/env python3
"""
verify_vault.py — the check that runs after the build and before the deploy.

The vault is only worth having if it cannot fail open, so this asserts the
properties that matter rather than trusting inject.py to have done its job.
Exits non-zero on any failure, which fails the workflow before Pages
publishes.

A note on the canary sweep: ciphertext is base64, and base64 is drawn from an
alphabet that contains ordinary English letters, so a short canary like
"PSLF" turns up inside a 200 KB payload by pure chance. Scanning the payload
therefore proves nothing and cries wolf. Every page is split into shell and
payload, and only the shell — the part a reader can actually read — is swept.
"""

import base64
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "_site")

# Files that ship in the clear: needed before the passphrase exists, or
# carrying nothing worth hiding.
ALLOWED = {
    "vault.js", "vault.json", "manifest.json", "sw.js", "version.txt",
    "robots.txt", ".nojekyll",
}
ALLOWED_DIRS = {"icons"}

PAYLOAD_RE = re.compile(
    r'<script id="vault-payload"[^>]*>(.*?)</script>', re.S)

# Content that must never be readable. Chosen to be specific to this hub's
# data rather than to web infrastructure, so a hostname in sw.js does not
# masquerade as a leak.
CANARIES = [
    "PLAN_V2", "HUB_DATA", "PLAN_DATA", "PLAN_EXTRAS", "GRIND",
    "authorizedEmail", "staniszewski",
    "forcingFunction", "Step 2 CK", "Grad PLUS", "gastric",
    "Polkowski", "Rawicz", "Barczewski", "Zembala",
]

# Minimum plausible size for a real page's ciphertext. A shell carrying a few
# hundred bytes would mean the page was emptied rather than encrypted.
MIN_PAYLOAD = 512


def fail(msg):
    print("[verify] FAIL:", msg)
    return 1


def main():
    if not os.path.isdir(SITE):
        return fail("_site does not exist")

    problems = 0
    pages = 0
    sealed_bytes = 0

    for dirpath, _dirs, files in os.walk(SITE):
        for name in files:
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, SITE).replace("\\", "/")
            top = rel.split("/")[0]
            allowed = top in ALLOWED_DIRS or name in ALLOWED

            if not name.lower().endswith((".html", ".htm")):
                if not allowed:
                    problems += fail("plaintext asset shipped: %s" % rel)
                continue

            pages += 1
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                text = f.read()

            m = PAYLOAD_RE.search(text)
            if not m:
                problems += fail("page is not encrypted: %s" % rel)
                continue
            if "vault.js" not in text:
                problems += fail("page has no decryptor: %s" % rel)

            payload = m.group(1).strip()
            try:
                raw = base64.b64decode(payload, validate=True)
            except Exception as exc:
                problems += fail("payload is not valid base64 in %s (%s)" % (rel, exc))
                continue
            if len(raw) < MIN_PAYLOAD:
                problems += fail("payload suspiciously small (%d bytes): %s" % (len(raw), rel))
            sealed_bytes += len(raw)

            # Only the readable half is swept — see the module docstring.
            shell = text[:m.start()] + text[m.end():]
            for c in CANARIES:
                if c.lower() in shell.lower():
                    problems += fail("canary %r readable in the shell of %s" % (c, rel))

    # Sweep the files that ship in the clear.
    for name in sorted(ALLOWED):
        path = os.path.join(SITE, name)
        if not os.path.isfile(path):
            continue
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
        for c in CANARIES:
            if c.lower() in text.lower():
                problems += fail("canary %r found in plaintext file %s" % (c, name))

    if not pages:
        return fail("no pages were built at all")
    if not os.path.isfile(os.path.join(SITE, "vault.json")):
        return fail("vault.json is missing — nothing could ever be unlocked")
    if problems:
        print("[verify] %d problem(s) — refusing to deploy" % problems)
        return 1

    print("[verify] OK — %d pages, %.1f MB sealed, no readable content, "
          "%d plaintext files (all allow-listed)"
          % (pages, sealed_bytes / 1048576.0,
             sum(1 for n in ALLOWED if os.path.isfile(os.path.join(SITE, n)))))
    return 0


if __name__ == "__main__":
    sys.exit(main())
