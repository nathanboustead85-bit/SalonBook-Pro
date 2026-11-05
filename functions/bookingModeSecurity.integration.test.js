"use strict";

/**
 * BOUSTIO — PHASE 8D.64
 *
 * Booking-mode Firestore security tests.
 * Uses the real repository firestore.rules.
 * Emulator only. No production access.
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
  updateDoc,
  deleteDoc,
  collection,
  getDocs
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
    "Safety stop: local Firestore emulator required."
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

const rulesPath = path.resolve(
  __dirname,
  "../firestore.rules"
);

const rules = fs.readFileSync(
  rulesPath,
  "utf8"
);

if (
  !rules.includes(
    "PHASE 8D.63: BOOKING MODE"
  )
) {
  throw new Error(
    "Booking-mode rules are missing."
  );
}

test(
  "Phase 8D.64 booking-mode security",
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

    const owner = "bookingModeOwner";
    const other = "bookingModeOther";

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

    const settingsPath =
      `businesses/${owner}/settings`;

    const modePath =
      `${settingsPath}/bookingMode`;

    const otherSettingPath =
      `${settingsPath}/privateSetting`;

    try {
      await env.clearFirestore();

      // Seed backend-controlled test data.
      await env.withSecurityRulesDisabled(
        async context => {
          const adminDb = context.firestore();

          await setDoc(
            doc(adminDb, modePath),
            {
              mode: "legacy",
              schemaVersion: 1
            }
          );

          await setDoc(
            doc(adminDb, otherSettingPath),
            {
              secret: "test-only"
            }
          );
        }
      );

      await t.test(
        "01 verified owner reads booking mode",
        async () => {
          const snapshot =
            await assertSucceeds(
              getDoc(doc(ownerDb, modePath))
            );

          assert.equal(
            snapshot.exists(),
            true
          );

          assert.equal(
            snapshot.data().mode,
            "legacy"
          );
        }
      );

      await t.test(
        "02 another owner cannot read mode",
        async () => {
          await assertFails(
            getDoc(doc(otherDb, modePath))
          );
        }
      );

      await t.test(
        "03 unverified owner cannot read mode",
        async () => {
          await assertFails(
            getDoc(doc(unverifiedDb, modePath))
          );
        }
      );

      await t.test(
        "04 anonymous user cannot read mode",
        async () => {
          await assertFails(
            getDoc(doc(anonymousDb, modePath))
          );
        }
      );

      await t.test(
        "05 owner cannot change mode",
        async () => {
          await assertFails(
            updateDoc(
              doc(ownerDb, modePath),
              { mode: "cloud" }
            )
          );
        }
      );

      await t.test(
        "06 owner cannot overwrite mode",
        async () => {
          await assertFails(
            setDoc(
              doc(ownerDb, modePath),
              { mode: "cloud" }
            )
          );
        }
      );

      await t.test(
        "07 owner cannot delete mode",
        async () => {
          await assertFails(
            deleteDoc(doc(ownerDb, modePath))
          );
        }
      );

      await t.test(
        "08 owner cannot create mode",
        async () => {
          await env.withSecurityRulesDisabled(
            async context => {
              await deleteDoc(
                doc(
                  context.firestore(),
                  modePath
                )
              );
            }
          );

          await assertFails(
            setDoc(
              doc(ownerDb, modePath),
              { mode: "legacy" }
            )
          );
        }
      );

      await t.test(
        "09 missing mode returns no document",
        async () => {
          const snapshot =
            await assertSucceeds(
              getDoc(doc(ownerDb, modePath))
            );

          assert.equal(
            snapshot.exists(),
            false
          );
        }
      );

      await t.test(
        "10 owner cannot list settings",
        async () => {
          await assertFails(
            getDocs(
              collection(
                ownerDb,
                settingsPath
              )
            )
          );
        }
      );

      await t.test(
        "11 owner cannot read other settings",
        async () => {
          await assertFails(
            getDoc(
              doc(
                ownerDb,
                otherSettingPath
              )
            )
          );
        }
      );

      await t.test(
        "12 backend can set frozen mode",
        async () => {
          await env.withSecurityRulesDisabled(
            async context => {
              await setDoc(
                doc(
                  context.firestore(),
                  modePath
                ),
                {
                  mode: "frozen",
                  schemaVersion: 1
                }
              );
            }
          );

          const snapshot =
            await assertSucceeds(
              getDoc(doc(ownerDb, modePath))
            );

          assert.equal(
            snapshot.data().mode,
            "frozen"
          );
        }
      );

      await t.test(
        "13 backend can set cloud mode",
        async () => {
          await env.withSecurityRulesDisabled(
            async context => {
              await updateDoc(
                doc(
                  context.firestore(),
                  modePath
                ),
                {
                  mode: "cloud"
                }
              );
            }
          );

          const snapshot =
            await assertSucceeds(
              getDoc(doc(ownerDb, modePath))
            );

          assert.equal(
            snapshot.data().mode,
            "cloud"
          );
        }
      );

      await t.test(
        "14 owner still cannot modify cloud mode",
        async () => {
          await assertFails(
            updateDoc(
              doc(ownerDb, modePath),
              { mode: "legacy" }
            )
          );
        }
      );

    } finally {
      await env.cleanup();
    }
  }
);
