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
    if (Array.isArray(snap.holdings) && snap.holdings.length) {
      return snap.holdings.map(function (h) {
        return {
          ccy: CODES.indexOf(h.ccy) >= 0 ? h.ccy : (assume || 'USD'),
          cash: parseFloat(h.cash) || 0,
          inv: parseFloat(h.inv) || 0,
          debt: parseFloat(h.debt) || 0
        };
      });
    }
    return [{
      ccy: CODES.indexOf(snap.ccy) >= 0 ? snap.ccy : (assume || 'USD'),
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

  w.Money = {
    KEY: KEY, CODES: CODES, SYMBOL: SYMBOL, STALE_DAYS: STALE_DAYS,
    read: read, write: write, setRate: setRate, setBase: setBase,
    convert: convert, known: known, fmt: fmt, symbol: symbol,
    holdingsOf: holdingsOf, netOf: netOf, stale: stale,
    today: today, daysSince: daysSince
  };
})(window);
