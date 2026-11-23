const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const handover=require('../security/phase58-10-handover.json');
const review=require('../security/phase58-9-final-recovery-review.json');
const gates=require('../security/phase51-consolidated-gates.json');
const cloud=fs.readFileSync('app/src/main/java/com/salonbook/pro/CloudActivity.kt','utf8');

test('handover contains all six verified prior green runs',()=>{
  assert.deepEqual(handover.verifiedGreenRuns,{"58.4":45187104392,"58.5":45187434947,"58.6":45188057394,"58.7":45188428953,"58.8":45188810718,"58.9":45189033809});
  assert.deepEqual(Object.entries(handover.verifiedGreenRuns).slice(0,5),Object.entries(review.verifiedGithubRuns));
});
test('handover is NOT production approval and physical testing is outstanding',()=>{
  assert.equal(handover.productionApproval,'NOT_APPROVED');
  for(const k of ['independentSecurityVerificationComplete','realSamsungRestoreVerified','androidProcessDeathRecoveryVerified','rollbackAndCommitFailureVerified','backupSchemaCompatibilityVerified','productionRestoreEnabled','cloudBackupWritesEnabled','productionPreferencesTouched','deployment','liveBookings','payments','messaging','appCheckEnforcement'])assert.equal(handover[k],false,k);
  assert.equal(handover.originalAndroidAppointments,'DO_NOT_TOUCH');
  assert.equal(handover.handoverTo,'59');
});
test('all seven gates remain OPEN and unapproved',()=>{
  assert.deepEqual(Object.keys(gates.gates).sort(),['G1','G2','G3','G4','G5','G6','G7']);
  for(const gate of Object.values(gates.gates)){
    assert.equal(gate.status,'OPEN');
    assert.equal(gate.independentApproval,false);
    assert.equal(gate.realStagingEvidence,false);
  }
  assert.equal(gates.approval,'NOT_APPROVED');
});
test('CloudActivity remains preview-only and does not mutate local or cloud data',()=>{
  const backup=cloud.slice(cloud.indexOf('private fun backup()'),cloud.indexOf('private fun restore()'));
  const restore=cloud.slice(cloud.indexOf('private fun restore()'),cloud.indexOf('private fun input('));
  assert.match(backup,/Cloud backup preview only/);
  assert.match(restore,/Cloud restore preview only/);
  assert.doesNotMatch(backup+restore,/prefs\.edit\(|\.set\(|\.update\(|\.delete\(/);
});
test('handover documents the remaining security and device test plan',()=>{
  const doc=fs.readFileSync('security/phase58-10-handover.md','utf8');
  for(const term of ['G1–G7','disposable','500,000','1,000,000','Phase 59','NOT APPROVED']) assert.ok(doc.includes(term),term);
  assert.ok(handover.nextPhaseRequirements.length>=5);
});
