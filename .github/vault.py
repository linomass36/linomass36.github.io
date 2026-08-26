#!/usr/bin/env python3
"""
vault.py — the encryption half of the build.

The public repo and the public site both serve the same bytes, so the only
way to keep the hub private while keeping it on free hosting is to publish
ciphertext. This module does two jobs:

  1. INLINE.  A page that loads ./hub-data.js is only as private as
     hub-data.js. So every local script and stylesheet is folded into the
     page before encryption, and the plaintext asset is never shipped. After
     this pass a hub page has no local dependencies at all.

  2. ENCRYPT. The finished page is encrypted with AES-256-GCM under a key
     derived from the passphrase (PBKDF2-SHA256, 600k iterations) and
     re-emitted as a small shell that loads vault.js and carries the
     ciphertext in a script tag.

Passphrase comes from HUB_PASSPHRASE. Without it the build refuses rather
than silently shipping plaintext — a build that fails open is worse than no
build at all.
"""

import base64
import hashlib
import json
import os
import re
import secrets

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ITERATIONS = 600_000

# Served in the clear because they are needed before the passphrase exists,
# or because they carry nothing worth hiding.
PLAINTEXT = {
    "vault.js", "vault.json", "manifest.json", "sw.js", "version.txt",
    "robots.txt", ".nojekyll",
}
PLAINTEXT_DIRS = {"icons"}

SCRIPT_RE = re.compile(
    r'<script([^>]*?)\ssrc="(?!https?:|//)([^"?]+)(\?[^"]*)?"([^>]*)>\s*</script>',
    re.IGNORECASE)
LINK_RE = re.compile(
    r'<link([^>]*?)\shref="(?!https?:|//)([^"?]+\.css)(\?[^"]*)?"([^>]*?)>',
    re.IGNORECASE)


def salt_for(passphrase: str) -> bytes:
    """Derive the salt deterministically from the passphrase.

    A fresh random salt per build looked correct and was wrong here: it
    changes the derived key on every deploy, so a browser that had been told
    to stay unlocked fails verification the next time the site ships and
    silently forgets itself. Since every push redeploys, "remember this
    device" never survived more than one commit.

    Deterministic means the same passphrase always yields the same key, so a
    remembered device stays remembered across deploys, and changing the
    passphrase still invalidates every device — which is the behaviour you
    actually want from a rotation.

    A salt is not a secret; its job is to stop one precomputed table from
    covering every site. A per-passphrase salt still does that. What it gives
    up is uniqueness between two people who chose the same passphrase, which
    does not apply to a single-user hub. IVs remain random per file, so
    identical content still encrypts differently on every build.
    """
    return hashlib.sha256(b"ct-hub-vault-salt-v1|" + passphrase.encode("utf-8")).digest()[:16]


def derive(passphrase: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", passphrase.encode("utf-8"), salt, ITERATIONS, 32)


def seal(key: bytes, plaintext: str) -> str:
    """IV || ciphertext, base64. Fresh IV per file — GCM is catastrophic on reuse."""
    iv = secrets.token_bytes(12)
    body = AESGCM(key).encrypt(iv, plaintext.encode("utf-8"), None)
    return base64.b64encode(iv + body).decode("ascii")


def _read(site: str, ref: str, base_dir: str):
    """Resolve a local asset reference against the page, then the site root."""
    ref = ref.lstrip("./")
    for cand in (os.path.join(base_dir, ref), os.path.join(site, ref)):
        if os.path.isfile(cand):
            with open(cand, "r", encoding="utf-8", errors="replace") as f:
                return f.read()
    return None


def _guard(js: str) -> str:
    """`</script>` inside JS would close the tag that carries it."""
    return js.replace("</script", "<\\/script").replace("<!--", "<\\!--")


def inline_assets(html: str, site: str, base_dir: str) -> str:
    """Fold local .js and .css into the document. Execution order is preserved
    because each tag is replaced where it stands."""
    def js_sub(m):
        attrs = (m.group(1) or "") + (m.group(4) or "")
        body = _read(site, m.group(2), base_dir)
        if body is None:
            return m.group(0)
        keep = " ".join(a for a in attrs.split() if a.lower().startswith(("type=", "defer", "async")))
        return "<script %s>\n%s\n</script>" % (keep, _guard(body))

    def css_sub(m):
        body = _read(site, m.group(2), base_dir)
        if body is None:
            return m.group(0)
        return "<style>\n%s\n</style>" % body.replace("</style", "<\\/style")

    html = SCRIPT_RE.sub(js_sub, html)
    html = LINK_RE.sub(css_sub, html)
    return html


SHELL = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Locked</title>
<meta name="robots" content="noindex, nofollow">
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#993C1D">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="CT Hub">
<link rel="apple-touch-icon" href="icons/apple-touch-180.png">
</head>
<body>
<script id="vault-payload" type="application/octet-stream">%(payload)s</script>
<script src="vault.js?v=%(version)s"></script>
</body>
</html>
"""


def shell_for(payload: str, version: str) -> str:
    return SHELL % {"payload": payload, "version": version}


def is_plaintext(rel: str) -> bool:
    parts = rel.replace("\\", "/").split("/")
    if parts[0] in PLAINTEXT_DIRS:
        return True
    return parts[-1] in PLAINTEXT


def write_meta(site: str, key: bytes, salt: bytes) -> None:
    """vault.json is public by design: a salt is not a secret, and the
    verifier only proves a passphrase is right — it reveals nothing about
    what it opens."""
    meta = {
        "v": 1,
        "kdf": {"name": "PBKDF2", "hash": "SHA-256", "iterations": ITERATIONS},
        "cipher": "AES-256-GCM",
        "salt": base64.b64encode(salt).decode("ascii"),
        "verifier": seal(key, "ct-hub-vault-ok"),
    }
    with open(os.path.join(site, "vault.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
