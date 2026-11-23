const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('JSON parser, booking identity checks and test cases are present',()=>{
 const source=read('app/src/main/java/com/salonbook/pro/AndroidStorageSnapshotAdapter.kt');
 const suite=read('app/src/test/java/com/salonbook/pro/AndroidStorageSnapshotAdapterValidationTest.kt');
 for(const token of ['JsonParser.parseString','Duplicate booking ID','Booking ID missing or invalid','isJsonObject'])assert.ok(source.includes(token),token);
 for(const token of ['duplicateBookingIdsAreRejected','malformedJsonAndTrailingTokensAreRejected','optionalServiceAndStaffIdsAllowLegacyRecords','twoUniqueSyntheticAppointmentsArePreserved'])assert.ok(suite.includes(token),token);
});
test('adapter is isolated from Android activity and storage writes',()=>{
 const source=read('app/src/main/java/com/salonbook/pro/AndroidStorageSnapshotAdapter.kt').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 assert.doesNotMatch(source,/getSharedPreferences|\.edit\(|putString|FirebaseFirestore|\.commit\(|\.apply\(/);
 for(const activity of ['MainActivity.kt','ManagementActivity.kt','CloudActivity.kt'])assert.doesNotMatch(read('app/src/main/java/com/salonbook/pro/'+activity),/AndroidStorageSnapshotAdapter/);
});
test('all launch blockers stay open',()=>{
 const gates=JSON.parse(read('security/phase51-consolidated-gates.json'));
 for(const gate of Object.values(gates.gates))assert.equal(gate.status,'OPEN');
 assert.equal(gates.originalAndroidAppointments,'DO_NOT_TOUCH');
 assert.equal(gates.deployment,false);
});
