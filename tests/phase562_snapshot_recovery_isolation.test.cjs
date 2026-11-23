const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
test('recovery verifier is read-only and never integrated with production', () => {
 const source = read('app/src/main/java/com/salonbook/pro/SnapshotRecoveryVerifier.kt');
 assert.match(source, /MessageDigest.isEqual/);
 assert.match(source, /currentRevision != expectedRevision/);
 assert.doesNotMatch(source, /FirebaseFirestore|getSharedPreferences|\.edit\(|\.commit\(|\.apply\(|\.set\(/);
 for (const activity of ['MainActivity.kt','ManagementActivity.kt','CloudActivity.kt'])
   assert.doesNotMatch(read('app/src/main/java/com/salonbook/pro/'+activity), /SnapshotRecoveryVerifier/);
});
test('all seven blockers remain open and original appointments untouched', () => {
 const gates = JSON.parse(read('security/phase51-consolidated-gates.json'));
 assert.equal(Object.keys(gates.gates).length, 7);
 for (const gate of Object.values(gates.gates)) assert.equal(gate.status, 'OPEN');
 for (const field of ['deployment','liveBookings','payments','messaging','appCheckEnforcement'])
   assert.equal(gates[field], false);
 assert.equal(gates.originalAndroidAppointments, 'DO_NOT_TOUCH');
});
