const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'security/phase534-evidence-manifest.json'),'utf8'));
const gates=JSON.parse(fs.readFileSync(path.join(root,'security/phase51-consolidated-gates.json'),'utf8'));
test('all seven gates remain open, no independent approval',()=>{
 assert.equal(manifest.decision,'NOT_APPROVED');
 assert.equal(manifest.independentReviewer.approval,false);
 assert.equal(manifest.independentReviewer.assigned,false);
 assert.deepEqual(Object.keys(manifest.gates).sort(),Object.keys(gates.gates).sort());
 for(const [id,g] of Object.entries(manifest.gates)){
  assert.equal(g.status,'OPEN',id);
  assert.equal(gates.gates[id].status,'OPEN',id);
  assert.equal(gates.gates[id].independentApproval,false,id);
  assert.ok(g.missing.length>0,id);
 }
});
test('hard stops and Android data preservation are unchanged',()=>{
 for(const [name,value] of Object.entries(manifest.hardStops))assert.equal(value,false,name);
 for(const name of ['deployment','liveBookings','payments','messaging','appCheckEnforcement'])
  assert.equal(gates[name],false,name);
 assert.equal(manifest.originalAndroidAppointments,'DO_NOT_TOUCH');
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
});
test('evidence references are present without claiming deployed rules',()=>{
 for(const p of ['docs/security/phase-53-2-firebase-environment-isolation.md','docs/security/phase-53-3-emulator-owner-isolation.md','tests/phase533.firestore.rules','app/src/main/java/com/salonbook/pro/RecoveryTransaction.kt'])
  assert.ok(fs.existsSync(path.join(root,p)),p);
 assert.equal(manifest.gates.G3.missing.some(x=>x.includes('Published staging rules')),true);
 assert.equal(manifest.gates.G7.missing.some(x=>x.includes('Durable Android recovery')),true);
});
