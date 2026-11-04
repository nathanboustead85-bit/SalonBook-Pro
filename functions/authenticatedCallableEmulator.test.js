"use strict";

/**
 * BOUSTIO — PHASE 8D.27
 *
 * Authenticated migration preview
 * integration tests using real
 * Firestore Emulator storage.
 *
 * Tests the production handler directly.
 * Does not test HTTP transport or
 * Firebase token verification.
 *
 * No production database access.
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
  HttpsError
} = require("firebase-functions/v2/https");

const {
  productionMigrationPreview
} = require("./migrationPreviewCallable");

const host = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = "demo-boustio-migration";

if (
  !host ||
  !/^(localhost|127\.0\.0\.1):[0-9]+$/.test(host)
) {
  throw new Error(
    "Safety stop: local Firestore Emulator required."
  );
}

if (
  process.env.GCLOUD_PROJECT !== projectId ||
  process.env.GOOGLE_CLOUD_PROJECT !== projectId
) {
  throw new Error(
    "Safety stop: unexpected Firebase project."
  );
}

if (!getApps().length) {
  initializeApp({ projectId });
}

const db = getFirestore();

const UID = "callableEmulatorOwner";

const sourceRef = db
  .collection("users")
  .doc(UID)
  .collection("liveData")
  .doc("bookings");

const appointmentsRef = db
  .collection("businesses")
  .doc(UID)
  .collection("appointments");

const locksRef = db
  .collection("businesses")
  .doc(UID)
  .collection("bookingLocks");

function request({
  uid = UID,
  verified = true,
  data = {}
} = {}) {
  return {
    auth: {
      uid,
      token: {
        email_verified: verified
      }
    },
    data
  };
}

function booking() {
  return {
    id: "callableBooking1",
    client: "Private Emulator Client",
    service: "Haircut",
    serviceId: "service1",
    staffId: "staff1",
    date: "2026-11-12",
    time: "10:00",
    duration: 30,
    price: "20.00",
    notes: "Private test notes"
  };
}

async function clearCollection(ref) {
  const snapshot = await ref.get();

  for (const doc of snapshot.docs) {
    await doc.ref.delete();
  }
}

async function clearData() {
  await clearCollection(appointmentsRef);
  await clearCollection(locksRef);
  await sourceRef.delete();
}

async function seed() {
  await sourceRef.set({
    schemaVersion: 1,
    json: JSON.stringify([booking()]),
    updatedAt: new Date().toISOString()
  });
}

function isError(code) {
  return error =>
    error instanceof HttpsError &&
    error.code === code;
}

test(
  "Authenticated callable Firestore integration",
  async t => {
    await clearData();

    try {
      await seed();

      await t.test(
        "1 - verified owner receives summary",
        async () => {
          const result =
            await productionMigrationPreview(
              request()
            );

          assert.equal(result.success, true);
          assert.equal(result.businessId, UID);
          assert.equal(result.readOnly, true);
          assert.equal(result.sourceCount, 1);
          assert.equal(result.safeToMigrate, true);
        }
      );

      await t.test(
        "2 - customer data is not returned",
        async () => {
          const result =
            await productionMigrationPreview(
              request()
            );

          const output = JSON.stringify(result);

          assert.equal(
            output.includes("Private Emulator Client"),
            false
          );

          assert.equal(
            output.includes("Private test notes"),
            false
          );

          assert.equal(
            Object.hasOwn(result, "appointments"),
            false
          );

          assert.equal(
            Object.hasOwn(result, "locks"),
            false
          );
        }
      );

      await t.test(
        "3 - missing authentication rejected",
        async () => {
          await assert.rejects(
            productionMigrationPreview({
              data: {}
            }),
            isError("unauthenticated")
          );
        }
      );

      await t.test(
        "4 - unverified email rejected",
        async () => {
          await assert.rejects(
            productionMigrationPreview(
              request({ verified: false })
            ),
            isError("permission-denied")
          );
        }
      );

      await t.test(
        "5 - client business ID rejected",
        async () => {
          await assert.rejects(
            productionMigrationPreview(
              request({
                data: {
                  businessId: "anotherBusiness"
                }
              })
            ),
            isError("invalid-argument")
          );
        }
      );

      await t.test(
        "6 - another owner cannot read source",
        async () => {
          await assert.rejects(
            productionMigrationPreview(
              request({
                uid: "anotherBusiness"
              })
            ),
            isError("failed-precondition")
          );
        }
      );

      await t.test(
        "7 - appointment conflict blocks preview",
        async () => {
          const ref = appointmentsRef
            .doc("callableBooking1");

          await ref.set({ testOnly: true });

          const result =
            await productionMigrationPreview(
              request()
            );

          assert.equal(
            result.safeToMigrate,
            false
          );

          await ref.delete();
        }
      );

      await t.test(
        "8 - preview creates no booking locks",
        async () => {
          const before = await locksRef.get();

          await productionMigrationPreview(
            request()
          );

          const after = await locksRef.get();

          assert.equal(after.size, before.size);
          assert.equal(after.empty, true);
        }
      );
    } finally {
      await clearData();
    }
  }
);
