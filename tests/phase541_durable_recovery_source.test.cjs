const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('durable recovery is isolated and does not access customer preferences or Firebase',()=>{
 const source=fs.readFileSync(path.join(root,'app/src/main/java/com/salonbook/pro/DurableRecoveryJournal.kt'),'utf8');
 assert.match(source,/ATOMIC_MOVE/);
 assert.match(source,/MessageDigest/);
 assert.match(source,/fun recover\(/);
 assert.doesNotMatch(source,/getSharedPreferences|FirebaseFirestore|FirebaseAuth|salonbook_data/);
 const activity=fs.readFileSync(path.join(root,'app/src/main/java/com/salonbook/pro/CloudActivity.kt'),'utf8');
 assert.doesNotMatch(activity,/DurableRecoveryJournal/);
});
test('launch blockers remain open',()=>{
 const g=JSON.parse(fs.readFileSync(path.join(root,'security/phase51-consolidated-gates.json'),'utf8'));
 assert.equal(Object.keys(g.gates).length,7);
 for(const v of Object.values(g.gates))assert.equal(v.status,'OPEN');
 assert.equal(g.originalAndroidAppointments,'DO_NOT_TOUCH');
});
