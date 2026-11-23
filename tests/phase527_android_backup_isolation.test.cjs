const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const cloud=read('app/src/main/java/com/salonbook/pro/CloudActivity.kt');
const backup=cloud.slice(cloud.indexOf('    private fun backup() {'),cloud.indexOf('    // Phase 52.4:'));
const restore=cloud.slice(cloud.indexOf('    private fun restore() {'),cloud.indexOf('    private fun input('));
test('backup is local-only preview with no Firestore or preference writes',()=>{
 assert.match(backup,/Cloud backup preview only/);
 assert.match(backup,/val uid = user\.uid/);
 assert.match(backup,/auth\.currentUser\?\.uid != uid/);
 assert.match(backup,/auth\.currentUser\?\.isEmailVerified != true/);
 for(const forbidden of ['.set(','.update(','.delete(','.add(','.putString(','.commit(','.edit('])
  assert.equal(backup.includes(forbidden),false,forbidden);
});
test('restore is read-only preview and account isolated',()=>{
 assert.match(restore,/backupDocument\(uid\)/);
 assert.match(restore,/get\(Source.SERVER\)/);
 assert.match(restore,/auth\.currentUser\?\.uid != uid/);
 for(const forbidden of ['.set(','.update(','.delete(','.putString(','.commit(','.edit('])
  assert.equal(restore.includes(forbidden),false,forbidden);
});
test('both UI actions clearly say preview',()=>{
 assert.match(cloud,/addButton\("Preview Local Backup"\)/);
 assert.match(cloud,/addButton\("Preview Cloud Restore"\)/);
 assert.match(cloud,/No cloud writes are permitted/);
});
test('all seven blockers remain open',()=>{
 const g=JSON.parse(read('security/phase51-consolidated-gates.json'));
 assert.equal(Object.keys(g.gates).length,7);
 for(const x of Object.values(g.gates))assert.equal(x.status,'OPEN');
 for(const k of ['deployment','liveBookings','payments','messaging','appCheckEnforcement'])assert.equal(g[k],false);
 assert.equal(g.originalAndroidAppointments,'DO_NOT_TOUCH');
});
