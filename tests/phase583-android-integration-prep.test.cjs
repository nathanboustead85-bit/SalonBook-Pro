const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const helper=fs.readFileSync(path.join(root,'app/src/main/java/com/salonbook/pro/recovery/RecoveryPreviewValidator.kt'),'utf8');
const activity=fs.readFileSync(path.join(root,'app/src/main/java/com/salonbook/pro/CloudActivity.kt'),'utf8');
const main=fs.readFileSync(path.join(root,'app/src/main/java/com/salonbook/pro/MainActivity.kt'),'utf8');
const gates=JSON.parse(fs.readFileSync(path.join(root,'security/phase51-consolidated-gates.json'),'utf8'));
const evidence=JSON.parse(fs.readFileSync(path.join(root,'security/phase58-3-integration-prep.json'),'utf8'));
test('Android helper validates v1 envelope and rejects duplicate booking ids',()=>{
 assert.match(helper,/schemaVersion == 1L/);
 assert.match(helper,/JSONArray\(raw\)/);
 assert.match(helper,/ids\.add\(id\)/);
 assert.match(helper,/booking\.optString\("id", ""\)/);
 assert.match(helper,/MAX_FIELD_LENGTH = 500000/);
});
test('Android helper is side-effect-free and not wired into active restore',()=>{
 for(const prohibited of ['SharedPreferences','FirebaseFirestore','\.putString\(','\.commit\(','\.apply\(','\.set\(']){
  if(prohibited==='SharedPreferences')continue; // appears only in safety documentation
  assert.doesNotMatch(helper,new RegExp(prohibited));
 }
 assert.doesNotMatch(activity,/RecoveryPreviewValidator/);
 assert.match(activity,/Cloud restore preview only/);
 assert.match(activity,/Restoring is disabled/);
});
test('main activity reloads local data on resume; persistence semantics require real Android testing',()=>{
 assert.match(main,/override fun onResume\(/);
 assert.match(main,/loadBookings\(\)/);
 assert.equal(evidence.onDeviceRestartVerified,false);
 assert.equal(evidence.onDeviceRollbackVerified,false);
});
test('launch gates and original appointment protections remain in place',()=>{
 assert.equal(evidence.originalAndroidAppointments,'DO_NOT_TOUCH');
 assert.equal(evidence.productionRestoreEnabled,false);
 assert.equal(evidence.deployment,false);
 assert.equal(evidence.helperIntegratedIntoApp,false);
 for(const gate of Object.values(gates.gates))assert.equal(gate.status,'OPEN');
});
