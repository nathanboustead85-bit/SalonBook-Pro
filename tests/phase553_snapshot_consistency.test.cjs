const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('snapshot consistency uses two passes and fail-closed comparison',()=>{
 const source=read('app/src/main/java/com/salonbook/pro/AndroidStorageSnapshotAdapter.kt');
 const suite=read('app/src/test/java/com/salonbook/pro/AndroidStorageSnapshotConsistencyTest.kt');
 for(const token of ['readPass(keys)','first != second','validatePass(keys, second)','Preferences changed during snapshot capture'])assert.ok(source.includes(token),token);
 for(const token of ['changingBookingsBetweenPassesFailsClosed','changingServicesBetweenPassesFailsClosed','changingStaffBetweenPassesFailsClosed','missingKeyOnSecondPassFailsClosed','secondPassReadExceptionFailsClosed'])assert.ok(suite.includes(token),token);
});
test('adapter is not wired to Android or persistence writes',()=>{
 const source=read('app/src/main/java/com/salonbook/pro/AndroidStorageSnapshotAdapter.kt').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 assert.doesNotMatch(source,/getSharedPreferences|\.edit\(|putString|FirebaseFirestore|\.commit\(|\.apply\(/);
 for(const activity of ['MainActivity.kt','ManagementActivity.kt','CloudActivity.kt'])assert.doesNotMatch(read('app/src/main/java/com/salonbook/pro/'+activity),/AndroidStorageSnapshotAdapter/);
});
test('seven blockers and live feature restrictions remain intact',()=>{
 const gates=JSON.parse(read('security/phase51-consolidated-gates.json'));
 for(const gate of Object.values(gates.gates))assert.equal(gate.status,'OPEN');
 for(const field of ['deployment','liveBookings','payments','messaging','appCheckEnforcement'])assert.equal(gates[field],false);
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
});
