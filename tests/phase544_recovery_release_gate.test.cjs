const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('final audit covers crash, integrity, limits, unicode and restart',()=>{
 const tests=read('app/src/test/java/com/salonbook/pro/DurableRecoveryJournalFinalAuditTest.kt');
 for(const name of ['twoSyntheticAppointmentsSurviveCrashAtEveryCheckpoint','repeatedSuccessfulUpdatesPersistAcrossNewJournalInstances','unicodeAndLineBreaksRoundTripWithoutTruncation','oversizedPayloadIsRejectedWithoutChangingOriginal','corruptedOriginalNeverSilentlyReplacesActive','unknownPendingWithoutOriginalRemainsBlocked','invalidPayloadNeverBeginsTransaction'])assert.ok(tests.includes(name),name);
});
test('isolated recovery has no production storage integration',()=>{
 const source=read('app/src/main/java/com/salonbook/pro/DurableRecoveryJournal.kt');
 assert.doesNotMatch(source,/getSharedPreferences|FirebaseFirestore|FirebaseAuth|salonbook_data/);
 for(const p of ['app/src/main/java/com/salonbook/pro/MainActivity.kt','app/src/main/java/com/salonbook/pro/CloudActivity.kt'])assert.doesNotMatch(read(p),/DurableRecoveryJournal/);
});
test('G1 to G7 remain open, with no deployment or live booking authorization',()=>{
 const g=JSON.parse(read('security/phase51-consolidated-gates.json'));
 assert.deepEqual(Object.keys(g.gates),['G1','G2','G3','G4','G5','G6','G7']);
 for(const gate of Object.values(g.gates)){
  assert.equal(gate.status,'OPEN');
  assert.equal(gate.independentApproval,false);
  assert.equal(gate.realStagingEvidence,false);
 }
 assert.equal(g.approval,'NOT_APPROVED');
 for(const field of ['deployment','liveBookings','payments','messaging','appCheckEnforcement'])assert.equal(g[field],false);
 assert.equal(g.originalAndroidAppointments,'DO_NOT_TOUCH');
});
