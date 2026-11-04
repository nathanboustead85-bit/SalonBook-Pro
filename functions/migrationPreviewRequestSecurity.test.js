"use strict";

/**
 * BOUSTIO — PHASE 8D.22
 *
 * Request validation security tests.
 * No Firebase deployment or writes.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  HttpsError
} = require("firebase-functions/v2/https");

const {
  validateRequestData,
  productionMigrationPreview
} = require("./migrationPreviewCallable");

function verifiedRequest(data = {}) {
  return {
    auth: {
      uid: "testBusiness123",
      token: {
        email_verified: true
      }
    },
    data
  };
}

function expectRejected(data) {
  assert.throws(
    () => validateRequestData(
      verifiedRequest(data)
    ),
    error =>
      error instanceof HttpsError &&
      error.code === "invalid-argument"
  );
}

test("1 - empty request is accepted", () => {
  assert.doesNotThrow(
    () => validateRequestData(
      verifiedRequest({})
    )
  );
});

test("2 - missing data is accepted", () => {
  assert.doesNotThrow(
    () => validateRequestData({
      auth: verifiedRequest().auth
    })
  );
});

test("3 - null data is accepted", () => {
  assert.doesNotThrow(
    () => validateRequestData(
      verifiedRequest(null)
    )
  );
});

test("4 - business ID is rejected", () => {
  expectRejected({
    businessId: "anotherBusiness"
  });
});

test("5 - appointment data is rejected", () => {
  expectRejected({
    appointments: [
      { id: "booking123" }
    ]
  });
});

test("6 - booking prices are rejected", () => {
  expectRejected({
    price: 100
  });
});

test("7 - Firestore paths are rejected", () => {
  expectRejected({
    path: "users/anotherUser/liveData"
  });
});

test("8 - arrays are rejected", () => {
  expectRejected([]);
});

test("9 - text payloads are rejected", () => {
  expectRejected("unexpected");
});

test("10 - numeric payloads are rejected", () => {
  expectRejected(123);
});

test("11 - boolean payloads are rejected", () => {
  expectRejected(true);
});

test("12 - nested data is rejected", () => {
  expectRejected({
    options: {}
  });
});

test("13 - unauthenticated production call fails", async () => {
  await assert.rejects(
    productionMigrationPreview({
      data: {}
    }),
    error =>
      error instanceof HttpsError &&
      error.code === "unauthenticated"
  );
});

test("14 - unverified production call fails", async () => {
  await assert.rejects(
    productionMigrationPreview({
      auth: {
        uid: "testBusiness123",
        token: {
          email_verified: false
        }
      },
      data: {}
    }),
    error =>
      error instanceof HttpsError &&
      error.code === "permission-denied"
  );
});

test("15 - production rejects business ID", async () => {
  await assert.rejects(
    productionMigrationPreview(
      verifiedRequest({
        businessId: "anotherBusiness"
      })
    ),
    error =>
      error instanceof HttpsError &&
      error.code === "invalid-argument"
  );
});

test("16 - production rejects appointments", async () => {
  await assert.rejects(
    productionMigrationPreview(
      verifiedRequest({
        bookings: [
          { id: "booking123" }
        ]
      })
    ),
    error =>
      error instanceof HttpsError &&
      error.code === "invalid-argument"
  );
});
