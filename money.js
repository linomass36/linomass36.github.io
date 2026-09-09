/* ─────────────────────────────────────────────────────────────────────────
   money.js — more than one currency, and rates that admit they are guesses.

   The Vault had a single currency picked once from a dropdown, and
   systems.js ignored even that and hardcoded a dollar sign — so a PLN
   balance was being read back on the front page as dollars. That is fine
   while everything you own is in one currency and wrong the moment it is
   not, which is now: earnings in USD, and some wealth staying in PLN.

   So an amount carries its own currency, and a snapshot may hold several.
   Totals are converted into one display currency for reading, and the
   per-currency amounts are never overwritten — conversion is a view, not a
   migration.

   On rates. There is no live feed here: this site is static, works offline,
   and a number fetched at render time would silently rewrite your history
   every time you opened the page. So rates are entered by hand and stored
   WITH THE DATE THEY WERE SET, exactly the way the Ledger treats any other
   assumption. A rate that has gone stale says so rather than quietly
   passing itself off as current.
   ───────────────────────────────────────────────────────────────────────── */
(function (w) {
  'use strict';

  var KEY = 'ct_rates_v1';
  var STALE_DAYS = 30;

  var SYMBOL = { USD: '$', PLN: 'zł', EUR: '€', GBP: '£' };
  var CODES = ['USD', 'PLN', 'EUR', 'GBP'];

  function today() {
    /* The hub's day boundary lives in day.js: a day ends at 05:00, so work
       that runs past midnight belongs to the day it started. Falls back to the
       calendar date when that file has not loaded. */
    if (w.CTDay) return w.CTDay.today();
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  function daysSince(iso) {
    if (!iso) return Infinity;
    var t = new Date(iso + 'T12:00:00').getTime();
    if (isNaN(t)) return Infinity;
    return Math.max(0, Math.round((Date.now() - t) / 86400000));
  }

  /* { base, rates: { CODE: units of CODE per 1 base }, at: 'YYYY-MM-DD' } */
  function read() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (!d || typeof d !== 'object') d = {};
    var base = CODES.indexOf(d.base) >= 0 ? d.base : 'USD';
    var rates = (d.rates && typeof d.rates === 'object') ? d.rates : {};
    rates[base] = 1;
    return { base: base, rates: rates, at: d.at || '' };
  }

  function write(next) {
    var cur = read();
    var d = {
      base: next.base || cur.base,
      rates: next.rates || cur.rates,
      at: next.at || today()
    };
    d.rates[d.base] = 1;
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {}
    return read();
  }

  function setRate(code, value) {
    var d = read();
    var n = parseFloat(value);
    if (!isFinite(n) || n <= 0) return d;
    d.rates[code] = n;
    return write({ rates: d.rates, at: today() });
  }

  function setBase(code) {
    if (CODES.indexOf(code) < 0) return read();
    return write({ base: code });
  }

  function known(code) {
    var d = read();
    return code === d.base || isFinite(d.rates[code]);
  }

  /* Convert `amount` from `from` into `to`. Returns null when a rate is
     missing rather than guessing 1:1 — a silent 1:1 is how a 4x error
     becomes a number you trust. */
  function convert(amount, from, to) {
    var n = parseFloat(amount);
    if (!isFinite(n)) return null;
    if (from === to) return n;
    var d = read();
    var rf = from === d.base ? 1 : d.rates[from];
    var rt = to === d.base ? 1 : d.rates[to];
    if (!isFinite(rf) || !isFinite(rt) || rf <= 0 || rt <= 0) return null;
    return n / rf * rt;                      // from → base → to
  }

  function symbol(code) { return SYMBOL[code] || (code + ' '); }

  function fmt(amount, code, opts) {
    opts = opts || {};
    var n = parseFloat(amount);
    if (!isFinite(n)) return '—';
    var r = opts.decimals ? n.toFixed(2) : String(Math.round(Math.abs(n)));
    var body = Number(opts.decimals ? Math.abs(n).toFixed(2) : Math.round(Math.abs(n)))
      .toLocaleString('en-US', opts.decimals ? { minimumFractionDigits: 2 } : {});
    var sign = n < 0 ? '−' : '';
    var s = symbol(code);
    // zł reads as a suffix in Polish; the symbol currencies lead.
    return code === 'PLN' ? sign + body + ' ' + s : sign + s + body;
  }

  /* A snapshot may be the old flat shape { cash, inv, debt } or the new
     { holdings: [ { ccy, cash, inv, debt } ] }. Old snapshots are read as
     a single holding in `assume`, so nothing already entered is lost or
     needs migrating. */
  function holdingsOf(snap, assume) {
    if (!snap || typeof snap !== 'object') return [];
    /* `declared` records whether the currency came from the snapshot or from
       `assume`. An assumed currency is a guess — the Vault wrote these with
       no currency field at all until it grew one — and position() passes the
       distinction up so a page can say the number rests on an assumption
       rather than printing it as fact. */
    if (Array.isArray(snap.holdings) && snap.holdings.length) {
      return snap.holdings.map(function (h) {
        var known = CODES.indexOf(h.ccy) >= 0;
        return {
          ccy: known ? h.ccy : (assume || 'USD'),
          declared: known,
          cash: parseFloat(h.cash) || 0,
          inv: parseFloat(h.inv) || 0,
          debt: parseFloat(h.debt) || 0
        };
      });
    }
    var known = CODES.indexOf(snap.ccy) >= 0;
    return [{
      ccy: known ? snap.ccy : (assume || 'USD'),
      declared: known,
      cash: parseFloat(snap.cash) || 0,
      inv: parseFloat(snap.inv) || 0,
      debt: parseFloat(snap.debt) || 0
    }];
  }

  /* Net worth of a snapshot in `display`. `missing` names the currencies
     that could not be converted, so a caller can say so out loud instead
     of quietly reporting a total that is short a holding. */
  function netOf(snap, display, assume) {
    var hs = holdingsOf(snap, assume);
    var total = 0, missing = [], parts = [];
    hs.forEach(function (h) {
      var net = h.cash + h.inv - h.debt;
      parts.push({ ccy: h.ccy, net: net });
      var c = convert(net, h.ccy, display);
      if (c === null) { if (missing.indexOf(h.ccy) < 0) missing.push(h.ccy); return; }
      total += c;
    });
    return { total: total, missing: missing, parts: parts, complete: missing.length === 0 };
  }

  function stale() {
    var d = read();
    return { days: daysSince(d.at), at: d.at, isStale: daysSince(d.at) > STALE_DAYS };
  }

  /* ── ONE ANSWER TO "WHAT IS NET WORTH" ────────────────────────────────────
     The Vault page owns the snapshots. Everything else was answering the
     question its own way:

       Vault.dc.html   the real store, formatted with a design-canvas prop
       systems.js      its own reader + conversion, inline
       Money.html      a hardcoded −250, printed under the words "Net worth
                       today", frozen on the day the plan was recalibrated
       plan-v2-data.js the same −250 again, in the ground-truth table

     So the Debt panel and the Net worth panel of the SAME PAGE disagreed,
     and the front page could disagree with both. Three of the four never
     read the store at all.

     This is the reader they all use now. It returns the newest snapshot
     converted into `display`, and — the part that matters — it says how old
     it is and whether anything could not be converted, so a caller can
     report "as of March, and the PLN holding is uncounted" instead of a
     confident total that is quietly short.

     `asOf` is a YYYY-MM month, because that is the grain the Vault records.
     A null `net` means no snapshot has ever been taken; that is a different
     thing from a net worth of zero and callers must not print it as one. */
  var VAULT_KEY = 'ct_vault_v1';

  function vault() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(VAULT_KEY)); } catch (e) {}
    if (!d || typeof d !== 'object') return { snaps: [], display: null, assume: null };
    /* `snaps` is what the Vault writes; `snapshots` is the older spelling
       systems.js already tolerated. Reading both here is why that tolerance
       does not have to exist in four places. */
    var raw = Array.isArray(d.snaps) ? d.snaps
            : (Array.isArray(d.snapshots) ? d.snapshots : []);
    var snaps = raw.filter(function (s) { return s && typeof s === 'object'; })
                   .slice()
                   .sort(function (a, b) { return String(a.m) > String(b.m) ? 1 : -1; });
    return { snaps: snaps, display: d.display || null, assume: d.assume || null };
  }

  function latest() {
    var v = vault();
    return v.snaps.length ? v.snaps[v.snaps.length - 1] : null;
  }

  /* The snapshot's own currency, when it has one. Snapshots written before
     the Vault carried a currency field have none — those are read as
     `assume`, which is the store's recorded assumption and only then the
     display currency. Guessing silently is what made a PLN balance read back
     as dollars on the front page. */
  function position(display) {
    var v = vault();
    var disp = CODES.indexOf(display) >= 0 ? display
             : (CODES.indexOf(v.display) >= 0 ? v.display : read().base);
    var last = v.snaps.length ? v.snaps[v.snaps.length - 1] : null;
    if (!last) {
      return { net: null, ccy: disp, asOf: null, count: 0,
               complete: true, missing: [], parts: [], assumed: false };
    }
    var assume = CODES.indexOf(v.assume) >= 0 ? v.assume : disp;
    var r = netOf(last, disp, assume);
    /* True when the figure rests on an assumption rather than on something
       the snapshot actually says. A caller showing a bare number should say
       so; one showing a range need not. */
    var hs = holdingsOf(last, assume);
    var assumed = hs.some(function (h) { return !h.declared; });
    return {
      net: r.complete ? r.total : null,
      ccy: disp, asOf: last.m || null, count: v.snaps.length,
      complete: r.complete, missing: r.missing, parts: r.parts,
      assumed: assumed
    };
  }

  /* How many months back the newest snapshot is. The Vault records by month,
     so this is months rather than days, and it is what tells a page whether
     to caveat the number it is about to print. */
  function positionAge(nowIso) {
    var p = position();
    if (!p.asOf) return null;
    var now = String(nowIso || today()).slice(0, 7);
    var a = p.asOf.split('-'), b = now.split('-');
    if (a.length < 2 || b.length < 2) return null;
    return (+b[0] - +a[0]) * 12 + (+b[1] - +a[1]);
  }

  w.Money = {
    KEY: KEY, VAULT_KEY: VAULT_KEY, CODES: CODES, SYMBOL: SYMBOL, STALE_DAYS: STALE_DAYS,
    read: read, write: write, setRate: setRate, setBase: setBase,
    convert: convert, known: known, fmt: fmt, symbol: symbol,
    holdingsOf: holdingsOf, netOf: netOf, stale: stale,
    vault: vault, latest: latest, position: position, positionAge: positionAge,
    today: today, daysSince: daysSince
  };
})(window);
