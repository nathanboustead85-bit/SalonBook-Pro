"use strict";

/**
 * BOUSTIO — PHASE 8D.21
 *
 * Secure, read-only migration preview.
 *
 * Not exported from index.js.
 * Not deployed.
 */

const {
  onCall,
  HttpsError
} = require("firebase-functions/v2/https");

const {
  getFirestore
} = require("firebase-admin/firestore");

const {
  authenticatedMigrationPreview,
  MigrationAuthError,
  verifiedOwner
} = require("./authenticatedMigrationPreview");

/**
 * Safe error conversion.
 */
function toCallableError(error) {
  if (error instanceof HttpsError) {
    return error;
  }

  if (error instanceof MigrationAuthError) {
    switch (error.code) {
      case "unauthenticated":
        return new HttpsError(
          "unauthenticated",
          "Sign in to your business account."
        );

      case "permission-denied":
        return new HttpsError(
          "permission-denied",
          "Verify your email before continuing."
        );

      case "unavailable":
        return new HttpsError(
          "unavailable",
          "Migration preview is unavailable."
        );

      default:
        return new HttpsError(
          "internal",
          "Migration preview failed."
        );
    }
  }

  if (
    error &&
    error.code === "migration-preview-error"
  ) {
    return new HttpsError(
      "failed-precondition",
      "Migration preview could not be " +
      "completed safely."
    );
  }

  return new HttpsError(
    "internal",
    "Migration preview failed. " +
    "Please try again later."
  );
}

/**
 * Only an empty request body is allowed.
 *
 * No business IDs, booking records,
 * prices or Firestore paths are accepted.
 */
function validateRequestData(request) {
  const data = request && request.data;

  if (
    data === undefined ||
    data === null
  ) {
    return;
  }

  if (
    typeof data !== "object" ||
    Array.isArray(data) ||
    Object.keys(data).length !== 0
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Migration preview does not " +
      "accept request parameters."
    );
  }
}

/**
 * Internal testable handler.
 *
 * Dependency injection is for
 * automated tests only.
 */
async function handleMigrationPreview(
  request,
  dependencies = {}
) {
  try {
    verifiedOwner(request);

    const db =
      dependencies.db || getFirestore();

    const preview =
      dependencies.preview ||
      authenticatedMigrationPreview;

    return await preview({
      db,
      request
    });
  } catch (error) {
    throw toCallableError(error);
  }
}

/**
 * Production handler.
 *
 * Authenticate first.
 * Reject client-supplied data.
 * Use the trusted Firestore database.
 */
async function productionMigrationPreview(
  request
) {
  try {
    verifiedOwner(request);

    validateRequestData(request);

    return await authenticatedMigrationPreview({
      db: getFirestore(),
      request
    });
  } catch (error) {
    throw toCallableError(error);
  }
}

/**
 * Prepared Firebase callable.
 *
 * App Check enforcement and
 * rate limiting require further work
 * before deployment.
 */
const migrationPreviewCallable = onCall(
  {
    region: "europe-west2",
    maxInstances: 2,
    timeoutSeconds: 30,
    memory: "256MiB",
    enforceAppCheck: false
  },
  productionMigrationPreview
);

module.exports = {
  migrationPreviewCallable,
  handleMigrationPreview,
  productionMigrationPreview,
  validateRequestData,
  toCallableError
};
