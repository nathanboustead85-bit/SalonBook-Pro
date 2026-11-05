"use strict";

/**
 * BOUSTIO — PHASE 8D.72
 *
 * Real Firestore emulator integration tests
 * for the trusted booking freeze manager.
 *
 * Uses demo-boustio-migration only.
 * Never connects to production.
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

function bookingData(json) {
  return {
    json,
    schemaVersion: 1,
    updatedAt: serverTimestamp()
  };
}

test(
  "Phase 8D.72 Firestore booking freeze integration",
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
      "boustio-freeze-test"
    );

    const adminDb = getFirestore(app);

    const owner = "freezeIntegrationOwner";

    const modePath =
      `businesses/${owner}/settings/bookingMode`;

    const bookingsPath =
      `users/${owner}/liveData/bookings`;

    const staffPath =
      `users/${owner}/liveData/staff`;

    const migrationPath =
      `businesses/${owner}/migrations/android-bookings-v1`;

    const ownerDb = env
      .authenticatedContext(owner, {
        email_verified: true
      })
      .firestore();

    async function reset(mode = "legacy") {
      await env.clearFirestore();

      await adminDb.doc(modePath).set({
        mode,
        schemaVersion: 1
      });
    }

    try {
      await t.test(
        "01 legacy bookings writable before freeze",
        async () => {
          await reset();

          await assertSucceeds(
            setDoc(
              doc(ownerDb, bookingsPath),
              bookingData("[]")
            )
          );
        }
      );

      await t.test(
        "02 trusted backend freezes legacy mode",
        async () => {
          const result = await freezeBookingMode(
            adminDb,
            owner
          );

          assert.deepEqual(result, {
            success: true,
            mode: "frozen",
            changed: true
          });

          const snapshot =
            await adminDb.doc(modePath).get();

          assert.equal(
            snapshot.data().mode,
            "frozen"
          );
        }
      );

      await t.test(
        "03 owner can read frozen mode",
        async () => {
          const snapshot = await assertSucceeds(
            getDoc(doc(ownerDb, modePath))
          );

          assert.equal(
            snapshot.data().mode,
            "frozen"
          );
        }
      );

      await t.test(
        "04 frozen mode blocks legacy booking updates",
        async () => {
          await assertFails(
            setDoc(
              doc(ownerDb, bookingsPath),
              bookingData('[{"id":"blocked"}]')
            )
          );
        }
      );

      await t.test(
        "05 frozen mode preserves existing bookings",
        async () => {
          const snapshot = await assertSucceeds(
            getDoc(doc(ownerDb, bookingsPath))
          );

          assert.equal(
            snapshot.data().json,
            "[]"
          );
        }
      );

      await t.test(
        "06 frozen mode permits staff updates",
        async () => {
          await assertSucceeds(
            setDoc(
              doc(ownerDb, staffPath),
              bookingData('[{"id":"staff1"}]')
            )
          );
        }
      );

      await t.test(
        "07 repeat freeze is idempotent",
        async () => {
          const result = await freezeBookingMode(
            adminDb,
            owner
          );

          assert.deepEqual(result, {
            success: true,
            mode: "frozen",
            changed: false
          });
        }
      );

      await t.test(
        "08 cloud mode cannot be frozen",
        async () => {
          await reset("cloud");

          await assert.rejects(
            freezeBookingMode(adminDb, owner),
            /Only legacy mode can be frozen/
          );

          const snapshot =
            await adminDb.doc(modePath).get();

          assert.equal(
            snapshot.data().mode,
            "cloud"
          );
        }
      );

      await t.test(
        "09 migration marker prevents freeze",
        async () => {
          await reset();

          await adminDb.doc(migrationPath).set({
            status: "completed",
            schemaVersion: 1
          });

          await assert.rejects(
            freezeBookingMode(adminDb, owner),
            /already migrated/
          );

          const snapshot =
            await adminDb.doc(modePath).get();

          assert.equal(
            snapshot.data().mode,
            "legacy"
          );
        }
      );

      await t.test(
        "10 missing booking mode prevents freeze",
        async () => {
          await env.clearFirestore();

          await assert.rejects(
            freezeBookingMode(adminDb, owner),
            /not initialised/
          );
        }
      );

      await t.test(
        "11 owner cannot change booking mode",
        async () => {
          await reset();

          await assertFails(
            setDoc(
              doc(ownerDb, modePath),
              {
                mode: "frozen",
                schemaVersion: 1
              }
            )
          );
        }
      );

      await t.test(
        "12 invalid mode cannot be frozen",
        async () => {
          await reset("invalid");

          await assert.rejects(
            freezeBookingMode(adminDb, owner),
            /Only legacy mode can be frozen/
          );
        }
      );

    } finally {
      await env.cleanup();
      await deleteApp(app);
    }
  }
);
