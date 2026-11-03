"use strict";

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

test("1 - empty bookings are safe", () => {
  const result = plan([]);

  assert.equal(result.safeToMigrate, true);
  assert.equal(result.sourceCount, 0);
  assert.equal(result.lockCount, 0);
});

test("2 - valid appointment generates two locks", () => {
  const result = plan([booking()]);

  assert.equal(result.safeToMigrate, true);
  assert.equal(result.appointmentCount, 1);
  assert.equal(result.lockCount, 2);
});

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

test("4 - 45 minute booking generates three locks", () => {
  const result = plan([
    booking({ duration: 45 })
  ]);

  assert.equal(result.lockCount, 3);
});

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

test("9 - missing staff ID blocks migration", () => {
  const result = plan([
    booking({ staffId: "" })
  ]);

  assert.equal(result.safeToMigrate, false);
  assert.equal(result.appointmentCount, 0);
});

test("10 - missing service ID blocks migration", () => {
  const result = plan([
    booking({ serviceId: "" })
  ]);

  assert.equal(result.safeToMigrate, false);
});

test("11 - invalid date blocks migration", () => {
  const result = plan([
    booking({ date: "2026-02-30" })
  ]);

  assert.equal(result.safeToMigrate, false);
});

test("12 - invalid duration blocks migration", () => {
  const result = plan([
    booking({ duration: 0 })
  ]);

  assert.equal(result.safeToMigrate, false);
});

test("13 - booking extending past midnight is rejected", () => {
  const result = plan([
    booking({
      time: "23:45",
      duration: 30
    })
  ]);

  assert.equal(result.safeToMigrate, false);
});

test("14 - invalid JSON throws", () => {
  assert.throws(() => {
    makeMigrationPlan({
      businessId: BUSINESS_ID,
      bookingsJson: "{broken"
    });
  });
});

test("15 - planner provides a read-only warning", () => {
  const result = plan([booking()]);

  assert.match(result.warning, /READ-ONLY/);
  assert.match(result.warning, /No Firestore/);
});

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

test("18 - source appointment remains unchanged", () => {
  const original = booking();
  const snapshot = JSON.stringify(original);

  plan([original]);

  assert.equal(JSON.stringify(original), snapshot);
});
