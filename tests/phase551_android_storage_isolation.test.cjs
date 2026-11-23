const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('adapter only reads expected keys and is not connected to activities',()=>{
 const adapter=read('app/src/main/java/com/salonbook/pro/AndroidStorageSnapshotAdapter.kt');
 for(const key of ['"bookings"','"services"','"staff"'])assert.ok(adapter.includes(key));
 const executable=adapter.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 assert.doesNotMatch(executable,/getSharedPreferences|\.edit\(|putString|Firebase|\.commit\(|\.apply\(/);
 for(const p of ['MainActivity.kt','CloudActivity.kt','ManagementActivity.kt'])assert.doesNotMatch(read('app/src/main/java/com/salonbook/pro/'+p),/AndroidStorageSnapshotAdapter/);
});
test('launch gates and original appointment safety unchanged',()=>{
 const gates=JSON.parse(read('security/phase51-consolidated-gates.json'));
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
 assert.equal(gates.approval,'NOT_APPROVED');
 for(const v of Object.values(gates.gates))assert.equal(v.status,'OPEN');
});
