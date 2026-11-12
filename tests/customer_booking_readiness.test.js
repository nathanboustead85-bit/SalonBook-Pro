"use strict";
const assert = require("node:assert/strict");
const { REQUIRED, assessBookingReadiness, requireBookingReadiness } =
  require("../functions/bookingReadiness");

assert.equal(assessBookingReadiness().ready, false);
assert.equal(assessBookingReadiness({}).missing.length, REQUIRED.length);
assert.equal(assessBookingReadiness(Object.fromEntries(REQUIRED.map(k => [k, "true"]))).ready, false);
for (const key of REQUIRED) {
  const evidence = Object.fromEntries(REQUIRED.map(k => [k, true]));
  delete evidence[key];
  assert.equal(assessBookingReadiness(evidence).ready, false, key);
  assert.throws(() => requireBookingReadiness(evidence), /remain disabled/, key);
}
const allVerified = Object.fromEntries(REQUIRED.map(k => [k, true]));
assert.equal(requireBookingReadiness(allVerified), true);
// The release gate must not accidentally depend on a single migration audit.
const fs = require("node:fs");
const backend = fs.readFileSync(require("node:path").join(__dirname, "../functions/index.js"), "utf8");
assert.match(backend, /existingLocksChecked/);
assert.match(backend, /existingLockConflicts/);
assert.match(backend, /existingSharedAppointments/);
assert.match(backend, /collection\("appointments"\)\.limit\(1\)/);
assert.match(backend, /bookingLocks/);
assert.match(backend, /migrationPerformed: false/);
assert.match(backend, /liveBookingsEnabled: false/);
console.log("Customer booking release gate: fail-closed checks passed");
