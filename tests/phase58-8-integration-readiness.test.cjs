const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const main = fs.readFileSync('app/src/main/java/com/salonbook/pro/MainActivity.kt','utf8');
const cloud = fs.readFileSync('app/src/main/java/com/salonbook/pro/CloudActivity.kt','utf8');
const validator = fs.readFileSync('app/src/main/java/com/salonbook/pro/recovery/RecoveryPreviewValidator.kt','utf8');
const gates = require('../security/phase51-consolidated-gates.json');
const evidence = require('../security/phase58-8-integration-readiness.json');

test('Android activities share the existing production preference namespace', () => {
  assert.match(main,/getSharedPreferences\("salonbook_data", MODE_PRIVATE\)/);
  assert.match(cloud,/getSharedPreferences\("salonbook_data", MODE_PRIVATE\)/);
});
test('MainActivity still saves the existing bookings key using apply', () => {
  const save = main.slice(main.indexOf('private fun saveBookings()'),main.indexOf('private fun loadBookings()'));
  assert.match(save,/putString\(\s*"bookings"/);
  assert.match(save,/\.apply\(\)/);
});
test('MainActivity loader reads bookings and does not invoke restore helper', () => {
  const load = main.slice(main.indexOf('private fun loadBookings()'));
  assert.match(load,/getString\(\s*"bookings"/);
  assert.doesNotMatch(load,/RecoveryPreviewValidator|simulatedRestore/);
});
test('CloudActivity restore is preview only, no SharedPreferences writes', () => {
  const restore = cloud.slice(cloud.indexOf('private fun restore()'),cloud.indexOf('private fun input('));
  assert.match(restore,/get\(Source.SERVER\)/);
  assert.match(restore,/Cloud restore preview only/);
  assert.doesNotMatch(restore,/prefs\.edit\(|\.set\(|\.update\(|\.delete\(/);
  assert.doesNotMatch(restore,/RecoveryPreviewValidator/);
});
test('CloudActivity backup remains preview only and does not write Firebase', () => {
  const backup = cloud.slice(cloud.indexOf('private fun backup()'),cloud.indexOf('private fun restore()'));
  assert.match(backup,/Cloud backup preview only/);
  assert.doesNotMatch(backup,/\.set\(|\.update\(|\.delete\(|prefs\.edit\(/);
});
test('Validator size ceiling is stricter than current CloudActivity preview', () => {
  assert.match(validator,/MAX_FIELD_LENGTH = 500000/);
  assert.match(cloud,/1_000_000/);
});
test('all seven production gates remain OPEN, and evidence is nonproduction', () => {
  assert.deepEqual(Object.keys(gates.gates).sort(),['G1','G2','G3','G4','G5','G6','G7']);
  for (const gate of Object.values(gates.gates)) assert.equal(gate.status,'OPEN');
  assert.equal(evidence.productionRestoreEnabled,false);
  assert.equal(evidence.productionCodeModified,false);
  assert.equal(evidence.originalAndroidAppointments,'DO_NOT_TOUCH');
  assert.equal(evidence.deployment,false);
});
