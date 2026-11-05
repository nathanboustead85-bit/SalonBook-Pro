"use strict";

/**
 * BOUSTIO — PHASE 8D.56
 * Firestore Transaction Integration Tests
 *
 * EMULATOR ONLY.
 *
 * No production database access.
 * No public booking activation.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const admin = require("firebase-admin");

const {
  migrateAndroidBookings,
  MIGRATION_ID
} = require("./transactionalBookingMigration");

// Never connect these tests to production.
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    "Firestore emulator is required. " +
    "Production execution is forbidden."
  );
}

const PROJECT_ID = "demo-boustio-migration";

if (
  process.env.GCLOUD_PROJECT &&
  process.env.GCLOUD_PROJECT !== PROJECT_ID
) {
  throw new Error("Unexpected Firebase project.");
}

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: PROJECT_ID
  });
}

const db = admin.firestore();

let counter = 0;

function uniqueOwner() {
  counter += 1;

  return (
    "migrationTest_" +
    process.pid + "_" +
    Date.now() + "_" +
    counter
  );
}

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

function refs(owner) {
  const business = db
    .collection("businesses")
    .doc(owner);

  const source = db
    .collection("users")
    .doc(owner)
    .collection("liveData")
    .doc("bookings");

  return {
    business,
    source,
    appointments:
      business.collection("appointments"),
    locks:
      business.collection("bookingLocks"),
    marker:
      business.collection("migrations")
        .doc(MIGRATION_ID)
  };
}

async function seed(owner, bookings) {
  const r = refs(owner);

  await r.source.set({
    schemaVersion: 1,
    json: JSON.stringify(bookings),
    updatedAt: new Date().toISOString()
  });

  return r;
}

function migrate(owner) {
  return migrateAndroidBookings({
    db,
    businessId: owner,
    authenticatedUid: owner
  });
}

async function counts(r) {
  const [
    appointments,
    locks,
    marker
  ] = await Promise.all([
    r.appointments.get(),
    r.locks.get(),
    r.marker.get()
  ]);

  return {
    appointments: appointments.size,
    locks: locks.size,
    marker: marker.exists
  };
}

// TEST 01

test("01 successful migration creates appointments and locks",
  async () => {
    const owner = uniqueOwner();

    const r = await seed(owner, [
      booking()
    ]);

    const result = await migrate(owner);

    assert.equal(result.success, true);
    assert.equal(result.appointmentCount, 1);
    assert.equal(result.lockCount, 2);

    assert.deepEqual(
      await counts(r),
      {
        appointments: 1,
        locks: 2,
        marker: true
      }
    );

    const saved = await r.appointments
      .doc("booking1")
      .get();

    assert.equal(
      saved.data().customerName,
      "Test Client"
    );

    assert.equal(
      saved.data().source,
      "android"
    );
  }
);

// TEST 02

test("02 repeat migration cannot duplicate appointments",
  async () => {
    const owner = uniqueOwner();

    const r = await seed(owner, [
      booking()
    ]);

    await migrate(owner);

    await assert.rejects(
      migrate(owner),
      error => error.code === "already-migrated"
    );

    assert.deepEqual(
      await counts(r),
      {
        appointments: 1,
        locks: 2,
        marker: true
      }
    );
  }
);

// TEST 03

test("03 existing booking lock blocks entire migration",
  async () => {
    const owner = uniqueOwner();

    const r = await seed(owner, [
      booking()
    ]);

    const occupiedLock =
      "staff1_2026-11-12_1000";

    await r.locks.doc(occupiedLock).set({
      appointmentId: "existingBooking",
      businessId: owner,
      staffId: "staff1",
      date: "2026-11-12"
    });

    await assert.rejects(
      migrate(owner),
      /booking slots are already occupied/
    );

    assert.deepEqual(
      await counts(r),
      {
        appointments: 0,
        locks: 1,
        marker: false
      }
    );
  }
);

// TEST 04

test("04 existing appointment ID blocks entire migration",
  async () => {
    const owner = uniqueOwner();

    const r = await seed(owner, [
      booking()
    ]);

    await r.appointments.doc("booking1").set({
      source: "existing",
      status: "confirmed"
    });

    await assert.rejects(
      migrate(owner),
      /appointment already exists/
    );

    assert.deepEqual(
      await counts(r),
      {
        appointments: 1,
        locks: 0,
        marker: false
      }
    );
  }
);

// TEST 05

test("05 invalid source causes no migration writes",
  async () => {
    const owner = uniqueOwner();

    const r = await seed(owner, [
      booking(),
      booking({
        id: "booking2",
        staffId: ""
      })
    ]);

    await assert.rejects(
      migrate(owner),
      /invalid or overlapping bookings/
    );

    assert.deepEqual(
      await counts(r),
      {
        appointments: 0,
        locks: 0,
        marker: false
      }
    );
  }
);

// TEST 06

test("06 missing source causes no migration writes",
  async () => {
    const owner = uniqueOwner();
    const r = refs(owner);

    await assert.rejects(
      migrate(owner),
      /backup is missing/
    );

    assert.deepEqual(
      await counts(r),
      {
        appointments: 0,
        locks: 0,
        marker: false
      }
    );
  }
);

// TEST 07

test("07 different owner is rejected before database writes",
  async () => {
    const owner = uniqueOwner();

    const r = await seed(owner, [
      booking()
    ]);

    await assert.rejects(
      migrateAndroidBookings({
        db,
        businessId: owner,
        authenticatedUid: "anotherOwner"
      }),
      /ownership verification failed/
    );

    assert.deepEqual(
      await counts(r),
      {
        appointments: 0,
        locks: 0,
        marker: false
      }
    );
  }
);

// TEST 08

test("08 multiple valid appointments migrate together",
  async () => {
    const owner = uniqueOwner();

    const r = await seed(owner, [
      booking({
        id: "booking1",
        time: "10:00"
      }),
      booking({
        id: "booking2",
        time: "11:00"
      })
    ]);

    const result = await migrate(owner);

    assert.equal(result.appointmentCount, 2);
    assert.equal(result.lockCount, 4);

    assert.deepEqual(
      await counts(r),
      {
        appointments: 2,
        locks: 4,
        marker: true
      }
    );
  }
);
