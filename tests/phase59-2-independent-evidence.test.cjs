const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const matrix=require('../security/phase59-2-independent-evidence-matrix.json');
const prior=require('../security/phase59-1-release-requirements.json');
const gates=require('../security/phase51-consolidated-gates.json');
const gradle=fs.readFileSync('app/build.gradle.kts','utf8');
test('all seven gates remain open without fabricated independent evidence',()=>{
 assert.deepEqual(Object.keys(matrix.gateEvidence).sort(),Object.keys(gates.gates).sort());
 for(const [name,entry] of Object.entries(matrix.gateEvidence)){
   assert.equal(entry.status,'OPEN');
   assert.equal(entry.independentApproval,false);
   assert.equal(entry.reviewerSignoff,null);
   assert.equal(gates.gates[name].status,'OPEN');
 }
 assert.equal(matrix.reviewer.identity,null);
 assert.equal(matrix.approval,'NOT_APPROVED');
});
test('live messaging security and functionality evidence are explicitly missing',()=>{
 const ids=matrix.workstreams.map(w=>w.id);
 for(const id of ['CHAT_AUTH','CHAT_MEDIA','CHAT_RUNTIME'])assert.ok(ids.includes(id));
 assert.equal(prior.requirements.messaging.enabled,false);
 assert.equal(matrix.messaging,false);
});
test('APK upgrade requires installed metadata and disposable data checks',()=>{
 for(const id of ['APK_IDENTITY','APK_DATA'])assert.ok(matrix.workstreams.some(w=>w.id===id));
 assert.match(gradle,/applicationId = "com\.salonbook\.pro"/);
 assert.match(gradle,/versionCode = 2/);
 assert.equal(prior.requirements.androidUpgrade.installedPackageIdVerified,false);
 assert.equal(prior.requirements.androidUpgrade.safeUpgradeApproved,false);
});
test('safeguards and isolated staging remain unchanged',()=>{
 assert.equal(gates.mode,'offline-only');
 for(const key of ['productionPreferencesTouched','productionRestoreEnabled','liveBookings','payments','messaging','appCheckEnforcement','deployment'])assert.equal(matrix[key],false,key);
 assert.equal(matrix.originalAndroidAppointments,'DO_NOT_TOUCH');
 assert.ok(matrix.workstreams.every(w=>w.state.startsWith('MISSING_')));
});
