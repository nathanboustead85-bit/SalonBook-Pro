const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const doc = fs.readFileSync(path.join(root, 'docs/security/phase-49-3-independent-backend-verification.md'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/boustio-phase-493-independent-security.yml'), 'utf8');
const fixture = require('./phase493_security_fixture.cjs');
test('all seven blockers remain explicitly open', () => {
  assert.match(doc, /OPEN \(7\/7\)/);
  assert.match(doc, /NOT INDEPENDENTLY VERIFIED/);
});
test('no privileged actions in CI', () => {
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /firebase deploy|gcloud auth|secrets\.|service.account|pull_request_target/);
});
test('revoked, expired and forged tokens fail closed in isolated policy fixture', () => {
  for (const token of [{uid:'A',revoked:true},{uid:'A',expiresAt:10},{uid:'A',signatureValid:false},null]) {
    assert.equal(fixture.authorize({token, ownerId:'A', now:20}),false);
  }
});
test('cross-owner access denied, owner access allowed with valid session', () => {
  const token={uid:'A',expiresAt:100,signatureValid:true,revoked:false};
  assert.equal(fixture.authorize({token,ownerId:'B',now:20}),false);
  assert.equal(fixture.authorize({token,ownerId:'A',now:20}),true);
});
test('staging-only verification is not confused with production proof', () => {
  assert.match(doc, /Admin SDK bypasses Firestore Rules/);
  assert.match(doc, /not.*production Admin SDK revocation semantics/i);
  assert.match(doc, /two original Android appointments/);
  assert.match(doc, /DISABLED/);
});
