# The vault — how this hub stays private on public hosting

**Read this before changing the build.** The hub contains a decade of personal
planning, real names, and a full debt model. It is published from a public
GitHub Pages origin. The only thing between the two is described here.

---

## The problem

Three facts, all of which are permanent:

1. **GitHub Pages on a Free account requires a public repository.** Making the
   repo private turns the site off.
2. **The site serves whatever is in `_site/`, to anyone.** There is no server
   to put a password in front of.
3. **The old auth gate was decorative.** `sync.js` redirects a visitor who is
   not the authorized Google account — but that is JavaScript running in *their*
   browser, after the HTML has already been delivered. `curl` never runs it:

   ```
   curl https://linomass36.github.io/Standing.html   # used to print everything
   ```

So the content could not be hidden by asking nicely. It had to be unreadable.

## The fix

Everything is encrypted at build time and decrypted in your browser.

```
 repo (plaintext)  ──►  inject.py  ──►  _site/ (ciphertext)  ──►  Pages
                          │                                        │
                     inline + seal                            vault.js
                                                                   │
                                                          passphrase ─► plaintext
```

A stranger fetching any page gets this and nothing else:

```html
<script id="vault-payload" type="application/octet-stream">LD1hH9JzW7C18ye7…</script>
<script src="vault.js"></script>
```

### Crypto

| | |
|---|---|
| Key derivation | PBKDF2-SHA256, **600,000** iterations, 32-byte key |
| Cipher | **AES-256-GCM** |
| Salt | 16 bytes, fresh **per build**, published in `vault.json` |
| IV | 12 bytes, fresh **per file** |
| Verifier | a known string sealed under the same key |

The salt being public is not a weakness — that is what a salt is for. It stops
precomputed tables; it is not a secret. **Security rests entirely on the
passphrase.** A weak passphrase is a weak site, and no amount of iteration
count fixes that.

600k iterations costs an attacker real time per guess. It also costs *you* about
a second on a phone, which is why the derived key — never the passphrase — is
cached in `sessionStorage`, and in `localStorage` if you tick "stay unlocked".

### Inlining, and why it is not optional

A page that loads `./hub-data.js` is only as private as `hub-data.js`. Encrypting
the page while shipping the data file beside it would protect nothing. So before
sealing, every local `<script src>` and `<link rel=stylesheet>` is folded into
the page, and **the plaintext asset is then deleted from the build**. After the
vault pass a hub page has no local dependencies at all.

This is why the build removes ~65 files. That is correct, not a bug.

## Files

| File | Role |
|---|---|
| `vault.js` | Browser decryptor. **The only unencrypted script on the site.** |
| `.github/vault.py` | Build-side: inline, seal, emit shell, write `vault.json` |
| `.github/inject.py` | Calls the vault pass as the last build step |
| `.github/verify_vault.py` | Fails the deploy if anything readable would ship |

Shipped in the clear, deliberately: `vault.js`, `vault.json`, `manifest.json`,
`sw.js`, `version.txt`, `icons/`. None carries content.

## The passphrase

Stored as the **`HUB_PASSPHRASE`** repository secret
(Settings → Secrets and variables → Actions).

The build **refuses to run without it** and refuses a passphrase under 12
characters. A build that quietly fell back to plaintext would publish the entire
hub, so it fails loudly instead:

```
[inject] FATAL: HUB_PASSPHRASE is not set.
         The site would ship in plaintext to a public origin.
```

**Changing it** re-encrypts everything on the next deploy and locks out every
device — expected, and the way to revoke access. There is no recovery: lose the
passphrase and the published site is unreadable to you too. The repo still has
the plaintext, so nothing is *lost*; only the deployed copy becomes inert.

## Working on it locally

```bash
export HUB_PASSPHRASE='…'
python3 -m pip install cryptography markdown
python3 .github/inject.py          # builds _site/, encrypted
python3 .github/verify_vault.py    # must print OK
cd _site && python3 -m http.server 8901
```

The repo working copy stays plaintext. Only `_site/` is sealed.

## What this does not protect

- **Anything already published.** The repo has been public since July 2026 and
  its git history still contains every plaintext version. Encryption from here
  forward does nothing about that; only making the repo private removes public
  access to history, and nothing removes what has already been cloned.
- **A weak passphrase.** This is the whole ballgame.
- **Your unlocked device.** "Stay unlocked" writes the key to `localStorage`.
  On a shared or lost device, that is the key. `hubVaultLock()` from the console
  clears it.
- **Metadata.** Filenames, page count, and file sizes are visible. Someone can
  tell there is a page called `Debt.html` and roughly how long it is.
- **Anyone with the passphrase.** It is one secret shared by every device.

## Adding a page

Nothing special: write it as a normal page in the repo root. The build inlines,
seals and shell-wraps it automatically. Markdown files are rendered to HTML
first — a `.md` cannot carry a decryptor, so shipping one raw would leave a
plaintext hole.

**Never add a content file to the allow-list in `vault.py` or
`verify_vault.py`.** That list exists for the decryptor and the PWA plumbing.
Anything with words in it belongs behind the vault.
