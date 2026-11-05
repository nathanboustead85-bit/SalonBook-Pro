"use strict";

/**
 * BOUSTIO — PHASE 8D.61B
 *
 * Production Firestore Rules
 * Cutover Security Integration Tests
 *
 * Tests the actual firestore.rules file
 * using the local Firebase emulator.
 *
 * No production Firebase access.
 * No customer data.
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

// =====================================
// EMULATOR SAFETY
// =====================================

const PROJECT_ID = "demo-boustio-migration";

const emulatorHost =
  process.env.FIRESTORE_EMULATOR_HOST;

if (
  !emulatorHost ||
  !/^(127\.0\.0\.1|localhost):\d+$/.test(
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
  throw new Error(
    "Safety stop: unexpected Firebase project."
  );
}

if (
  process.env.GOOGLE_CLOUD_PROJECT &&
  process.env.GOOGLE_CLOUD_PROJECT !== PROJECT_ID
) {
  throw new Error(
    "Safety stop: unexpected Google Cloud project."
  );
}

const [host, portText] =
  emulatorHost.split(":");

const port = Number(portText);

// =====================================
// LOAD ACTUAL FIRESTORE SECURITY RULES
// =====================================

const rulesPath = path.resolve(
  __dirname,
  "../firestore.rules"
);

if (!fs.existsSync(rulesPath)) {
  throw new Error(
    "Main firestore.rules file is missing."
  );
}

const rules = fs.readFileSync(
  rulesPath,
  "utf8"
);

if (
  !rules.includes(
    "function migrationCompleted(userId)"
  )
) {
  throw new Error(
    "Migration protection missing from main rules."
  );
}

// =====================================
// TEST DATA
// =====================================

function legacyData(value = "[]") {
  return {
    json: value,
    schemaVersion: 1,
    updatedAt: serverTimestamp()
  };
}

// =====================================
// SECURITY INTEGRATION TESTS
// =====================================

test(
  "Phase 8D.61B production rules cutover security",
  async t => {

    const env =
      await initializeTestEnvironment({
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

      // =================================
      // TEST 01
      // =================================

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

      // =================================
      // TEST 02
      // =================================

      await t.test(
        "02 another owner cannot change bookings",
        async () => {
          await assertFails(
            setDoc(
              doc(otherDb, sourcePath),
              legacyData()
            )
          );
        }
      );

      // =================================
      // TEST 03
      // =================================

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

      // =================================
      // TEST 04
      // =================================

      await t.test(
        "04 anonymous user cannot change bookings",
        async () => {
          await assertFails(
            setDoc(
              doc(anonymousDb, sourcePath),
              legacyData()
            )
          );
        }
      );

      // =================================
      // TEST 05
      // =================================

      await t.test(
        "05 client cannot forge migration marker",
        async () => {
          await assertFails(
            setDoc(
              doc(ownerDb, markerPath),
              {
                completed: true
              }
            )
          );
        }
      );

      // =================================
      // SIMULATE COMPLETED MIGRATION
      // =================================

      await env.withSecurityRulesDisabled(
        async context => {
          await setDoc(
            doc(
              context.firestore(),
              markerPath
            ),
            {
              completed: true,
              testOnly: true
            }
          );
        }
      );

      // =================================
      // TEST 06
      // =================================

      await t.test(
        "06 migrated owner can read legacy bookings",
        async () => {
          const snapshot =
            await assertSucceeds(
              getDoc(
                doc(ownerDb, sourcePath)
              )
            );

          assert.equal(
            snapshot.exists(),
            true
          );
        }
      );

      // =================================
      // TEST 07
      // =================================

      await t.test(
        "07 migrated owner cannot update legacy bookings",
        async () => {
          await assertFails(
            setDoc(
              doc(ownerDb, sourcePath),
              legacyData(
                '[{"id":"newBooking"}]'
              )
            )
          );
        }
      );

      // =================================
      // TEST 08
      // =================================

      await t.test(
        "08 migrated owner cannot delete legacy bookings",
        async () => {
          await assertFails(
            deleteDoc(
              doc(ownerDb, sourcePath)
            )
          );
        }
      );

      // =================================
      // TEST 09
      // =================================

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

      // =================================
      // TEST 10
      // =================================

      await t.test(
        "10 client cannot create cloud appointments",
        async () => {
          await assertFails(
            setDoc(
              doc(ownerDb, appointmentPath),
              {
                status: "confirmed"
              }
            )
          );
        }
      );

      // =================================
      // TEST 11
      // =================================

      await t.test(
        "11 client cannot delete migration marker",
        async () => {
          await assertFails(
            deleteDoc(
              doc(ownerDb, markerPath)
            )
          );
        }
      );

      // =================================
      // TEST 12
      // =================================

      await t.test(
        "12 another owner cannot read legacy bookings",
        async () => {
          await assertFails(
            getDoc(
              doc(otherDb, sourcePath)
            )
          );
        }
      );

    } finally {
      await env.cleanup();
    }
  }
);
