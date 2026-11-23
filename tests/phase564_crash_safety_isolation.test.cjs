const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
test('crash simulator has no production write integration', () => {
 const source = read('app/src/main/java/com/salonbook/pro/RecoveryCrashSimulator.kt');
 assert.match(source, /enum class FailurePoint/);
 assert.match(source, /RecoveryConcurrencyGuard/);
 assert.doesNotMatch(source, /FirebaseFirestore|getSharedPreferences|\.edit\(|\.commit\(|\.apply\(|\.set\(/);
 for (const activity of ['MainActivity.kt','ManagementActivity.kt','CloudActivity.kt'])
   assert.doesNotMatch(read('app/src/main/java/com/salonbook/pro/'+activity), /RecoveryCrashSimulator/);
});
test('seven launch blockers remain open and Android appointments protected', () => {
 const g = JSON.parse(read('security/phase51-consolidated-gates.json'));
 assert.equal(Object.keys(g.gates).length, 7);
 for (const gate of Object.values(g.gates)) assert.equal(gate.status, 'OPEN');
 for (const field of ['deployment','liveBookings','payments','messaging','appCheckEnforcement'])
   assert.equal(g[field], false);
 assert.equal(g.originalAndroidAppointments, 'DO_NOT_TOUCH');
});
