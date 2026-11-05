"use strict";

/**
 * BOUSTIO — PHASE 8D.60B
 *
 * Legacy booking cutover security tests.
 *
 * Requires:
 * - Firestore emulator
 * - @firebase/rules-unit-testing
 * - firebase client SDK
 *
 * Uses test-only Firestore rules.
 * Never accesses production.
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
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp
} = require("firebase/firestore");

const PROJECT_ID = "demo-boustio-migration";

const emulatorHost =
  process.env.FIRESTORE_EMULATOR_HOST;

if (
  !emulatorHost ||
  !/^127\.0\.0\.1:\d+$|^localhost:\d+$/.test(
    emulatorHost
  )
) {
  throw new Error(
    "Safety stop: local Firestore emulator required."
  );
}

if (
  process.env.GCLOUD_PROJECT &&
  process.env.GCLOUD_PROJECT !== PROJECT_ID
) {
  throw new Error("Unexpected Firebase project.");
}

const [host, portText] = emulatorHost.split(":");
const port = Number(portText);

const rulesPath = path.resolve(
  __dirname,
  "../firestore.cutover.test.rules"
);

const rules = fs.readFileSync(
  rulesPath,
  "utf8"
);

function legacyData(value = "[]") {
  return {
    json: value,
    schemaVersion: 1,
    updatedAt: serverTimestamp()
  };
}

test(
  "Phase 8D.60B cutover security",
  async t => {
    const env = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host,
        port,
        rules
      }
    });

    const owner = "cutoverTestOwner";
    const other = "cutoverOtherOwner";

    const ownerDb = env
      .authenticatedContext(owner, {
        email_verified: true
      })
      .firestore();

    const unverifiedDb = env
      .authenticatedContext(owner, {
        email_verified: false
      })
      .firestore();

    const otherDb = env
      .authenticatedContext(other, {
        email_verified: true
      })
      .firestore();

    const anonymousDb = env
      .unauthenticatedContext()
      .firestore();

    const sourcePath =
      `users/${owner}/liveData/bookings`;

    const staffPath =
      `users/${owner}/liveData/staff`;

    const markerPath =
      `businesses/${owner}/migrations/android-bookings-v1`;

    const appointmentPath =
      `businesses/${owner}/appointments/testBooking`;

    try {
      await env.clearFirestore();

      await t.test(
        "01 owner can save bookings before migration",
        async () => {
          await assertSucceeds(
            setDoc(
              doc(ownerDb, sourcePath),
              legacyData()
            )
          );
        }
      );

      await t.test(
        "02 other owner cannot change bookings",
        async () => {
          await assertFails(
            setDoc(
              doc(otherDb, sourcePath),
              legacyData()
            )
          );
        }
      );

      await t.test(
        "03 unverified owner cannot change bookings",
        async () => {
          await assertFails(
            setDoc(
              doc(unverifiedDb, sourcePath),
              legacyData()
            )
          );
        }
      );

      await t.test(
        "04 anonymous client cannot change bookings",
        async () => {
          await assertFails(
            setDoc(
              doc(anonymousDb, sourcePath),
              legacyData()
            )
          );
        }
      );

      await t.test(
        "05 client cannot forge migration marker",
        async () => {
          await assertFails(
            setDoc(
              doc(ownerDb, markerPath),
              { completed: true }
            )
          );
        }
      );

      // Simulate trusted backend completing migration.
      await env.withSecurityRulesDisabled(
        async context => {
          await setDoc(
            doc(context.firestore(), markerPath),
            {
              completed: true,
              testOnly: true
            }
          );
        }
      );

      await t.test(
        "06 migrated owner can still read legacy data",
        async () => {
          const snapshot = await assertSucceeds(
            getDoc(doc(ownerDb, sourcePath))
          );

          assert.equal(snapshot.exists(), true);
        }
      );

      await t.test(
        "07 migrated owner cannot update legacy bookings",
        async () => {
          await assertFails(
            setDoc(
              doc(ownerDb, sourcePath),
              legacyData('[{"id":"new"}]')
            )
          );
        }
      );

      await t.test(
        "08 migrated owner cannot delete legacy bookings",
        async () => {
          await assertFails(
            deleteDoc(doc(ownerDb, sourcePath))
          );
        }
      );

      await t.test(
        "09 staff data remains writable after migration",
        async () => {
          await assertSucceeds(
            setDoc(
              doc(ownerDb, staffPath),
              legacyData()
            )
          );
        }
      );

      await t.test(
        "10 client cannot create cloud appointments",
        async () => {
          await assertFails(
            setDoc(
              doc(ownerDb, appointmentPath),
              { status: "confirmed" }
            )
          );
        }
      );

      await t.test(
        "11 client cannot remove migration marker",
        async () => {
          await assertFails(
            deleteDoc(doc(ownerDb, markerPath))
          );
        }
      );

      await t.test(
        "12 other owner cannot read legacy bookings",
        async () => {
          await assertFails(
            getDoc(doc(otherDb, sourcePath))
          );
        }
      );
    } finally {
      await env.cleanup();
    }
  }
);
