"use strict";

/**
 * BOUSTIO — PHASE 8D.78
 *
 * Verified Transactional Migration Safety Tests
 *
 * No Firebase connection.
 * No database writes.
 * No production deployment.
 *
 * All tests now use the verified migration
 * entry point. The legacy unverified
 * migration function has been removed.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  migrateVerifiedAndroidBookings,
  validatePlan,
  verifyOwner,
  verifySource,
  MIGRATION_ID,
  MAX_TRANSACTION_WRITES
} = require("./transactionalBookingMigration");

function appointment(id = "booking1") {
  return { id };
}

function lock(
  lockId = "staff1_2026-11-12_1000",
  appointmentId = "booking1"
) {
  return {
    lockId,
    appointmentId
  };
}

function validPlan() {
  return {
    safeToMigrate: true,
    sourceCount: 1,
    appointmentCount: 1,
    appointments: [appointment()],
    locks: [lock()]
  };
}

test("01 matching owner is accepted", () => {
  assert.doesNotThrow(() => {
    verifyOwner("owner123", "owner123");
  });
});

test("02 different owner is rejected", () => {
  assert.throws(
    () => verifyOwner("owner123", "other123"),
    /ownership verification failed/
  );
});

test("03 invalid owner ID is rejected", () => {
  assert.throws(
    () => verifyOwner("owner/123", "owner/123"),
    /Invalid business or owner/
  );
});

test("04 missing Android source is rejected", () => {
  assert.throws(
    () => verifySource({ exists: false }),
    /backup is missing/
  );
});

test("05 valid Android source is accepted", () => {
  const source = {
    schemaVersion: 1,
    json: "[]"
  };

  const result = verifySource({
    exists: true,
    data: () => source
  });

  assert.deepEqual(result, source);
});

test("06 unsupported source version is rejected", () => {
  assert.throws(
    () => verifySource({
      exists: true,
      data: () => ({
        schemaVersion: 2,
        json: "[]"
      })
    }),
    /Unsupported Android booking data/
  );
});

test("07 valid migration plan is accepted", () => {
  assert.equal(validatePlan(validPlan()), 3);
});

test("08 unsafe migration plan is rejected", () => {
  assert.throws(
    () => validatePlan({
      ...validPlan(),
      safeToMigrate: false
    }),
    /invalid or overlapping bookings/
  );
});

test("09 empty migration is rejected", () => {
  assert.throws(
    () => validatePlan({
      ...validPlan(),
      sourceCount: 0,
      appointmentCount: 0,
      appointments: [],
      locks: []
    }),
    /empty or incomplete/
  );
});

test("10 partial migration is rejected", () => {
  assert.throws(
    () => validatePlan({
      ...validPlan(),
      sourceCount: 2
    }),
    /empty or incomplete/
  );
});

test("11 duplicate appointment IDs are rejected", () => {
  assert.throws(
    () => validatePlan({
      ...validPlan(),
      sourceCount: 2,
      appointmentCount: 2,
      appointments: [
        appointment("booking1"),
        appointment("booking1")
      ]
    }),
    /duplicate appointment identifier/
  );
});

test("12 duplicate lock IDs are rejected", () => {
  assert.throws(
    () => validatePlan({
      ...validPlan(),
      locks: [
        lock(),
        lock()
      ]
    }),
    /duplicate booking lock/
  );
});

test("13 orphan booking lock is rejected", () => {
  assert.throws(
    () => validatePlan({
      ...validPlan(),
      locks: [
        lock(
          "staff1_2026-11-12_1000",
          "missing-booking"
        )
      ]
    }),
    /Invalid or duplicate booking lock/
  );
});

test("14 oversized migration is rejected", () => {
  const appointments = Array.from(
    { length: MAX_TRANSACTION_WRITES },
    (_, index) => appointment("booking" + index)
  );

  assert.throws(
    () => validatePlan({
      safeToMigrate: true,
      sourceCount: appointments.length,
      appointmentCount: appointments.length,
      appointments,
      locks: []
    }),
    /safe transaction size/
  );
});

test("15 migration ID remains stable", () => {
  assert.equal(
    MIGRATION_ID,
    "android-bookings-v1"
  );
});

test("16 invalid database is rejected", async () => {
  await assert.rejects(
    migrateVerifiedAndroidBookings({
      db: null,
      businessId: "owner123",
      authenticatedUid: "owner123",
      expectedHash: "a".repeat(64)
    }),
    /Firestore database is unavailable/
  );
});

test("17 unauthorised migration is rejected", async () => {
  let transactionCalled = false;

  const db = {
    collection() {
      throw new Error("Must not access database");
    },
    async runTransaction() {
      transactionCalled = true;
    }
  };

  await assert.rejects(
    migrateVerifiedAndroidBookings({
      db,
      businessId: "owner123",
      authenticatedUid: "other123",
      expectedHash: "a".repeat(64)
    }),
    /ownership verification failed/
  );

  assert.equal(transactionCalled, false);
});
