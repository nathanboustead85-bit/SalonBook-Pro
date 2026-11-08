"use strict";

/**
 * Phase 10.1 — live booking readiness gate.
 * These checks deliberately do not create appointments or deploy functions.
 * They fail if someone accidentally exposes a booking endpoint before the
 * Android migration and shared-lock rollout are complete.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("public booking callables are not exposed", () => {
  const source = read("index.js");
  for (const name of ["createCustomerBooking", "confirmCustomerBooking", "createPublicBooking"]) {
    assert.doesNotMatch(source, new RegExp("exports\\." + name + "\\s*="));
  }
});

test("published businesses are not automatically accepting bookings", () => {
  const source = read("index.js");
  assert.match(source, /acceptingBookings:\s*false/);
  assert.match(source, /published:\s*true/);
});

test("trusted booking requires explicit acceptance from both trusted sources", () => {
  const source = read("trustedBooking.js");
  assert.match(source, /publicBusiness\.acceptingBookings\s*!==\s*true/);
  assert.match(source, /catalogue\.business\.acceptingBookings\s*!==\s*true/);
  assert.match(source, /bookingCreator\s*\(/);
});

test("appointment and lock writes remain backend-only", () => {
  const rules = read("../firestore.rules");
  assert.match(rules, /match \/businesses\/\{businessId\}\/appointments\/\{appointmentId\}/);
  assert.match(rules, /match \/businesses\/\{businessId\}\/bookingLocks\/\{lockId\}/);
  assert.match(rules, /allow read, write: if false;/);
  assert.match(rules, /allow create, update, delete: if false;/);
});

test("website remains explicitly in preview mode", () => {
  const page = read("../website/book/index.html");
  assert.match(page, /Preview only\./);
  assert.match(page, /Booking unavailable — preview only/);
  assert.match(page, /class="disabled-action"[^>]*disabled/);
});

test("demo catalogue cannot accept live bookings", () => {
  const demo = JSON.parse(read("../website/data/demo-business.json"));
  assert.equal(demo.business.acceptingBookings, false);
});
