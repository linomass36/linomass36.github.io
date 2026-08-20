/* Every page, loaded on a desktop and a phone, watched for the one failure
   that is invisible from the outside: renderVals() throwing. When it throws
   the component falls back to its empty defaults and the page still looks
   like a page — just with nothing in it. Mission Control shipped that way. */
/* Run it against a local copy of the built site:
     python3 .github/inject.py && (cd _site && python3 -m http.server 8899 &)
     npm i react@18.3.1 react-dom@18.3.1 @babel/standalone@7.29.0
     PW=$(npm root -g)/playwright NM=$PWD/node_modules node .github/tests/crash.js
   React and Babel are served from the local install rather than unpkg, so the
   suite runs with no network. */
const { chromium, devices } = require(process.env.PW || 'playwright');
const fs = require('fs'); const NM = (process.env.NM || (__dirname + '/../../node_modules')) + '/';
const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:8899';
let pass=0, fail=0;
const ok=(c,l,e)=>{c?(pass++,console.log('ok   '+l)):(fail++,console.log('FAIL '+l+(e?'\n     '+e:'')));};
const cdn = { 'react@18.3.1/umd/react.production.min.js': NM+'react/umd/react.production.min.js',
  'react-dom@18.3.1/umd/react-dom.production.min.js': NM+'react-dom/umd/react-dom.production.min.js',
  '@babel/standalone@7.29.0/babel.min.js': NM+'@babel/standalone/babel.min.js' };
const PAGES = ['Today','Hub','Anatomy','Grind','Reading List','Journal','Life Log','Study Engine',
  'Weekly Review','Reference','Summer Sprint','CT Master Plan','Plan Analysis','Research Plan',
  'Network Map','Conference Radar','Timeline','Dossiers','Examiner','Vault'];
const url = n => ORIGIN + '/' + encodeURIComponent(n + (n === 'CT Master Plan' ? '.html' : '.dc.html'));
(async () => {
  const b = await chromium.launch();
  for (const dev of ['desktop','phone']) {
    const ctx = await b.newContext(Object.assign({ serviceWorkers:'block' },
      dev === 'phone' ? { ...devices['iPhone 13'] } : { viewport:{width:1440,height:900} }));
    const p = await ctx.newPage();
    let bad = [];
    p.on('pageerror', e => bad.push('pageerror: ' + e.message));
    /* "logic class eval FAILED" is the loudest of these and was the one this
       guard missed: the DC runtime catches a syntax error in the logic class,
       falls back to rendering the template with props only, and the page
       comes up looking like a page with every binding empty. */
    p.on('console', m => { if (m.type()==='error' && /renderVals|logic class eval FAILED|Cannot read propert|is not a function|is not defined|has already been declared/.test(m.text())
                              && !/net::|Failed to load resource|gstatic|firebase/.test(m.text())) bad.push('console: ' + m.text()); });
    await p.route('https://unpkg.com/**', r => { const k=Object.keys(cdn).find(k=>r.request().url().endsWith(k));
      return k ? r.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(cdn[k])}) : r.abort(); });
    await p.route('https://fonts.googleapis.com/**', r => r.fulfill({status:200,contentType:'text/css',body:''}));
    await p.route('https://fonts.gstatic.com/**', r => r.abort());
    await p.route('https://www.gstatic.com/**', r => r.abort());
    for (const name of PAGES) {
      bad = [];
      await p.goto(url(name), { waitUntil:'domcontentloaded', timeout:25000 });
      await p.waitForTimeout(1400);
      const len = await p.evaluate(() => document.body.innerText.replace(/\s+/g,' ').length);
      ok(bad.length===0, dev+' · '+name+' renders without throwing', bad.slice(0,2).join(' | '));
      ok(len > 400, dev+' · '+name+' has content ('+len+' chars)');
    }
    await ctx.close();
  }
  await b.close();
  console.log('\n'+pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
})();
