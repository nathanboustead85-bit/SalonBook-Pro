const test=require('node:test');
const assert=require('node:assert/strict');
const {validateBackup,requireExplicitWriteAuthorization}=require('../security/phase526-backup-safety.cjs');
const snap={schemaVersion:1,bookings:'[{"id":"synthetic-1"}]',services:'[]',staff:'[]'};
const local={bookings:[{id:'synthetic-existing'}],services:[],staff:[]};
const args={snapshot:snap,requestedUid:'owner-a',currentUid:'owner-a',verified:true,local};
test('valid synthetic data only returns a preview; local data remains untouched',()=>{
 const before=JSON.stringify(local);
 const r=validateBackup(args);
 assert.equal(r.allowed,true);assert.equal(r.mode,'PREVIEW_ONLY');
 assert.equal(r.counts[0].local,1);assert.equal(r.counts[0].cloud,1);
 assert.equal(JSON.stringify(local),before);
});
test('reject other owner, missing identity and unverified account',()=>{
 for(const patch of [{currentUid:'owner-b'},{requestedUid:null},{verified:false}]){
  assert.equal(validateBackup({...args,...patch}).allowed,false);
 }
});
test('reject corrupt, oversized and unsupported backup',()=>{
 for(const patch of [{schemaVersion:2},{bookings:'{}'},{bookings:'oops'},{bookings:'x'.repeat(1000001)}]){
  assert.equal(validateBackup({...args,snapshot:{...snap,...patch}}).allowed,false);
 }
});
test('all backup writes fail closed pending independent backend and rollback approval',()=>{
 for(const confirmed of [false,true]){
  const r=requireExplicitWriteAuthorization({requestedUid:'a',currentUid:'a',verified:true,confirmed,sourceVersion:1});
  assert.equal(r.allowed,false);
 }
 assert.equal(requireExplicitWriteAuthorization({requestedUid:'a',currentUid:'b',verified:true,confirmed:true,sourceVersion:1}).allowed,false);
});
