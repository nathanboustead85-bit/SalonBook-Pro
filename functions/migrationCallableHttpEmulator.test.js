"use strict";

/**
 * BOUSTIO — PHASE 8D.32
 *
 * Firebase callable HTTP integration tests.
 * Uses Auth, Firestore and Functions emulators.
 *
 * No production credentials or customer data.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  initializeApp,
  getApps
} = require("firebase-admin/app");

const {
  getAuth
} = require("firebase-admin/auth");

const {
  getFirestore
} = require("firebase-admin/firestore");

const PROJECT = "demo-boustio-migration";
const UID = "httpTestOwner";
const OTHER_UID = "httpTestOtherOwner";

const HOSTS = {
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FUNCTIONS_EMULATOR_HOST: "127.0.0.1:5001"
};

// Refuse to run against unexpected endpoints.
for (const [key, expected] of Object.entries(HOSTS)) {
  const actual = process.env[key];

  if (
    actual !== expected &&
    actual !== expected.replace(
      "127.0.0.1",
      "localhost"
    )
  ) {
    throw new Error(
      `Safety stop: ${key} must be ${expected}`
    );
  }
}

if (
  process.env.GCLOUD_PROJECT !== PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT !== PROJECT
) {
  throw new Error(
    "Safety stop: wrong Firebase test project."
  );
}

if (!getApps().length) {
  initializeApp({
    projectId: PROJECT
  });
}

const auth = getAuth();
const db = getFirestore();

const functionUrl =
  "http://127.0.0.1:5001/" +
  PROJECT +
  "/europe-west2/migrationPreviewCallable";

const authUrl =
  "http://127.0.0.1:9099/identitytoolkit.googleapis.com/" +
  "v1/accounts:signInWithCustomToken?key=fake-api-key";

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

function booking() {
  return {
    id: "httpTestBooking1",
    client: "Confidential Test Client",
    service: "Haircut",
    serviceId: "service1",
    staffId: "staff1",
    date: "2026-11-12",
    time: "10:00",
    duration: 30,
    price: "20.00",
    notes: "Confidential test notes"
  };
}

async function clearCollection(ref) {
  const snapshot = await ref.get();

  for (const doc of snapshot.docs) {
    await doc.ref.delete();
  }
}

async function cleanup() {
  await clearCollection(appointmentsRef);
  await clearCollection(locksRef);
  await sourceRef.delete();

  for (const uid of [UID, OTHER_UID]) {
    try {
      await auth.deleteUser(uid);
    } catch (error) {
      if (error.code !== "auth/user-not-found") {
        throw error;
      }
    }
  }
}

async function seed() {
  await sourceRef.set({
    schemaVersion: 1,
    json: JSON.stringify([booking()]),
    updatedAt: new Date().toISOString()
  });
}

async function createToken(uid, verified) {
  await auth.createUser({
    uid,
    email: `${uid}@example.test`,
    emailVerified: verified
  });

  const customToken =
    await auth.createCustomToken(uid);

  const response = await fetch(authUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      token: customToken,
      returnSecureToken: true
    })
  });

  const result = await response.json();

  assert.equal(
    response.ok,
    true,
    JSON.stringify(result)
  );

  assert.equal(
    typeof result.idToken,
    "string"
  );

  return result.idToken;
}

async function callFunction(
  token = null,
  data = {}
) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(functionUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ data })
  });

  return {
    status: response.status,
    body: await response.json()
  };
}

test(
  "Boustio callable HTTP emulator security",
  async t => {
    await cleanup();

    try {
      await seed();

      const ownerToken =
        await createToken(UID, true);

      const unverifiedToken =
        await createToken(OTHER_UID, false);

      await t.test(
        "1 - verified owner receives summary",
        async () => {
          const result =
            await callFunction(ownerToken);

          assert.equal(result.status, 200);
          assert.equal(
            result.body.result.success,
            true
          );
          assert.equal(
            result.body.result.businessId,
            UID
          );
          assert.equal(
            result.body.result.readOnly,
            true
          );
        }
      );

      await t.test(
        "2 - unauthenticated call rejected",
        async () => {
          const result = await callFunction();

          assert.equal(
            result.body.error.status,
            "UNAUTHENTICATED"
          );
        }
      );

      await t.test(
        "3 - invalid token rejected",
        async () => {
          const result =
            await callFunction("invalid-token");

          assert.equal(
            result.body.error.status,
            "UNAUTHENTICATED"
          );
        }
      );

      await t.test(
        "4 - unverified email rejected",
        async () => {
          const result =
            await callFunction(unverifiedToken);

          assert.equal(
            result.body.error.status,
            "PERMISSION_DENIED"
          );
        }
      );

      await t.test(
        "5 - business ID injection rejected",
        async () => {
          const result =
            await callFunction(
              ownerToken,
              { businessId: OTHER_UID }
            );

          assert.equal(
            result.body.error.status,
            "INVALID_ARGUMENT"
          );
        }
      );

      await t.test(
        "6 - another owner cannot read data",
        async () => {
          await auth.updateUser(OTHER_UID, {
            emailVerified: true
          });

          const otherToken =
            await auth.createCustomToken(
              OTHER_UID
            );

          const response = await fetch(
            authUrl,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json"
              },
              body: JSON.stringify({
                token: otherToken,
                returnSecureToken: true
              })
            }
          );

          assert.equal(response.ok, true);

          const credentials =
            await response.json();

          const result =
            await callFunction(
              credentials.idToken
            );

          assert.equal(
            result.body.error.status,
            "FAILED_PRECONDITION"
          );
        }
      );

      await t.test(
        "7 - response hides customer details",
        async () => {
          const result =
            await callFunction(ownerToken);

          const text =
            JSON.stringify(result.body);

          assert.equal(result.status, 200);

          assert.equal(
            text.includes(
              "Confidential Test Client"
            ),
            false
          );

          assert.equal(
            text.includes(
              "Confidential test notes"
            ),
            false
          );

          assert.equal(
            Object.hasOwn(
              result.body.result,
              "appointments"
            ),
            false
          );
        }
      );

      await t.test(
        "8 - HTTP preview is read-only",
        async () => {
          const before =
            await locksRef.get();

          const result =
            await callFunction(ownerToken);

          const after =
            await locksRef.get();

          assert.equal(result.status, 200);
          assert.equal(after.size, before.size);
          assert.equal(after.empty, true);
        }
      );
    } finally {
      await cleanup();
    }
  }
);
