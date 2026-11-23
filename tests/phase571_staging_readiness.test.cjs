const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
test('staging prerequisites remain explicitly unapproved', () => {
 const plan = JSON.parse(read('security/phase57-1-staging-recovery-readiness.json'));
 assert.equal(plan.mode, 'planning-only');
 assert.equal(plan.approval, 'NOT_APPROVED');
 assert.equal(plan.executionAuthorized, false);
 assert.equal(plan.prerequisites.length, 7);
 for (const p of plan.prerequisites) {
  assert.equal(p.status, 'OPEN');
  assert.equal(p.evidence, null);
 }
});
test('existing launch gates and original appointments are protected', () => {
 const gates = JSON.parse(read('security/phase51-consolidated-gates.json'));
 assert.equal(Object.keys(gates.gates).length, 7);
 for (const gate of Object.values(gates.gates)) assert.equal(gate.status, 'OPEN');
 const plan = JSON.parse(read('security/phase57-1-staging-recovery-readiness.json'));
 for (const f of ['deployment','liveBookings','payments','messaging','appCheckEnforcement']) {
  assert.equal(plan[f], false);
  assert.equal(gates[f], false);
 }
 assert.equal(plan.originalAndroidAppointments, 'DO_NOT_TOUCH');
 assert.equal(gates.originalAndroidAppointments, 'DO_NOT_TOUCH');
});
test('plan discloses missing real-world evidence', () => {
 const doc = read('security/phase57-1-staging-recovery-readiness.md');
 for (const word of ['process termination','network partition','idempotency','independent','NOT APPROVED','DO_NOT_TOUCH']) {
  assert.ok(doc.includes(word), word);
 }
});
