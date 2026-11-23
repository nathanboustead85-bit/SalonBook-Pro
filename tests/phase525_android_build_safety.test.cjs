const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const cloud=read('app/src/main/java/com/salonbook/pro/CloudActivity.kt');
const restore=cloud.slice(cloud.indexOf('    private fun restore() {'),cloud.indexOf('    private fun input('));
const gate=JSON.parse(read('security/phase51-consolidated-gates.json'));
test('backup uses stable authenticated UID and verified account',()=>{
 assert.match(cloud,/private fun backupDocument\(uid: String\)/);
 assert.match(cloud,/backupDocument\(uid\)/);
 assert.match(cloud,/if \(!user\.isEmailVerified\)/);
 assert.doesNotMatch(cloud,/currentUser!!/);
});
test('restore cannot overwrite local data',()=>{
 assert.match(restore,/Cloud restore preview only/);
 for(const forbidden of ['prefs.edit(','.putString(','.commit('])assert.equal(restore.includes(forbidden),false);
});
test('Android manifest backup setting remains explicitly under review',()=>{
 const manifest=read('app/src/main/AndroidManifest.xml');
 assert.match(manifest,/android:allowBackup="true"/);
 const report=read('docs/security/phase-52-2-ai-assisted-source-review.md');
 assert.match(report,/backup\/data-extraction rules/);
});
test('all seven launch blockers remain open',()=>{
 assert.equal(Object.keys(gate.gates).length,7);
 for(const g of Object.values(gate.gates))assert.equal(g.status,'OPEN');
 for(const k of ['deployment','liveBookings','payments','messaging','appCheckEnforcement'])assert.equal(gate[k],false);
 assert.equal(gate.originalAndroidAppointments,'DO_NOT_TOUCH');
});
