const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('orphan recovery uses original copy and retains fail-closed guards',()=>{
 const source=fs.readFileSync(path.join(root,'app/src/main/java/com/salonbook/pro/DurableRecoveryJournal.kt'),'utf8');
 const suite=fs.readFileSync(path.join(root,'app/src/test/java/com/salonbook/pro/DurableRecoveryJournalTest.kt'),'utf8');
 assert.match(source,/if \(!original\.exists\(\)\)/);
 assert.match(source,/val safe = decode\(original\)/);
 for(const name of ['crashBeforeMarkerRestoresOriginalOnRestart','crashAfterMarkerCleanupRestoresOriginalOnRestart','corruptOrphanOriginalFailsClosedWithoutDeletingActive','secondRecoveryAfterInterruptedRollbackIsIdempotent'])assert.ok(suite.includes(name),name);
 assert.doesNotMatch(source,/getSharedPreferences|FirebaseFirestore|FirebaseAuth|salonbook_data/);
});
test('launch blockers remain open',()=>{
 const gates=JSON.parse(fs.readFileSync(path.join(root,'security/phase51-consolidated-gates.json'),'utf8'));
 for(const gate of Object.values(gates.gates))assert.equal(gate.status,'OPEN');
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
});
