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
console.log("Customer booking release gate: fail-closed checks passed");
