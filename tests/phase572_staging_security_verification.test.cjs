const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
test('staging security verification requires independent evidence', () => {
 const x = JSON.parse(read('security/phase57-2-staging-security-verification.json'));
 assert.equal(x.status, 'NOT_VERIFIED');
 assert.equal(x.approval, 'NOT_APPROVED');
 assert.equal(x.executionAuthorized, false);
 assert.equal(x.productionAccess, false);
 assert.equal(x.stagingAccess, false);
 assert.equal(x.checks.length, 7);
 for (const check of x.checks) { assert.equal(check.status, 'OPEN'); assert.equal(check.evidence, null); }
});
test('existing recovery staging prerequisites and launch blockers remain open', () => {
 const prior = JSON.parse(read('security/phase57-1-staging-recovery-readiness.json'));
 assert.equal(prior.executionAuthorized, false);
 assert.equal(prior.prerequisites.length, 7);
 for (const p of prior.prerequisites) assert.equal(p.status, 'OPEN');
 const gates = JSON.parse(read('security/phase51-consolidated-gates.json'));
 assert.equal(Object.keys(gates.gates).length, 7);
 for (const gate of Object.values(gates.gates)) assert.equal(gate.status, 'OPEN');
 const current = JSON.parse(read('security/phase57-2-staging-security-verification.json'));
 for (const feature of ['deployment','liveBookings','payments','messaging','appCheckEnforcement']) {
  assert.equal(current[feature], false);
  assert.equal(gates[feature], false);
 }
 assert.equal(current.originalAndroidAppointments, 'DO_NOT_TOUCH');
 assert.equal(gates.originalAndroidAppointments, 'DO_NOT_TOUCH');
});
test('audit states actual cloud configuration is not verified', () => {
 const doc = read('security/phase57-2-staging-security-verification.md');
 for (const term of ['NOT VERIFIED','Firestore','Storage','least-privilege','independent','DO_NOT_TOUCH','OPEN'])
  assert.ok(doc.includes(term), 'Missing requirement: '+term);
});
