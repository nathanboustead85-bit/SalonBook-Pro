const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('audit suite exercises synthetic preservation, corruption and concurrent change',()=>{
 const suite=read('app/src/test/java/com/salonbook/pro/AndroidStorageFinalAuditTest.kt');
 for(const token of ['repeatedCaptureIsDeterministicAndReadOnly','allThreeKeysAreRequiredEvenWhenBookingsAreEmpty','corruptionOfEachKeyFailsClosed','duplicateAppointmentIdIsRejectedWithoutChangingOriginal','changeAfterFirstPassIsRejected','secondPassInterruptionIsRejected','oversizedPayloadIsRejectedWithoutMutation'])assert.ok(suite.includes(token),token);
});
test('no integration with Android storage, production or write paths',()=>{
 const source=read('app/src/main/java/com/salonbook/pro/AndroidStorageSnapshotAdapter.kt').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 assert.doesNotMatch(source,/getSharedPreferences|\.edit\(|putString|FirebaseFirestore|\.commit\(|\.apply\(/);
 for(const activity of ['MainActivity.kt','ManagementActivity.kt','CloudActivity.kt'])assert.doesNotMatch(read('app/src/main/java/com/salonbook/pro/'+activity),/AndroidStorageSnapshotAdapter|DurableRecoveryJournal/);
});
test('all launch blockers and production restrictions remain in place',()=>{
 const gates=JSON.parse(read('security/phase51-consolidated-gates.json'));
 assert.equal(gates.approval,'NOT_APPROVED');
 for(const gate of Object.values(gates.gates)) {
   assert.equal(gate.status,'OPEN');
   assert.equal(gate.independentApproval,false);
   assert.equal(gate.realStagingEvidence,false);
 }
 for(const field of ['deployment','liveBookings','payments','messaging','appCheckEnforcement'])assert.equal(gates[field],false);
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
});
test('audit explicitly documents outstanding release blockers',()=>{
 const report=read('docs/security/phase-55-4-final-android-storage-audit.md');
 for(const term of ['NOT RELEASE READY','atomic cross-key','ABA','production Firebase','device','directory fsync','G1–G7'])assert.ok(report.includes(term),term);
});
