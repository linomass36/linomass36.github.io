/* ─────────────────────────────────────────────────────────────────────────
   vault.js — the only file on the public site that is not encrypted, and
   the only one that needs to be readable.

   THE MODEL
   Every hub page ships as ciphertext. This script asks for the passphrase,
   derives a key, decrypts the page it is embedded in, and replaces the
   document with the result. A raw fetch of any page — by a crawler, by
   `curl`, by anyone browsing the public repo — returns base64 and nothing
   else. There is no server to ask, so there is no server-side check to
   bypass: the content is not withheld, it is unreadable.

   CRYPTO
     PBKDF2-SHA256, 600,000 iterations, 32-byte key
     AES-256-GCM, 96-bit IV, fresh per file
     16-byte salt, fresh per build, published in vault.json

   The salt is public on purpose — that is what a salt is for. Security
   rests entirely on the passphrase, so a weak passphrase is a weak site.
   600k iterations makes each guess cost real time on an attacker's
   hardware; it also costs ~1s on your phone, which is why the derived key
   (never the passphrase) is cached for the session.

   WHAT THIS DOES NOT PROTECT
   Anything already published in plaintext, and anything a person with the
   passphrase chooses to share. It is a lock on the front of the site, not
   a claim about the past.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  if (window.__vaultRan) return;
  window.__vaultRan = true;

  /* The __local prefix is load-bearing, not cosmetic: sync.js pushes every
     localStorage key that is not __sync* or __local* to Firestore, so under
     the old names the raw AES key that opens the entire hub was being
     uploaded to the cloud on the first sync after unlocking. */
  var SKEY = '__local_vault_key_v1';    // sessionStorage: derived key, this tab only
  var DKEY = '__local_vault_device_v1'; // localStorage: opt-in, this device
  var OLD  = ['hub_vault_key_v1', 'hub_vault_device_v1'];
  var C = window.crypto && window.crypto.subtle;

  /* The ciphertext sits in <body>, and the lock screen rewrites <body> to
     draw itself. Read the payload out once, now, before any DOM write can
     take it with it — losing it left the button stuck on "Unlocking…" with
     nothing to decrypt and no error to show. */
  var PAYLOAD = (function () {
    var n = document.getElementById('vault-payload');
    var t = n ? n.textContent.trim() : '';
    if (n && n.parentNode) n.parentNode.removeChild(n);
    return t;
  })();

  function b64d(s) {
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function b64e(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  function deriveKey(pass, salt) {
    return C.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey'])
      .then(function (base) {
        return C.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: 600000, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
      });
  }
  /* Ciphertext is IV || payload, so a file carries its own IV and two files
     never share one. */
  function decrypt(key, blob) {
    var raw = b64d(blob), iv = raw.slice(0, 12), body = raw.slice(12);
    return C.decrypt({ name: 'AES-GCM', iv: iv }, key, body)
      .then(function (out) { return new TextDecoder().decode(out); });
  }

  /* Anything written under the old names is migrated and then removed —
     including from the cloud, because the removal goes through sync.js's
     patched removeItem and is pushed as a deletion. */
  function migrateOldKeys() {
    var found = null;
    OLD.forEach(function (k) {
      try {
        var v = sessionStorage.getItem(k);
        if (v) { found = found || v; sessionStorage.removeItem(k); }
      } catch (e) {}
      try {
        var w = localStorage.getItem(k);
        if (w) { found = found || w; localStorage.removeItem(k); }
      } catch (e) {}
    });
    return found;
  }

  function loadCachedKey() {
    var raw = null;
    try { raw = sessionStorage.getItem(SKEY) || localStorage.getItem(DKEY); } catch (e) {}
    if (!raw) raw = migrateOldKeys();
    if (!raw) return Promise.resolve(null);
    return C.importKey('raw', b64d(raw), { name: 'AES-GCM', length: 256 }, true, ['decrypt'])
      .catch(function () { return null; });
  }
  /* Returns whether the device-level write actually survived. Swallowing a
     failed setItem meant a ticked box could do nothing at all and say
     nothing about it, which is indistinguishable from a bug in the feature. */
  function cacheKey(key, alsoDevice) {
    return C.exportKey('raw', key).then(function (raw) {
      var s = b64e(raw);
      try { sessionStorage.setItem(SKEY, s); } catch (e) {}
      if (!alsoDevice) return true;
      try {
        localStorage.setItem(DKEY, s);
        return localStorage.getItem(DKEY) === s;   // read back: quota, private mode, policy
      } catch (e) { return false; }
    });
  }
  function forget() {
    try { sessionStorage.removeItem(SKEY); } catch (e) {}
    try { localStorage.removeItem(DKEY); } catch (e) {}
    migrateOldKeys();
  }
  window.hubVaultLock = function () { forget(); location.reload(); };

  /* The verifier is a known string encrypted with the same key. Checking it
     tells a wrong passphrase from a corrupt page in one cheap operation,
     instead of failing somewhere inside a half-decrypted document. */
  function verify(key, meta) {
    return decrypt(key, meta.verifier)
      .then(function (t) { return t === 'ct-hub-vault-ok'; })
      .catch(function () { return false; });
  }

  function open(plain) {
    document.open();
    document.write(plain);
    document.close();
  }

  var CSS = '<style>' +
    'html,body{margin:0;height:100%}' +
    'body{background:#F7F5F1;color:#1A1B1A;font-family:"IBM Plex Sans",system-ui,-apple-system,sans-serif;' +
    'display:flex;align-items:center;justify-content:center;padding:24px}' +
    '@media(prefers-color-scheme:dark){body{background:#15161A;color:#ECEAE4}}' +
    '.v{width:100%;max-width:360px;text-align:left}' +
    '.k{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10.5px;letter-spacing:.18em;' +
    'text-transform:uppercase;color:#993C1D;font-weight:600}' +
    '.t{font-family:"Newsreader",Georgia,serif;font-size:30px;font-weight:500;margin:6px 0 8px}' +
    '.d{font-size:14.5px;line-height:1.6;color:#55564F;margin:0 0 20px}' +
    '@media(prefers-color-scheme:dark){.d{color:#B6B4AC}}' +
    'input{width:100%;height:48px;border:1px solid #E4E2DD;border-radius:12px;padding:0 14px;' +
    'font-size:16px;background:#fff;color:#1A1B1A;-webkit-appearance:none}' +
    '@media(prefers-color-scheme:dark){input{background:#24262C;color:#ECEAE4;border-color:#2E3037}}' +
    'input:focus{outline:2px solid #993C1D;outline-offset:-1px}' +
    'button{width:100%;height:48px;margin-top:10px;border:0;border-radius:12px;background:#993C1D;' +
    'color:#fff;font-size:15.5px;font-weight:600;cursor:pointer}' +
    'button[disabled]{opacity:.6;cursor:default}' +
    '.r{display:flex;align-items:center;gap:8px;margin-top:14px;font-size:13.5px;color:#55564F}' +
    '@media(prefers-color-scheme:dark){.r{color:#B6B4AC}}' +
    '.r input{width:18px;height:18px;margin:0}' +
    '.e{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12.5px;color:#A32E27;' +
    'margin-top:12px;min-height:18px}' +
    '</style>';

  function ui(meta) {
    document.title = 'Locked';
    document.body.innerHTML = CSS +
      '<div class="v">' +
      '<div class="k">CT Hub</div>' +
      '<div class="t">Locked</div>' +
      '<p class="d">This hub is encrypted. Enter the passphrase to unlock it on this device.</p>' +
      '<form id="vf"><input id="vp" type="password" autocomplete="current-password" ' +
      'placeholder="Passphrase" autofocus enterkeyhint="go">' +
      '<button id="vb" type="submit">Unlock</button>' +
      '<label class="r"><input id="vr" type="checkbox"> Stay unlocked on this device</label>' +
      '<div class="e" id="ve"></div></form></div>';

    var f = document.getElementById('vf'), p = document.getElementById('vp'),
        b = document.getElementById('vb'), r = document.getElementById('vr'),
        e = document.getElementById('ve');

    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var pass = p.value;
      if (!pass) return;
      b.disabled = true; b.textContent = 'Unlocking…'; e.textContent = '';
      /* Yield a frame first: the derivation blocks the main thread for about
         a second on a phone, and a button that never repaints reads as a
         crash rather than as work. */
      setTimeout(function () {
        deriveKey(pass, b64d(meta.salt))
          .then(function (key) {
            return verify(key, meta).then(function (ok) {
              if (!ok) throw new Error('wrong');
              return cacheKey(key, r.checked).then(function (stuck) {
                if (r.checked && !stuck) {
                  /* Unlock anyway — the passphrase was right — but say so,
                     rather than letting the box look like it worked. */
                  e.textContent = 'Unlocked, but this browser refused to remember it ' +
                    '(private window, or storage is blocked or full).';
                  return new Promise(function (res) {
                    setTimeout(function () { res(unlockWith(key)); }, 2200);
                  });
                }
                return unlockWith(key);
              });
            });
          })
          .catch(function (err) {
            b.disabled = false; b.textContent = 'Unlock';
            e.textContent = err && err.message === 'wrong'
              ? 'That passphrase does not open this hub.'
              : 'Could not unlock — ' + (err && err.message ? err.message : 'unknown error');
            p.select();
          });
      }, 30);
    });
  }

  function unlockWith(key) {
    if (!PAYLOAD) return Promise.reject(new Error('this page carries no payload'));
    return decrypt(key, PAYLOAD).then(open);
  }

  function boot() {
    if (!C) {
      document.body.innerHTML = CSS + '<div class="v"><div class="t">Not available</div>' +
        '<p class="d">This browser cannot decrypt the hub. It needs Web Crypto over a secure ' +
        'connection (https), which every current browser has.</p></div>';
      return;
    }
    fetch('vault.json?v=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (meta) {
        return loadCachedKey().then(function (key) {
          if (!key) return ui(meta);
          return verify(key, meta).then(function (ok) {
            if (!ok) { forget(); return ui(meta); }
            return unlockWith(key);
          });
        });
      })
      .catch(function () {
        document.body.innerHTML = CSS + '<div class="v"><div class="t">Offline</div>' +
          '<p class="d">The hub could not reach its key file. Reconnect and reload.</p></div>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();
})();
