const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('versioned envelope and fail-closed tests exist',()=>{
 const source=read('app/src/main/java/com/salonbook/pro/VersionedSnapshotProtocol.kt');
 const suite=read('app/src/test/java/com/salonbook/pro/VersionedSnapshotProtocolTest.kt');
 for(const token of ['readRevision()','before != after','MessageDigest.getInstance("SHA-256")','Result.Rejected'])assert.ok(source.includes(token),token);
 for(const token of ['changingRevisionFailsClosed','missingOrInvalidRevisionFailsClosed','payloadBoundariesAreUnambiguous','stableRevisionPreservesTwoSyntheticBookings'])assert.ok(suite.includes(token),token);
});
test('prototype is isolated from Android and production writes',()=>{
 const source=read('app/src/main/java/com/salonbook/pro/VersionedSnapshotProtocol.kt');
 assert.doesNotMatch(source,/getSharedPreferences|FirebaseFirestore|\.edit\(|putString|\.commit\(|\.apply\(/);
 for(const activity of ['MainActivity.kt','ManagementActivity.kt','CloudActivity.kt'])assert.doesNotMatch(read('app/src/main/java/com/salonbook/pro/'+activity),/VersionedSnapshotProtocol/);
});
test('all launch gates remain open',()=>{
 const g=JSON.parse(read('security/phase51-consolidated-gates.json'));
 assert.equal(Object.keys(g.gates).length,7);
 for(const x of Object.values(g.gates))assert.equal(x.status,'OPEN');
 for(const field of ['deployment','liveBookings','payments','messaging','appCheckEnforcement'])assert.equal(g[field],false);
 assert.equal(g.originalAndroidAppointments,'DO_NOT_TOUCH');
});
