const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const gates = JSON.parse(fs.readFileSync(path.join(root, 'security/phase51-consolidated-gates.json'), 'utf8'));
test('Phase 51 never claims independent staging approval', () => {
 assert.equal(gates.environment, 'boustio-staging');
 assert.equal(gates.mode, 'offline-only');
 assert.equal(gates.approval, 'NOT_APPROVED');
 for (const [id, gate] of Object.entries(gates.gates)) {
  assert.match(id, /^G[1-7]$/);
  assert.equal(gate.status, 'OPEN');
  assert.equal(gate.independentApproval, false);
  assert.equal(gate.realStagingEvidence, false);
 }
 assert.equal(Object.keys(gates.gates).length, 7);
});
test('No live activation or Android appointment mutation', () => {
 for (const key of ['deployment','liveBookings','payments','messaging','appCheckEnforcement']) assert.equal(gates[key], false);
 assert.equal(gates.originalAndroidAppointments, 'DO_NOT_TOUCH');
});
test('Review checklist retains all independent evidence categories', () => {
 const text = fs.readFileSync(path.join(root,'docs/security/phase-51-consolidated-verification.md'),'utf8');
 for (const term of ['Firestore','Authentication','App Check','IAM','concurrency','messaging','rollback','independent reviewer']) assert.ok(text.includes(term), term);
});
