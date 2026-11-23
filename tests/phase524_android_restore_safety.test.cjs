const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const cloud=fs.readFileSync(path.join(root,'app/src/main/java/com/salonbook/pro/CloudActivity.kt'),'utf8');
const restore=cloud.slice(cloud.indexOf('    private fun restore() {'),cloud.indexOf('    private fun input('));
test('Android restore is preview only with no preference writes',()=>{
 assert.match(restore,/Cloud restore preview only/);
 assert.doesNotMatch(restore,/prefs\.edit\(/);
 assert.doesNotMatch(restore,/\.putString\(/);
 assert.doesNotMatch(restore,/\.commit\(/);
 assert.match(cloud,/\.setTitle\("Preview cloud backup\?"\)/);
});
test('capture account UID and check identity after asynchronous fetch',()=>{
 assert.match(restore,/val uid = user\.uid/);
 assert.match(restore,/backupDocument\(uid\)/);
 assert.match(restore,/auth\.currentUser\?\.uid != uid/);
 assert.doesNotMatch(cloud,/currentUser!!/);
});
test('fail closed for invalid version, size and malformed arrays',()=>{
 assert.match(restore,/getLong\("schemaVersion"\) != 1L/);
 assert.match(restore,/bookings\.length > 1_000_000/);
 assert.match(restore,/JSONArray\(bookings\)/);
 assert.match(restore,/JSONArray\(services\)/);
 assert.match(restore,/JSONArray\(staff\)/);
});
test('preserve all seven launch blockers',()=>{
 const g=JSON.parse(fs.readFileSync(path.join(root,'security/phase51-consolidated-gates.json'),'utf8'));
 assert.equal(Object.keys(g.gates).length,7);
 for(const x of Object.values(g.gates))assert.equal(x.status,'OPEN');
 assert.equal(g.originalAndroidAppointments,'DO_NOT_TOUCH');
 for(const k of ['deployment','liveBookings','payments','messaging','appCheckEnforcement'])assert.equal(g[k],false);
});
