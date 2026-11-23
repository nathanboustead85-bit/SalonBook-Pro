const test=require('node:test');
const assert=require('node:assert/strict');
const {validateSnapshot,previewRestore}=require('../security/phase523-restore-guard.cjs');
const good={schemaVersion:1,bookings:'[{"id":"synthetic"}]',services:'[]',staff:'[]'};
test('synthetic valid snapshot produces preview only',()=>{
 const local={bookings:[{id:'original-synthetic'}],services:[],staff:[]};
 const original=JSON.stringify(local);
 const result=previewRestore(good,'test-user','test-user',local);
 assert.equal(result.allowed,true);
 assert.deepEqual(result.changes.map(x=>x.key),['bookings','services','staff']);
 assert.equal(result.changes[0].previousCount,1);
 assert.equal(result.changes[0].proposedCount,1);
 assert.equal(JSON.stringify(local),original);
});
test('deny account switch',()=>assert.equal(validateSnapshot(good,'owner-a','owner-b').reason,'ACCOUNT_CHANGED'));
test('deny missing or malformed arrays',()=>{
 for(const key of ['bookings','services','staff']){
  assert.equal(validateSnapshot({...good,[key]:'{}'},'a','a').ok,false);
  assert.equal(validateSnapshot({...good,[key]:'invalid'},'a','a').ok,false);
  assert.equal(validateSnapshot({...good,[key]:null},'a','a').ok,false);
 }
});
test('deny unexpected schema and oversized payload',()=>{
 assert.equal(validateSnapshot({...good,schemaVersion:2},'a','a').reason,'SCHEMA_MISMATCH');
 assert.equal(validateSnapshot({...good,bookings:'x'.repeat(1000001)},'a','a').ok,false);
});
test('deny null identity and snapshots',()=>{
 assert.equal(validateSnapshot(good,null,'a').ok,false);
 assert.equal(validateSnapshot(null,'a','a').ok,false);
});
