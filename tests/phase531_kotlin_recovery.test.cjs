const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=read('app/src/main/java/com/salonbook/pro/RecoveryTransaction.kt');
const gate=JSON.parse(read('security/phase51-consolidated-gates.json'));
test('Kotlin recovery prototype uses an injected store and preserves original snapshot',()=>{
 for(const phrase of ['interface RecoveryStore','val original =','storage.read()','storage.write(incoming)','storage.write(original)','Outcome.RolledBack','Outcome.RecoveryFailed'])
  assert.ok(source.includes(phrase),phrase);
});
test('prototype explicitly avoids Android/Firebase and has no production integration',()=>{
 assert.doesNotMatch(source,/FirebaseFirestore|SharedPreferences|android\.content|\.collection\(/);
 assert.match(source,/in-memory recovery transaction prototype/);
});
test('all seven launch gates remain open',()=>{
 assert.equal(Object.keys(gate.gates).length,7);
 for(const x of Object.values(gate.gates))assert.equal(x.status,'OPEN');
 for(const key of ['deployment','liveBookings','payments','messaging','appCheckEnforcement'])assert.equal(gate[key],false);
 assert.equal(gate.originalAndroidAppointments,'DO_NOT_TOUCH');
});
