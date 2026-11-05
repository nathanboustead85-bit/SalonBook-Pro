"use strict";

/**
 * BOUSTIO — PHASE 8D.73
 *
 * Delayed Android booking upload protection.
 *
 * Firestore emulator only.
 * No production access.
 * No public Cloud Function.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} = require("@firebase/rules-unit-testing");

const {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} = require("firebase/firestore");

const {
  initializeApp,
  deleteApp
} = require("firebase-admin/app");

const {
  getFirestore
} = require("firebase-admin/firestore");

const {
  freezeBookingMode
} = require("./freezeBookingMode");

const PROJECT_ID = "demo-boustio-migration";
const HOST = process.env.FIRESTORE_EMULATOR_HOST;

if (
  !HOST ||
  !/^(127\.0\.0\.1|localhost):\d+$/.test(HOST)
) {
  throw new Error(
    "Safety stop: local Firestore emulator required"
  );
}

for (const name of [
  "GCLOUD_PROJECT",
  "GOOGLE_CLOUD_PROJECT"
]) {
  if (
    process.env[name] &&
    process.env[name] !== PROJECT_ID
  ) {
    throw new Error(
      `Safety stop: unexpected ${name}`
    );
  }
}

const [host, portText] = HOST.split(":");
const port = Number(portText);

const rules = fs.readFileSync(
  path.resolve(__dirname, "../firestore.rules"),
  "utf8"
);

if (
  !rules.includes(
    "function legacyBookingWriteAllowed(userId)"
  )
) {
  throw new Error(
    "Booking write protection is missing"
  );
}

function payload(json) {
  return {
    json,
    schemaVersion: 1,
    updatedAt: serverTimestamp()
  };
}

test(
  "Phase 8D.73 delayed booking upload protection",
  async t => {
    const env = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host,
        port,
        rules
      }
    });

    const app = initializeApp(
      { projectId: PROJECT_ID },
      "boustio-pending-upload-test"
    );

    const adminDb = getFirestore(app);

    const owner = "pendingUploadOwner";

    const modePath =
      `businesses/${owner}/settings/bookingMode`;

    const bookingsPath =
      `users/${owner}/liveData/bookings`;

    const staffPath =
      `users/${owner}/liveData/staff`;

    const ownerDb = env
      .authenticatedContext(owner, {
        email_verified: true
      })
      .firestore();

    const otherDb = env
      .authenticatedContext("pendingUploadOther", {
        email_verified: true
      })
      .firestore();

    const finalBookings =
      '[{"id":"booking-final","status":"confirmed"}]';

    const staleBookings =
      '[{"id":"booking-stale","status":"confirmed"}]';

    async function reset() {
      await env.clearFirestore();

      await adminDb.doc(modePath).set({
        mode: "legacy",
        schemaVersion: 1
      });
    }

    try {
      await reset();

      await t.test(
        "01 legacy owner can upload before freeze",
        async () => {
          await assertSucceeds(
            setDoc(
              doc(ownerDb, bookingsPath),
              payload(finalBookings)
            )
          );
        }
      );

      await t.test(
        "02 freeze succeeds with existing booking data",
        async () => {
          const result = await freezeBookingMode(
            adminDb,
            owner
          );

          assert.equal(result.success, true);
          assert.equal(result.mode, "frozen");
          assert.equal(result.changed, true);
        }
      );

      await t.test(
        "03 delayed stale upload is rejected",
        async () => {
          await assertFails(
            setDoc(
              doc(ownerDb, bookingsPath),
              payload(staleBookings)
            )
          );
        }
      );

      await t.test(
        "04 final cloud data remains unchanged",
        async () => {
          const snapshot =
            await adminDb.doc(bookingsPath).get();

          assert.equal(
            snapshot.data().json,
            finalBookings
          );
        }
      );

      await t.test(
        "05 repeated delayed upload is rejected",
        async () => {
          await assertFails(
            setDoc(
              doc(ownerDb, bookingsPath),
              payload(staleBookings)
            )
          );
        }
      );

      await t.test(
        "06 owner can still read final bookings",
        async () => {
          const snapshot = await assertSucceeds(
            getDoc(doc(ownerDb, bookingsPath))
          );

          assert.equal(
            snapshot.data().json,
            finalBookings
          );
        }
      );

      await t.test(
        "07 another account cannot overwrite bookings",
        async () => {
          await assertFails(
            setDoc(
              doc(otherDb, bookingsPath),
              payload(staleBookings)
            )
          );
        }
      );

      await t.test(
        "08 unrelated staff data remains writable",
        async () => {
          await assertSucceeds(
            setDoc(
              doc(ownerDb, staffPath),
              payload('[{"id":"staff1"}]')
            )
          );
        }
      );

      await t.test(
        "09 server still reports frozen mode",
        async () => {
          const snapshot =
            await adminDb.doc(modePath).get();

          assert.equal(
            snapshot.data().mode,
            "frozen"
          );
        }
      );

    } finally {
      await env.cleanup();
      await deleteApp(app);
    }
  }
);
