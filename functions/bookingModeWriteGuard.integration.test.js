"use strict";

/**
 * BOUSTIO — PHASE 8D.69
 *
 * Firestore booking-mode write guard tests.
 *
 * Emulator only.
 * No production Firebase connection.
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
    "Safety stop: local Firestore emulator required"
  );
}

for (const variable of [
  "GCLOUD_PROJECT",
  "GOOGLE_CLOUD_PROJECT"
]) {
  if (
    process.env[variable] &&
    process.env[variable] !== PROJECT_ID
  ) {
    throw new Error(
      `Safety stop: unexpected ${variable}`
    );
  }
}

const [host, portText] =
  emulatorHost.split(":");

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
    "Booking-mode write guard is missing"
  );
}

function bookingData(value = "[]") {
  return {
    json: value,
    schemaVersion: 1,
    updatedAt: serverTimestamp()
  };
}

test(
  "Phase 8D.69 booking-mode write guards",
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

    const owner = "modeWriteGuardOwner";
    const other = "modeWriteGuardOther";

    const sourcePath =
      `users/${owner}/liveData/bookings`;

    const staffPath =
      `users/${owner}/liveData/staff`;

    const modePath =
      `businesses/${owner}/settings/bookingMode`;

    const markerPath =
      `businesses/${owner}/migrations/android-bookings-v1`;

    const ownerDb = env
      .authenticatedContext(owner, {
        email_verified: true
      })
      .firestore();

    const otherDb = env
      .authenticatedContext(other, {
        email_verified: true
      })
      .firestore();

    const unverifiedDb = env
      .authenticatedContext(owner, {
        email_verified: false
      })
      .firestore();

    const anonymousDb = env
      .unauthenticatedContext()
      .firestore();

    async function seedMode(mode) {
      await env.withSecurityRulesDisabled(
        async context => {
          await setDoc(
            doc(context.firestore(), modePath),
            {
              mode,
              schemaVersion: 1
            }
          );
        }
      );
    }

    async function seedMarker() {
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
    }

    try {
      await env.clearFirestore();

      await t.test(
        "01 missing mode permits transitional legacy write",
        async () => {
          await assertSucceeds(
            setDoc(
              doc(ownerDb, sourcePath),
              bookingData()
            )
          );
        }
      );

      await seedMode("legacy");

      await t.test(
        "02 legacy mode permits booking update",
        async () => {
          await assertSucceeds(
            setDoc(
              doc(ownerDb, sourcePath),
              bookingData('[{"id":"legacy"}]')
            )
          );
        }
      );

      await t.test(
        "03 another owner cannot write bookings",
        async () => {
          await assertFails(
            setDoc(
              doc(otherDb, sourcePath),
              bookingData()
            )
          );
        }
      );

      await t.test(
        "04 unverified owner cannot write bookings",
        async () => {
          await assertFails(
            setDoc(
              doc(unverifiedDb, sourcePath),
              bookingData()
            )
          );
        }
      );

      await t.test(
        "05 anonymous user cannot write bookings",
        async () => {
          await assertFails(
            setDoc(
              doc(anonymousDb, sourcePath),
              bookingData()
            )
          );
        }
      );

      await seedMode("frozen");

      await t.test(
        "06 frozen mode rejects booking update",
        async () => {
          await assertFails(
            setDoc(
              doc(ownerDb, sourcePath),
              bookingData('[{"id":"blocked"}]')
            )
          );
        }
      );

      await t.test(
        "07 frozen mode still permits booking read",
        async () => {
          const snapshot =
            await assertSucceeds(
              getDoc(doc(ownerDb, sourcePath))
            );

          assert.equal(snapshot.exists(), true);
        }
      );

      await t.test(
        "08 frozen mode permits staff updates",
        async () => {
          await assertSucceeds(
            setDoc(
              doc(ownerDb, staffPath),
              bookingData('[{"id":"staff"}]')
            )
          );
        }
      );

      await seedMode("cloud");

      await t.test(
        "09 cloud mode rejects booking update",
        async () => {
          await assertFails(
            setDoc(
              doc(ownerDb, sourcePath),
              bookingData('[{"id":"cloud"}]')
            )
          );
        }
      );

      await seedMode("invalid");

      await t.test(
        "10 invalid mode rejects booking update",
        async () => {
          await assertFails(
            setDoc(
              doc(ownerDb, sourcePath),
              bookingData()
            )
          );
        }
      );

      await seedMode("legacy");
      await seedMarker();

      await t.test(
        "11 migration marker blocks legacy mode",
        async () => {
          await assertFails(
            setDoc(
              doc(ownerDb, sourcePath),
              bookingData('[{"id":"afterMigration"}]')
            )
          );
        }
      );

      await t.test(
        "12 owner cannot overwrite booking mode",
        async () => {
          await assertFails(
            setDoc(
              doc(ownerDb, modePath),
              {
                mode: "legacy",
                schemaVersion: 1
              }
            )
          );
        }
      );

    } finally {
      await env.cleanup();
    }
  }
);
