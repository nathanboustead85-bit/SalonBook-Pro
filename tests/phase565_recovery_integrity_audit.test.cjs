const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
test('all five phases have source and test evidence', () => {
 for (const [source, suite] of [
  ['VersionedSnapshotProtocol','VersionedSnapshotProtocolTest'],
  ['SnapshotRecoveryVerifier','SnapshotRecoveryVerifierTest'],
  ['RecoveryConcurrencyGuard','RecoveryConcurrencyGuardTest'],
  ['RecoveryCrashSimulator','RecoveryCrashSimulatorTest']
 ]) {
  assert.ok(read('app/src/main/java/com/salonbook/pro/'+source+'.kt').length > 100);
  assert.ok(read('app/src/test/java/com/salonbook/pro/'+suite+'.kt').length > 100);
 }
 assert.ok(read('app/src/test/java/com/salonbook/pro/RecoveryIntegrityAuditTest.kt').length > 100);
});
test('no recovery integration into Android entry points', () => {
 for (const activity of ['MainActivity.kt','ManagementActivity.kt','CloudActivity.kt']) {
  const source = read('app/src/main/java/com/salonbook/pro/'+activity);
  for (const symbol of ['VersionedSnapshotProtocol','SnapshotRecoveryVerifier','RecoveryConcurrencyGuard','RecoveryCrashSimulator'])
   assert.equal(source.includes(symbol), false, activity+' references '+symbol);
 }
});
test('all seven release blockers remain open and live features disabled', () => {
 const gates = JSON.parse(read('security/phase51-consolidated-gates.json'));
 assert.equal(Object.keys(gates.gates).length, 7);
 for (const gate of Object.values(gates.gates)) {
  assert.equal(gate.status, 'OPEN');
  assert.equal(gate.independentApproval, false);
 }
 for (const feature of ['deployment','liveBookings','payments','messaging','appCheckEnforcement'])
  assert.equal(gates[feature], false);
 assert.equal(gates.originalAndroidAppointments, 'DO_NOT_TOUCH');
 assert.equal(gates.approval, 'NOT_APPROVED');
});
test('audit explicitly records production limitations', () => {
 const audit = read('security/phase56-5-recovery-integrity-audit.md');
 for (const term of ['cross-process','durable','process-kill','staging','NOT APPROVED','OPEN'])
  assert.ok(audit.includes(term), 'Missing limitation: '+term);
});
