const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(p,'utf8');
const review=require('../security/phase58-9-final-recovery-review.json');
const gates=require('../security/phase51-consolidated-gates.json');
const cloud=read('app/src/main/java/com/salonbook/pro/CloudActivity.kt');
const main=read('app/src/main/java/com/salonbook/pro/MainActivity.kt');
const validator=read('app/src/main/java/com/salonbook/pro/recovery/RecoveryPreviewValidator.kt');

test('all prior Phase 58 evidence files and local test suites exist',()=>{
  for(const n of ['58-4-kotlin-runtime-verification','58-5-disposable-restart','58-6-android-persistence','58-7-recovery-failure-protection','58-8-integration-readiness']){
    assert.ok(fs.existsSync('security/phase'+n+'.json'),n);
  }
  for(const p of ['RecoveryPreviewValidatorTest.kt','DisposableRestartRecoveryTest.kt','DisposableSharedPreferencesTest.kt','DisposableRecoveryFailureProtectionTest.kt']){
    assert.ok(fs.existsSync(path.join('app/src/test/java/com/salonbook/pro/recovery',p)),p);
  }
});
test('review records the exact previously verified green run IDs',()=>{
  assert.deepEqual(review.verifiedGithubRuns,{'58.4':45187104392,'58.5':45187434947,'58.6':45188057394,'58.7':45188428953,'58.8':45188810718});
});
test('CloudActivity remains preview only without preference writes or Firestore writes',()=>{
  const backup=cloud.slice(cloud.indexOf('private fun backup()'),cloud.indexOf('private fun restore()'));
  const restore=cloud.slice(cloud.indexOf('private fun restore()'),cloud.indexOf('private fun input('));
  assert.match(backup,/Cloud backup preview only/);
  assert.match(restore,/Cloud restore preview only/);
  assert.doesNotMatch(backup+restore,/prefs\.edit\(|\.set\(|\.update\(|\.delete\(/);
  assert.doesNotMatch(restore,/RecoveryPreviewValidator/);
});
test('read-only review records unresolved Android data contract and persistence gaps',()=>{
  assert.match(main,/getSharedPreferences\("salonbook_data", MODE_PRIVATE\)/);
  assert.match(main.slice(main.indexOf('private fun saveBookings()'),main.indexOf('private fun loadBookings()')),/\.apply\(\)/);
  assert.match(validator,/MAX_FIELD_LENGTH = 500000/);
  assert.match(cloud,/1_000_000/);
  assert.ok(review.outstanding.length>=6);
  assert.equal(review.decision,'NOT_APPROVED_FOR_PRODUCTION_RESTORE');
});
test('all seven launch gates stay open and live features disabled',()=>{
  assert.deepEqual(Object.keys(gates.gates).sort(),['G1','G2','G3','G4','G5','G6','G7']);
  assert.ok(Object.values(gates.gates).every(g=>g.status==='OPEN'&&g.independentApproval===false));
  for(const key of ['productionRestoreEnabled','realDeviceTested','productionCodeModified','productionPreferencesTouched','deployment','liveBookings','payments','messaging','appCheckEnforcement']) assert.equal(review[key],false,key);
  assert.equal(review.originalAndroidAppointments,'DO_NOT_TOUCH');
  assert.equal(gates.approval,'NOT_APPROVED');
});
