"use strict";

/**
 * BOUSTIO — PHASE 8D.59A
 *
 * Transactional Android Booking Migration
 * Firestore Emulator Integration Tests
 *
 * Tests 01–13
 *
 * EMULATOR ONLY — NOT PRODUCTION.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const admin = require("firebase-admin");

const {
  migrateAndroidBookings,
  MIGRATION_ID
} = require("./transactionalBookingMigration");

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    "Firestore emulator required. " +
    "Production execution forbidden."
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

// =====================================
// TEST 01 — SUCCESSFUL MIGRATION
// =====================================

test(
  "01 successful migration creates appointments and locks",
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

// =====================================
// TEST 02 — REPEAT MIGRATION
// =====================================

test(
  "02 repeat migration cannot duplicate appointments",
  async () => {
    const owner = uniqueOwner();

    const r = await seed(owner, [
      booking()
    ]);

    await migrate(owner);

    await assert.rejects(
      migrate(owner),
      error =>
        error.code === "already-migrated"
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

// =====================================
// TEST 03 — EXISTING LOCK
// =====================================

test(
  "03 existing booking lock blocks entire migration",
  async () => {
    const owner = uniqueOwner();

    const r = await seed(owner, [
      booking()
    ]);

    await r.locks
      .doc("staff1_2026-11-12_1000")
      .set({
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

// =====================================
// TEST 04 — DUPLICATE APPOINTMENT ID
// =====================================

test(
  "04 existing appointment ID blocks entire migration",
  async () => {
    const owner = uniqueOwner();

    const r = await seed(owner, [
      booking()
    ]);

    await r.appointments
      .doc("booking1")
      .set({
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

// =====================================
// TEST 05 — INVALID SOURCE
// =====================================

test(
  "05 invalid source causes no migration writes",
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

// =====================================
// TEST 06 — MISSING SOURCE
// =====================================

test(
  "06 missing source causes no migration writes",
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

// =====================================
// TEST 07 — WRONG OWNER
// =====================================

test(
  "07 different owner is rejected before database writes",
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

// =====================================
// TEST 08 — MULTIPLE BOOKINGS
// =====================================

test(
  "08 multiple valid appointments migrate together",
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

    assert.equal(
      result.appointmentCount,
      2
    );

    assert.equal(
      result.lockCount,
      4
    );

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

// =====================================
// TEST 09 — LEGACY APPOINTMENT OVERLAP
// =====================================

test(
  "09 legacy appointment without locks blocks migration",
  async () => {
    const owner = uniqueOwner();

    const r = await seed(owner, [
      booking({
        id: "androidBooking1",
        time: "10:00",
        duration: 30
      })
    ]);

    await r.appointments
      .doc("legacyBooking1")
      .set({
        businessId: owner,
        staffId: "staff1",
        serviceId: "service1",
        date: "2026-11-12",
        startTime: "10:15",
        endTime: "10:45",
        durationMinutes: 30,
        status: "confirmed",
        source: "legacy"
      });

    await assert.rejects(
      migrate(owner),
      /overlap|conflict|occupied/i
    );

    assert.deepEqual(
      await counts(r),
      {
        appointments: 1,
        locks: 0,
        marker: false
      }
    );

    const original = await r.appointments
      .doc("legacyBooking1")
      .get();

    assert.equal(original.exists, true);

    const android = await r.appointments
      .doc("androidBooking1")
      .get();

    assert.equal(android.exists, false);
  }
);

// =====================================
// TEST 10 — SIMULTANEOUS MIGRATION
// =====================================

test(
  "10 simultaneous migrations cannot create duplicates",
  async () => {
    const owner = uniqueOwner();

    const r = await seed(owner, [
      booking()
    ]);

    const results = await Promise.allSettled([
      migrate(owner),
      migrate(owner)
    ]);

    const successful = results.filter(
      result =>
        result.status === "fulfilled"
    );

    const rejected = results.filter(
      result =>
        result.status === "rejected"
    );

    assert.equal(successful.length, 1);
    assert.equal(rejected.length, 1);

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

// =====================================
// TEST 11 — UPDATED ANDROID SOURCE
// =====================================

test(
  "11 migration uses latest source data",
  async () => {
    const owner = uniqueOwner();

    const r = await seed(owner, [
      booking({
        id: "oldBooking",
        time: "10:00"
      })
    ]);

    await r.source.update({
      json: JSON.stringify([
        booking({
          id: "newBooking",
          time: "11:00"
        })
      ]),
      updatedAt: new Date().toISOString()
    });

    const result = await migrate(owner);

    assert.equal(result.success, true);

    const oldAppointment = await r.appointments
      .doc("oldBooking")
      .get();

    const newAppointment = await r.appointments
      .doc("newBooking")
      .get();

    assert.equal(oldAppointment.exists, false);
    assert.equal(newAppointment.exists, true);

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

// =====================================
// TEST 12 — COMPETING BOOKING LOCK
// =====================================

test(
  "12 competing booking lock prevents migration",
  async () => {
    const owner = uniqueOwner();

    const r = await seed(owner, [
      booking()
    ]);

    await r.locks
      .doc("staff1_2026-11-12_1015")
      .set({
        businessId: owner,
        staffId: "staff1",
        date: "2026-11-12",
        appointmentId: "onlineBooking"
      });

    await assert.rejects(
      migrate(owner),
      /occupied/
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

// =====================================
// TEST 13 — SOURCE UPDATE DURING START
// =====================================

test(
  "13 source update before transaction source read uses fresh booking",
  async () => {
    const owner = uniqueOwner();

    const r = await seed(owner, [
      booking({
        id: "staleBooking",
        time: "10:00"
      })
    ]);

    let sourceUpdated = false;

    // Intercept the source read.
    // Perform the update BEFORE Firestore
    // reads and locks the source document.
    //
    // This avoids holding a transaction
    // open while waiting for a competing
    // write to the same document.
    const controlledDb = {
      collection: (...args) =>
        db.collection(...args),

      runTransaction: callback =>
        db.runTransaction(async transaction => {
          const controlledTransaction = new Proxy(
            transaction,
            {
              get(target, property) {
                if (property === "get") {
                  return async ref => {
                    if (
                      !sourceUpdated &&
                      ref.path === r.source.path
                    ) {
                      sourceUpdated = true;

                      await r.source.update({
                        json: JSON.stringify([
                          booking({
                            id: "freshBooking",
                            time: "11:00"
                          })
                        ]),
                        updatedAt:
                          new Date().toISOString()
                      });
                    }

                    return target.get(ref);
                  };
                }

                const value = Reflect.get(
                  target,
                  property,
                  target
                );

                return typeof value === "function"
                  ? value.bind(target)
                  : value;
              }
            }
          );

          return callback(controlledTransaction);
        })
    };

    const result =
      await migrateAndroidBookings({
        db: controlledDb,
        businessId: owner,
        authenticatedUid: owner
      });

    assert.equal(sourceUpdated, true);
    assert.equal(result.success, true);

    const stale = await r.appointments
      .doc("staleBooking")
      .get();

    const fresh = await r.appointments
      .doc("freshBooking")
      .get();

    assert.equal(stale.exists, false);
    assert.equal(fresh.exists, true);

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
