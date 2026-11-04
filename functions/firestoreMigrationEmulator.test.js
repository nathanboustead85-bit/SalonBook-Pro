"use strict";

/**
 * BOUSTIO — PHASE 8D.24
 *
 * Real Firestore Emulator integration tests.
 *
 * Run only with FIRESTORE_EMULATOR_HOST set.
 * Never connect these tests to production.
 *
 * No customer data is used.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  initializeApp,
  getApps
} = require("firebase-admin/app");

const {
  getFirestore
} = require("firebase-admin/firestore");

const {
  previewFirestoreMigration
} = require("./firestoreMigrationPreview");

const EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST;

if (!EMULATOR_HOST) {
  throw new Error(
    "Safety stop: Firestore Emulator is " +
    "not configured. Refusing database tests."
  );
}

if (
  !/^(localhost|127\.0\.0\.1):[0-9]+$/.test(
    EMULATOR_HOST
  )
) {
  throw new Error(
    "Safety stop: emulator must use localhost."
  );
}

const PROJECT_ID = "demo-boustio-migration";

if (!getApps().length) {
  initializeApp({
    projectId: PROJECT_ID
  });
}

const db = getFirestore();

const UID = "emulatorTestBusiness";

const businessRef = db
  .collection("businesses")
  .doc(UID);

const bookingsRef = db
  .collection("users")
  .doc(UID)
  .collection("liveData")
  .doc("bookings");

const appointmentsRef = businessRef
  .collection("appointments");

const locksRef = businessRef
  .collection("bookingLocks");

function booking() {
  return {
    id: "emulatorBooking1",
    client: "Emulator Test Client",
    service: "Haircut",
    serviceId: "service1",
    staffId: "staff1",
    date: "2026-11-12",
    time: "10:00",
    duration: 30,
    price: "20.00",
    notes: ""
  };
}

async function clearTestData() {
  const appointments =
    await appointmentsRef.get();

  const locks =
    await locksRef.get();

  const batch = db.batch();

  appointments.forEach(doc => {
    batch.delete(doc.ref);
  });

  locks.forEach(doc => {
    batch.delete(doc.ref);
  });

  batch.delete(bookingsRef);

  await batch.commit();
}

async function seedBookings(
  bookings = [booking()]
) {
  await bookingsRef.set({
    schemaVersion: 1,
    json: JSON.stringify(bookings),
    updatedAt: new Date().toISOString()
  });
}

async function preview() {
  return previewFirestoreMigration({
    db,
    businessId: UID,
    authenticatedUid: UID
  });
}

test(
  "Firestore Emulator migration integration",
  async t => {
    // Start from an isolated test dataset.
    await clearTestData();

    try {
      await t.test(
        "1 - valid booking passes",
        async () => {
          await seedBookings();

          const result = await preview();

          assert.equal(
            result.safeToMigrate,
            true
          );

          assert.equal(
            result.status,
            "PREFLIGHT_PASSED"
          );

          assert.equal(
            result.readOnly,
            true
          );
        }
      );

      await t.test(
        "2 - existing appointment blocks",
        async () => {
          await appointmentsRef
            .doc("emulatorBooking1")
            .set({
              testOnly: true
            });

          const result = await preview();

          assert.equal(
            result.safeToMigrate,
            false
          );

          assert.equal(
            result.status,
            "MIGRATION_BLOCKED"
          );

          await appointmentsRef
            .doc("emulatorBooking1")
            .delete();
        }
      );

      await t.test(
        "3 - existing booking lock blocks",
        async () => {
          await locksRef
            .doc("staff1_2026-11-12_1000")
            .set({
              testOnly: true
            });

          const result = await preview();

          assert.equal(
            result.safeToMigrate,
            false
          );

          assert.deepEqual(
            result.locks,
            []
          );

          await locksRef
            .doc("staff1_2026-11-12_1000")
            .delete();
        }
      );

      await t.test(
        "4 - wrong business owner rejected",
        async () => {
          await assert.rejects(
            previewFirestoreMigration({
              db,
              businessId: UID,
              authenticatedUid:
                "anotherBusiness"
            }),
            /ownership/
          );
        }
      );

      await t.test(
        "5 - missing source blocks preview",
        async () => {
          await bookingsRef.delete();

          await assert.rejects(
            preview(),
            /missing/
          );
        }
      );

      await t.test(
        "6 - malformed source is blocked",
        async () => {
          await bookingsRef.set({
            schemaVersion: 1,
            json: "{invalid",
            updatedAt: new Date()
              .toISOString()
          });

          await assert.rejects(
            preview()
          );
        }
      );

      await t.test(
        "7 - preview never creates records",
        async () => {
          await seedBookings();

          const beforeAppointments =
            await appointmentsRef.get();

          const beforeLocks =
            await locksRef.get();

          await preview();

          const afterAppointments =
            await appointmentsRef.get();

          const afterLocks =
            await locksRef.get();

          assert.equal(
            beforeAppointments.size,
            afterAppointments.size
          );

          assert.equal(
            beforeLocks.size,
            afterLocks.size
          );

          assert.equal(
            afterAppointments.empty,
            true
          );

          assert.equal(
            afterLocks.empty,
            true
          );
        }
      );
    } finally {
      await clearTestData();
    }
  }
);
