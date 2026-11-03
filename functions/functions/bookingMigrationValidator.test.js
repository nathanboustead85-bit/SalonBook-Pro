"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateMigration,
  validateSnapshots
} = require("./bookingMigrationValidator");

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

function check(bookings, appointments = [], locks = []) {
  return validateMigration({
    businessId: BUSINESS_ID,
    bookingsJson: JSON.stringify(bookings),
    existingAppointments: appointments,
    existingLocks: locks
  });
}

test("1 - empty migration passes preflight", () => {
  const result = check([]);

  assert.equal(result.safeToMigrate, true);
  assert.equal(result.status, "PREFLIGHT_PASSED");
});

test("2 - valid appointment passes preflight", () => {
  const result = check([booking()]);

  assert.equal(result.safeToMigrate, true);
  assert.equal(result.proposedAppointmentCount, 1);
  assert.equal(result.proposedLockCount, 2);
});

test("3 - existing appointment ID blocks migration", () => {
  const result = check(
    [booking()],
    [{ id: "booking1" }]
  );

  assert.equal(result.safeToMigrate, false);
  assert.equal(result.status, "MIGRATION_BLOCKED");
});

test("4 - existing lock blocks migration", () => {
  const result = check(
    [booking()],
    [],
    [{
      lockId: "staff1_2026-11-12_1000"
    }]
  );

  assert.equal(result.safeToMigrate, false);
  assert.equal(result.proposedLockCount, 2);
});

test("5 - blocked migration returns no appointments", () => {
  const result = check(
    [booking()],
    [{ id: "booking1" }]
  );

  assert.deepEqual(result.appointments, []);
});

test("6 - blocked migration returns no locks", () => {
  const result = check(
    [booking()],
    [],
    [{
      lockId: "staff1_2026-11-12_1015"
    }]
  );

  assert.deepEqual(result.locks, []);
});

test("7 - different appointment ID does not block", () => {
  const result = check(
    [booking()],
    [{ id: "anotherBooking" }]
  );

  assert.equal(result.safeToMigrate, true);
});

test("8 - unrelated lock does not block", () => {
  const result = check(
    [booking()],
    [],
    [{
      lockId: "staff2_2026-11-12_1000"
    }]
  );

  assert.equal(result.safeToMigrate, true);
});

test("9 - overlapping Android bookings block migration", () => {
  const result = check([
    booking(),
    booking({
      id: "booking2",
      time: "10:15"
    })
  ]);

  assert.equal(result.safeToMigrate, false);
  assert.equal(result.proposedAppointmentCount, 0);
});

test("10 - missing staff ID blocks migration", () => {
  const result = check([
    booking({ staffId: "" })
  ]);

  assert.equal(result.safeToMigrate, false);
});

test("11 - duplicate Android IDs block migration", () => {
  const result = check([
    booking(),
    booking({
      client: "Another Client",
      time: "11:00"
    })
  ]);

  assert.equal(result.safeToMigrate, false);
});

test("12 - multiple valid appointments pass", () => {
  const result = check([
    booking(),
    booking({
      id: "booking2",
      time: "11:00"
    })
  ]);

  assert.equal(result.safeToMigrate, true);
  assert.equal(result.proposedAppointmentCount, 2);
  assert.equal(result.proposedLockCount, 4);
});

test("13 - missing snapshot arrays are rejected", () => {
  assert.throws(() => {
    validateMigration({
      businessId: BUSINESS_ID,
      bookingsJson: "[]"
    });
  });
});

test("14 - duplicate existing appointment IDs rejected", () => {
  assert.throws(() => {
    validateSnapshots(
      [{ id: "same" }, { id: "same" }],
      []
    );
  });
});

test("15 - duplicate existing lock IDs rejected", () => {
  assert.throws(() => {
    validateSnapshots(
      [],
      [{ lockId: "same" }, { lockId: "same" }]
    );
  });
});

test("16 - invalid existing appointment snapshot rejected", () => {
  assert.throws(() => {
    validateSnapshots(
      [{ id: "" }],
      []
    );
  });
});

test("17 - invalid existing lock snapshot rejected", () => {
  assert.throws(() => {
    validateSnapshots(
      [],
      [{ lockId: "" }]
    );
  });
});

test("18 - malformed Android JSON is rejected", () => {
  assert.throws(() => {
    validateMigration({
      businessId: BUSINESS_ID,
      bookingsJson: "{invalid",
      existingAppointments: [],
      existingLocks: []
    });
  });
});

test("19 - rejection report includes reasons", () => {
  const result = check([
    booking({ staffId: "" })
  ]);

  assert.ok(result.problemCount > 0);
  assert.match(
    result.problems[0].reason,
    /Invalid Android booking/
  );
});

test("20 - preflight warning explains limitations", () => {
  const result = check([booking()]);

  assert.match(result.warning, /READ-ONLY/);
  assert.match(result.warning, /transactional/);
});
