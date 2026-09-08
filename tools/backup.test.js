/* ─────────────────────────────────────────────────────────────
   backup.test.js — a backup that restores less than it claims.

   Hub.dc.html kept a hardcoded list of twenty keys. The hub writes forty.
   So the backup silently omitted twenty-two live stores — the plan's ticks,
   the whole health record, the weekly reviews, the elastic week — while
   still presenting itself as a backup. Nobody finds that out until a restore.

   backup.js enumerates localStorage instead of keeping a list, so these
   tests are about the two things that rule cannot get wrong on its own:
   credentials must stay out of a downloadable file, and a restore must never
   destroy more than it was asked to.

   Run with `node tools/backup.test.js` from the repo root. Also run by the
   deploy.
   ───────────────────────────────────────────────────────────── */
const vm=require('vm'),fs=require('fs');
let fail=0;const ok=(c,m,x)=>{console.log((c?'  pass  ':'  FAIL  ')+m+(x&&!c?'  ['+x+']':''));if(!c)fail++;};
function mk(store){
  const ls={length:0,_k:[],getItem:k=>k in store?store[k]:null,
    setItem:(k,v)=>{store[k]=String(v);sync()},key:i=>ls._k[i]};
  function sync(){ls._k=Object.keys(store);ls.length=ls._k.length}sync();
  const ctx={console,JSON,Object,Array,String,Date,Math,localStorage:ls,
    Blob:class{constructor(a){this.size=(a[0]||'').length}},
    document:{createElement:()=>({click(){},remove(){},style:{}}),body:{appendChild(){}}},
    URL:{createObjectURL:()=>'b',revokeObjectURL(){}},setTimeout};
  ctx.window=ctx;vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(require('path').join(__dirname,'..','backup.js'),'utf8'),ctx,{filename:'backup.js'});
  return {B:ctx.Backup,store};
}
console.log('— a backup taken, then the hub changes, then restore —');
const src=mk({ct_grind_v1:'{"week":1}',ct_journal_v1:'[{"id":"a"}]',plan_v2_state_v1:'{"done":{}}'});
const file=JSON.stringify(src.B.collect());

// device has moved on: grind advanced, journal gained an entry, a new store appeared
const dev=mk({ct_grind_v1:'{"week":4}',ct_journal_v1:'[{"id":"a"},{"id":"b"}]',ct_rest_v1:'{"new":1}'});
const insp=dev.B.inspect(file);
ok(insp.ok,'file inspects cleanly',insp.why);
ok(insp.replaces.length===2,'2 stores would be replaced ('+insp.replaces+')');
ok(insp.adds.length===1,'1 store would be added ('+insp.adds+')');
ok(insp.untouched.length===1&&insp.untouched[0]==='ct_rest_v1','ct_rest_v1 is untouched by a restore');

console.log('\n— merge: never overwrites what is here —');
const m=mk({ct_grind_v1:'{"week":4}',ct_rest_v1:'{"new":1}'});
const rm=m.B.restore(file,'merge');
ok(m.store.ct_grind_v1==='{"week":4}','merge kept the newer grind week');
ok(m.store.ct_journal_v1==='[{"id":"a"}]','merge added the missing journal');
ok(m.store.ct_rest_v1==='{"new":1}','merge left the unrelated store alone');
ok(rm.skipped.length===1&&rm.wrote.length===2,'merge reports 2 written, 1 skipped');

console.log('\n— replace: overwrites, but still never deletes —');
const r=mk({ct_grind_v1:'{"week":4}',ct_rest_v1:'{"new":1}'});
const rr=r.B.restore(file,'replace');
ok(r.store.ct_grind_v1==='{"week":1}','replace restored the backup grind week');
ok(r.store.ct_rest_v1==='{"new":1}','replace did NOT delete a store the backup predates');
ok(rr.wrote.length===3,'replace wrote all 3');

console.log('\n— round trip is byte-exact —');
const rt=mk({});
rt.B.restore(file,'replace');
ok(rt.store.ct_journal_v1===src.store.ct_journal_v1,'restored bytes identical to source');

console.log('\n— bad input is refused, not half-applied —');
const bad=mk({ct_grind_v1:'{"week":9}'});
ok(!bad.B.inspect('not json').ok,'rejects non-JSON');
ok(!bad.B.inspect('{"a":1}').ok,'rejects JSON that is not a backup');
ok(!bad.B.restore('nope','replace').ok,'restore refuses garbage');
ok(bad.store.ct_grind_v1==='{"week":9}','and changed nothing doing so');
ok(!bad.B.inspect(JSON.stringify({format:99,stores:{}})).ok,'refuses a newer format');

console.log('\n— credentials and device-only keys never reach the file —');
const sec=mk({ct_grind_v1:'{"w":1}',__local_vault_device_v1:'VAULT-KEY-HERE',
              __cal_tok:'ya29.OAUTH-TOKEN',__sync_rev:'12'});
const secFile=JSON.stringify(sec.B.collect());
ok(!secFile.includes('VAULT-KEY-HERE'),'the vault device key is not in a backup file');
ok(!secFile.includes('ya29.OAUTH-TOKEN'),'the calendar OAuth token is not in a backup file');
/* The manifest NAMES what it left out, so the key string is legitimately in
   the file. What must never be there is the value, or a restorable store. */
const secB=sec.B.collect();
ok(!('__sync_rev' in secB.stores),'sync bookkeeping is not a restorable store');
ok(!('__local_vault_device_v1' in secB.stores),'the vault key is not a restorable store');
ok(!('__cal_tok' in secB.stores),'the calendar token is not a restorable store');
ok(secB.skipped.indexOf('__sync_rev')>=0,'but the manifest names it as skipped');
ok(sec.B.collect().skipped.length===3,'and the manifest says what it left out');

console.log(fail?'\n'+fail+' FAILED':'\nall green');
process.exit(fail?1:0);
