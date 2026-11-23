const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app/src/main/java/com/salonbook/pro/CloudActivity.kt'),'utf8');
const candidate=fs.readFileSync(path.join(root,'security/candidates/phase57-9-firestore.rules'),'utf8');
const gates=JSON.parse(fs.readFileSync(path.join(root,'security/phase51-consolidated-gates.json'),'utf8'));
const readiness=JSON.parse(fs.readFileSync(path.join(root,'security/phase58-1-recovery-readiness.json'),'utf8'));
function method(name){const start=source.indexOf('private fun '+name+'(');assert.ok(start>=0,name+' exists');const next=source.indexOf('\n    private fun ',start+1);return source.slice(start,next<0?source.length:next)}
test('Android recovery remains preview-only and cannot overwrite local appointments',()=>{
 const backup=method('backup'),restore=method('restore');
 assert.match(backup,/Cloud backup preview only/);
 assert.match(restore,/Cloud restore preview only/);
 assert.doesNotMatch(backup,/\.set\s*\(|\.update\s*\(|\.add\s*\(/);
 assert.doesNotMatch(restore,/prefs\.edit\s*\(|\.putString\s*\(|\.clear\s*\(/);
});
test('restore requires verified owner and validates fields before preview',()=>{
 const restore=method('restore');
 assert.match(restore,/!user\.isEmailVerified/);
 assert.match(restore,/auth\.currentUser\?\.uid != uid/);
 assert.match(restore,/document\.getLong\("schemaVersion"\) != 1L/);
 for(const field of ['bookings','services','staff'])assert.ok(restore.includes('document.getString("'+field+'")'));
 assert.match(restore,/JSONArray\(/);
});
test('backup preview reads local arrays and never writes cloud',()=>{
 const backup=method('backup');
 for(const field of ['bookings','services','staff'])assert.ok(backup.includes('prefs.getString("'+field+'"'));
 assert.match(backup,/JSONArray\(/);
 assert.doesNotMatch(backup,/backupDocument\(uid\)/);
});
test('isolated candidate matches Android field names but cannot prove JSON validity',()=>{
 for(const field of ['bookings','services','staff','schemaVersion'])assert.ok(candidate.includes('"'+field+'"'));
 assert.ok(readiness.outstandingRisks.includes('Firestore rules cannot validate JSON array contents'));
});
test('real device and independent approval remain explicitly unverified',()=>{
 for(const key of ['realAndroidRestoreVerified','realCloudMigrationVerified','rollbackOnDeviceVerified','independentSecurityApproval','candidateDeployed'])assert.equal(readiness[key],false);
 assert.equal(readiness.originalAndroidAppointments,'DO_NOT_TOUCH');
 assert.equal(readiness.deployment,false);
 for(const gate of Object.values(gates.gates))assert.equal(gate.status,'OPEN');
});
