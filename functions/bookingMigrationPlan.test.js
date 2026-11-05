"use strict";

/**
 * BOUSTIO — PHASE 8D.55
 *
 * Booking Migration Plan Tests
 *
 * 20 automated tests.
 *
 * SAFETY:
 * - No Firebase deployment
 * - No Firestore writes
 * - No existing bookings modified
 * - No public booking activation
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  makeMigrationPlan
} = require("./bookingMigrationPlan");

const BUSINESS_ID = "testBusiness123";

function booking(overrides = {}) {
  return {
    id: "booking1",
    client: "Test Client",
    service: "Haircut",
    serviceId: "service1",
    staffId: "staff1",
    date: "2026-11-12",
    time: "10:00",
    duration: 30,
    price: "20.00",
    notes: "",
    ...overrides
  };
}

function plan(bookings) {
  return makeMigrationPlan({
    businessId: BUSINESS_ID,
    bookingsJson: JSON.stringify(bookings)
  });
}

// TEST 01

test("1 - empty bookings are safe", () => {
  const result = plan([]);

  assert.equal(result.safeToMigrate, true);
  assert.equal(result.sourceCount, 0);
  assert.equal(result.lockCount, 0);
});

// TEST 02

test("2 - valid appointment generates two locks", () => {
  const result = plan([booking()]);

  assert.equal(result.safeToMigrate, true);
  assert.equal(result.appointmentCount, 1);
  assert.equal(result.lockCount, 2);
});

// TEST 03

test("3 - locks use correct identifiers", () => {
  const result = plan([booking()]);

  assert.deepEqual(
    result.locks.map(item => item.lockId),
    [
      "staff1_2026-11-12_1000",
      "staff1_2026-11-12_1015"
    ]
  );
});

// TEST 04

test("4 - 45 minute booking generates three locks", () => {
  const result = plan([
    booking({ duration: 45 })
  ]);

  assert.equal(result.lockCount, 3);
});

// TEST 05

test("5 - adjacent bookings do not overlap", () => {
  const result = plan([
    booking(),
    booking({
      id: "booking2",
      time: "10:30"
    })
  ]);

  assert.equal(result.safeToMigrate, true);
  assert.equal(result.appointmentCount, 2);
  assert.equal(result.lockCount, 4);
});

// TEST 06

test("6 - overlapping appointments are rejected", () => {
  const result = plan([
    booking(),
    booking({
      id: "booking2",
      time: "10:15"
    })
  ]);

  assert.equal(result.safeToMigrate, false);
  assert.equal(result.rejectedCount, 2);
  assert.equal(result.appointmentCount, 0);
});

// TEST 07

test("7 - different staff may share a time", () => {
  const result = plan([
    booking(),
    booking({
      id: "booking2",
      staffId: "staff2"
    })
  ]);

  assert.equal(result.safeToMigrate, true);
  assert.equal(result.lockCount, 4);
});

// TEST 08

test("8 - duplicate booking IDs block migration", () => {
  const result = plan([
    booking(),
    booking({
      client: "Another Client",
      time: "11:00"
    })
  ]);

  assert.equal(result.safeToMigrate, false);
  assert.equal(result.rejectedCount, 1);
});

// TEST 09

test("9 - missing staff ID blocks migration", () => {
  const result = plan([
    booking({ staffId: "" })
  ]);

  assert.equal(result.safeToMigrate, false);
  assert.equal(result.appointmentCount, 0);
});

// TEST 10

test("10 - missing service ID blocks migration", () => {
  const result = plan([
    booking({ serviceId: "" })
  ]);

  assert.equal(result.safeToMigrate, false);
});

// TEST 11

test("11 - invalid date blocks migration", () => {
  const result = plan([
    booking({ date: "2026-02-30" })
  ]);

  assert.equal(result.safeToMigrate, false);
});

// TEST 12

test("12 - invalid duration blocks migration", () => {
  const result = plan([
    booking({ duration: 0 })
  ]);

  assert.equal(result.safeToMigrate, false);
});

// TEST 13

test("13 - booking extending past midnight is rejected", () => {
  const result = plan([
    booking({
      time: "23:45",
      duration: 30
    })
  ]);

  assert.equal(result.safeToMigrate, false);
});

// TEST 14

test("14 - invalid JSON throws", () => {
  assert.throws(() => {
    makeMigrationPlan({
      businessId: BUSINESS_ID,
      bookingsJson: "{broken"
    });
  });
});

// TEST 15

test("15 - planner provides a read-only warning", () => {
  const result = plan([booking()]);

  assert.match(result.warning, /READ-ONLY/);
  assert.match(result.warning, /No Firestore/);
});

// TEST 16

test("16 - mixed valid and invalid records block migration", () => {
  const result = plan([
    booking(),
    booking({
      id: "booking2",
      staffId: ""
    })
  ]);

  assert.equal(result.safeToMigrate, false);
  assert.equal(result.appointmentCount, 1);
  assert.equal(result.rejectedCount, 1);
});

// TEST 17

test("17 - non-aligned bookings reveal lock collisions", () => {
  const result = plan([
    booking({
      time: "10:01",
      duration: 10
    }),
    booking({
      id: "booking2",
      time: "10:12",
      duration: 10
    })
  ]);

  assert.equal(result.safeToMigrate, false);
  assert.ok(result.problems.length > 0);
});

// TEST 18

test("18 - source appointment remains unchanged", () => {
  const original = booking();
  const snapshot = JSON.stringify(original);

  plan([original]);

  assert.equal(JSON.stringify(original), snapshot);
});

// TEST 19

test("19 - partial migration must not be authorised", () => {
  const result = plan([
    booking({
      id: "valid-booking",
      time: "09:00"
    }),
    booking({
      id: "invalid-booking",
      staffId: ""
    })
  ]);

  assert.equal(result.sourceCount, 2);
  assert.equal(result.appointmentCount, 1);
  assert.equal(result.rejectedCount, 1);
  assert.equal(result.safeToMigrate, false);

  // Partial plans must not authorise writes.
  assert.notEqual(
    result.appointmentCount,
    result.sourceCount
  );
});

// TEST 20

test("20 - overlapping bookings block migration", () => {
  const result = plan([
    booking({
      id: "first",
      time: "10:00",
      duration: 45
    }),
    booking({
      id: "second",
      time: "10:15",
      duration: 30
    })
  ]);

  assert.equal(result.safeToMigrate, false);
  assert.equal(result.appointmentCount, 0);
  assert.equal(result.rejectedCount, 2);
});
