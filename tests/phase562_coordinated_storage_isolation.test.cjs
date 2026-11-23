const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('single-process coordinator and concurrency tests exist',()=>{
 const source=read('app/src/main/java/com/salonbook/pro/CoordinatedSnapshotStore.kt');
 const suite=read('app/src/test/java/com/salonbook/pro/CoordinatedSnapshotStoreTest.kt');
 for(const term of ['@Synchronized fun update','expectedRevision != revision','Update interrupted','revision++'])assert.ok(source.includes(term),term);
 for(const term of ['simultaneousUpdatesYieldExactlyOneWinner','staleRevisionDoesNotOverwriteWinner','interruptedTransformLeavesOriginalUnchanged','revisionExhaustionFailsClosed'])assert.ok(suite.includes(term),term);
});
test('no production Android integration or persistence writes',()=>{
 const source=read('app/src/main/java/com/salonbook/pro/CoordinatedSnapshotStore.kt');
 assert.doesNotMatch(source,/getSharedPreferences|FirebaseFirestore|\.edit\(|putString|\.commit\(|\.apply\(/);
 for(const activity of ['MainActivity.kt','ManagementActivity.kt','CloudActivity.kt'])assert.doesNotMatch(read('app/src/main/java/com/salonbook/pro/'+activity),/CoordinatedSnapshotStore/);
});
test('all seven blockers remain open',()=>{
 const g=JSON.parse(read('security/phase51-consolidated-gates.json'));
 assert.equal(Object.keys(g.gates).length,7);
 for(const gate of Object.values(g.gates))assert.equal(gate.status,'OPEN');
 for(const key of ['deployment','liveBookings','payments','messaging','appCheckEnforcement'])assert.equal(g[key],false);
 assert.equal(g.originalAndroidAppointments,'DO_NOT_TOUCH');
});
