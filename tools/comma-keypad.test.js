/* ─────────────────────────────────────────────────────────────────────────
   comma-keypad.test.js — a decimal typed on a phone in a comma locale.

   Run it against a local copy of the site:
     python3 -m http.server 8898        # from the repo root
     npm i react@18.3.1 react-dom@18.3.1 @babel/standalone@7.29.0
     PW=$(npm root -g)/playwright NM=$PWD/node_modules node tools/comma-keypad.test.js

   A phone set to a comma locale offers "," on the decimal keypad. Typed into
   <input type="number"> that value is invalid, and the browser does not
   complain — it drops the separator. "7,3" hours of sleep was stored as 73.

   The check is the whole round trip: type a comma on an iPhone in pl-PL, then
   read what actually reached localStorage.
   ───────────────────────────────────────────────────────────────────────── */
const { chromium, devices } = require(process.env.PW || 'playwright');
const fs = require('fs'); const NM = process.env.NM + '/';
const cdn = { 'react@18.3.1/umd/react.production.min.js': NM+'react/umd/react.production.min.js',
  'react-dom@18.3.1/umd/react-dom.production.min.js': NM+'react-dom/umd/react-dom.production.min.js',
  '@babel/standalone@7.29.0/babel.min.js': NM+'@babel/standalone/babel.min.js' };
const ORIGIN = 'http://127.0.0.1:8898';

(async () => {
  const b = await chromium.launch();
  // a phone in a comma locale, as reported
  const ctx = await b.newContext(Object.assign({}, devices['iPhone 13'],
    { serviceWorkers: 'block', locale: 'pl-PL' }));
  await ctx.route('https://unpkg.com/**', r => { const k=Object.keys(cdn).find(k=>r.request().url().endsWith(k));
    return k ? r.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(cdn[k])}) : r.abort(); });
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({status:200,contentType:'text/css',body:''}));
  await ctx.route('https://fonts.gstatic.com/**', r => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('  pageerror:', e.message));
  await p.goto(ORIGIN + '/Life%20Log.dc.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1800);

  const field = p.locator('input[inputmode="decimal"]').first();
  await field.waitFor({ timeout: 10000 });
  const type = await field.getAttribute('type');
  console.log('first decimal field type :', type);

  // type a comma, exactly as the phone keypad gives it
  await field.click();
  await field.type('7,3', { delay: 40 });
  const shown = await field.inputValue();
  console.log('value the field holds    :', JSON.stringify(shown));

  await field.blur();
  await p.waitForTimeout(700);
  const stored = await p.evaluate(() => {
    try {
      const d = JSON.parse(localStorage.getItem('ct_lifelog_v1') || '{}');
      const days = d.days || {};
      const k = Object.keys(days).sort().pop();
      return k ? JSON.stringify(days[k]) : '(no day written)';
    } catch (e) { return 'ERR ' + e.message; }
  });
  console.log('what reached the store   :', stored);

  const pass = type === 'text' && shown === '7.3' && /"7\.3"/.test(stored);
  console.log(pass ? '\n  pass  a comma typed on a comma-locale phone stores 7.3\n'
                   : '\n  FAIL  expected type=text, value 7.3, and 7.3 in the store\n');
  await b.close();
  process.exit(pass ? 0 : 1);
})();
