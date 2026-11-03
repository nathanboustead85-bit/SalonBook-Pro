"use strict";

/**
 * BOUSTIO — PHASE 8D.3
 *
 * Android Booking Migration Tests
 *
 * 20 automated tests.
 *
 * No Firebase deployment.
 * No database writes.
 * No existing bookings modified.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeBooking,
  detectConflicts,
  prepareAndroidBookings
} = require("./androidBookingAdapter");

const BUSINESS = "test-owner";

function booking(overrides = {}) {
  return {
    id: "booking-001",
    client: "Test Customer",
    service: "Haircut",
    date: "2026-12-07",
    time: "10:00",
    notes: "",
    serviceId: "haircut",
    staffId: "kody",
    duration: 30,
    price: "20.00",
    ...overrides
  };
}

function prepare(records) {
  return prepareAndroidBookings({
    businessId: BUSINESS,
    bookingsJson: JSON.stringify(records)
  });
}

// TEST 01

test("01 converts a valid Android booking", () => {
  const result = normalizeBooking(
    booking(),
    BUSINESS
  );

  assert.equal(result.valid, true);
  assert.equal(
    result.appointment.businessId,
    BUSINESS
  );
  assert.equal(
    result.appointment.startTime,
    "10:00"
  );
  assert.equal(
    result.appointment.endTime,
    "10:30"
  );
  assert.equal(
    result.appointment.price,
    20
  );
});

// TEST 02

test("02 accepts a valid JSON booking array", () => {
  const result = prepare([
    booking()
  ]);

  assert.equal(result.total, 1);
  assert.equal(result.readyCount, 1);
  assert.equal(result.rejectedCount, 0);
  assert.equal(result.safeToMigrate, true);
});

// TEST 03

test("03 accepts an empty booking list", () => {
  const result = prepare([]);

  assert.equal(result.total, 0);
  assert.equal(result.readyCount, 0);
  assert.equal(result.safeToMigrate, true);
});

// TEST 04

test("04 rejects missing staff ID", () => {
  const result = prepare([
    booking({ staffId: "" })
  ]);

  assert.equal(result.readyCount, 0);
  assert.match(
    result.rejected[0].errors.join(" "),
    /staff ID/
  );
});

// TEST 05

test("05 rejects missing service ID", () => {
  const result = prepare([
    booking({ serviceId: "" })
  ]);

  assert.equal(result.readyCount, 0);
  assert.match(
    result.rejected[0].errors.join(" "),
    /service ID/
  );
});

// TEST 06

test("06 rejects an invalid calendar date", () => {
  const result = prepare([
    booking({ date: "2026-02-30" })
  ]);

  assert.equal(result.readyCount, 0);
  assert.match(
    result.rejected[0].errors.join(" "),
    /date/
  );
});

// TEST 07

test("07 rejects an invalid time", () => {
  const result = prepare([
    booking({ time: "25:00" })
  ]);

  assert.equal(result.readyCount, 0);
  assert.match(
    result.rejected[0].errors.join(" "),
    /time/
  );
});

// TEST 08

test("08 rejects zero duration", () => {
  const result = prepare([
    booking({ duration: 0 })
  ]);

  assert.equal(result.readyCount, 0);
  assert.match(
    result.rejected[0].errors.join(" "),
    /duration/
  );
});

// TEST 09

test("09 rejects negative duration", () => {
  const result = prepare([
    booking({ duration: -30 })
  ]);

  assert.equal(result.readyCount, 0);
});

// TEST 10

test("10 rejects an appointment beyond midnight", () => {
  const result = prepare([
    booking({
      time: "23:45",
      duration: 30
    })
  ]);

  assert.equal(result.readyCount, 0);
  assert.match(
    result.rejected[0].errors.join(" "),
    /midnight/
  );
});

// TEST 11

test("11 allows an appointment ending at midnight", () => {
  const result = prepare([
    booking({
      time: "23:30",
      duration: 30
    })
  ]);

  assert.equal(result.readyCount, 1);
  assert.equal(
    result.ready[0].endTime,
    "24:00"
  );
});

// TEST 12

test("12 rejects a negative price", () => {
  const result = prepare([
    booking({ price: "-1.00" })
  ]);

  assert.equal(result.readyCount, 0);
  assert.match(
    result.rejected[0].errors.join(" "),
    /price/
  );
});

// TEST 13

test("13 rejects a missing client name", () => {
  const result = prepare([
    booking({ client: "" })
  ]);

  assert.equal(result.readyCount, 0);
  assert.match(
    result.rejected[0].errors.join(" "),
    /client/
  );
});

// TEST 14

test("14 rejects duplicate booking IDs", () => {
  const result = prepare([
    booking(),
    booking({
      client: "Another Customer",
      time: "11:00"
    })
  ]);

  assert.equal(result.total, 2);
  assert.equal(result.readyCount, 1);
  assert.equal(result.rejectedCount, 1);
  assert.match(
    result.rejected[0].errors.join(" "),
    /Duplicate booking ID/
  );
});

// TEST 15

test("15 detects overlapping staff appointments", () => {
  const result = prepare([
    booking({
      id: "booking-001",
      time: "10:00",
      duration: 30
    }),
    booking({
      id: "booking-002",
      time: "10:15",
      duration: 30
    })
  ]);

  assert.equal(result.readyCount, 0);
  assert.equal(result.rejectedCount, 2);
  assert.equal(result.safeToMigrate, false);
});

// TEST 16

test("16 accepts adjacent non-overlapping bookings", () => {
  const result = prepare([
    booking({
      id: "booking-001",
      time: "10:00"
    }),
    booking({
      id: "booking-002",
      time: "10:30"
    })
  ]);

  assert.equal(result.readyCount, 2);
  assert.equal(result.rejectedCount, 0);
});

// TEST 17

test("17 allows different staff at the same time", () => {
  const result = prepare([
    booking({
      id: "booking-001",
      staffId: "kody"
    }),
    booking({
      id: "booking-002",
      staffId: "olivia"
    })
  ]);

  assert.equal(result.readyCount, 2);
  assert.equal(result.rejectedCount, 0);
});

// TEST 18

test("18 rejects malformed JSON", () => {
  assert.throws(
    () => prepareAndroidBookings({
      businessId: BUSINESS,
      bookingsJson: "{invalid"
    }),
    /JSON is invalid/
  );
});

// TEST 19

test("19 rejects an invalid business identifier", () => {
  assert.throws(
    () => prepareAndroidBookings({
      businessId: "invalid/business",
      bookingsJson: "[]"
    }),
    /Invalid business identifier/
  );
});

// TEST 20

test("20 reports valid and invalid bookings separately", () => {
  const result = prepare([
    booking({
      id: "booking-001",
      time: "09:00"
    }),
    booking({
      id: "booking-002",
      staffId: ""
    }),
    booking({
      id: "booking-003",
      time: "11:00"
    })
  ]);

  assert.equal(result.total, 3);
  assert.equal(result.readyCount, 2);
  assert.equal(result.rejectedCount, 1);
  assert.equal(result.safeToMigrate, false);

  assert.deepEqual(
    result.ready.map(item => item.id),
    ["booking-001", "booking-003"]
  );
});

// Extra direct conflict check

test("21 direct conflict detection identifies overlaps", () => {
  const first = normalizeBooking(
    booking({
      id: "a",
      time: "10:00"
    }),
    BUSINESS
  ).appointment;

  const second = normalizeBooking(
    booking({
      id: "b",
      time: "10:15"
    }),
    BUSINESS
  ).appointment;

  const conflicts = detectConflicts([
    first,
    second
  ]);

  assert.equal(conflicts.has("a"), true);
  assert.equal(conflicts.has("b"), true);
});
