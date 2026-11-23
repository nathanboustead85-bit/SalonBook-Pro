const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('crash checkpoints and fail-closed orphan handling are covered',()=>{
 const source=fs.readFileSync(path.join(root,'app/src/main/java/com/salonbook/pro/DurableRecoveryJournal.kt'),'utf8');
 const tests=fs.readFileSync(path.join(root,'app/src/test/java/com/salonbook/pro/DurableRecoveryJournalTest.kt'),'utf8');
 for(const stage of ['after-original','after-marker','after-pending','after-active','after-pending-cleanup','after-marker-cleanup']){
  assert.ok(source.includes('interruptionPoint("'+stage+'")'),stage);
  assert.ok(tests.includes('"'+stage+'"'),stage);
 }
 assert.match(tests,/assertTrue\("Recovery must be idempotent"/);
 assert.doesNotMatch(source,/getSharedPreferences|FirebaseFirestore|FirebaseAuth|salonbook_data/);
});
test('seven launch gates remain open',()=>{
 const gates=JSON.parse(fs.readFileSync(path.join(root,'security/phase51-consolidated-gates.json'),'utf8'));
 for(const gate of Object.values(gates.gates))assert.equal(gate.status,'OPEN');
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
});
