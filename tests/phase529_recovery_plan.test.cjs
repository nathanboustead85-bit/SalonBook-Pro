const test=require('node:test');
const assert=require('node:assert/strict');
const {inspectRecovery,approveRestore}=require('../security/phase529-recovery-plan.cjs');
const snapshot={schemaVersion:1,bookings:'[{"id":"test-appointment"}]',services:'[]',staff:'[]'};
const localData={bookings:[{id:'original-synthetic'}],services:[],staff:[]};
const base={snapshot,expectedUid:'synthetic-a',currentUid:'synthetic-a',emailVerified:true,localData};
test('preview is deterministic and never modifies local data',()=>{
 const before=JSON.stringify(localData);
 const a=inspectRecovery(base),b=inspectRecovery(base);
 assert.equal(a.safe,true);assert.equal(a.writeAuthorized,false);
 assert.deepEqual(a,b);assert.equal(a.preview[0].localCount,1);
 assert.equal(JSON.stringify(localData),before);
});
test('deny cross-account and unverified sessions',()=>{
 for(const p of [{currentUid:'synthetic-b'},{expectedUid:null},{emailVerified:false}])
  assert.equal(inspectRecovery({...base,...p}).safe,false);
});
test('reject invalid, oversized or incompatible snapshots',()=>{
 for(const patch of [{schemaVersion:2},{bookings:'not-json'},{bookings:'{}'},{bookings:'x'.repeat(1000001)}])
  assert.equal(inspectRecovery({...base,snapshot:{...snapshot,...patch}}).safe,false);
});
test('reject unknown local data rather than assume it is empty',()=>{
 assert.equal(inspectRecovery({...base,localData:{bookings:[],services:[]}}).safe,false);
 assert.equal(inspectRecovery({...base,localData:null}).safe,false);
});
test('write approval remains impossible without rollback and backend verification',()=>{
 assert.equal(approveRestore().allowed,false);
});
