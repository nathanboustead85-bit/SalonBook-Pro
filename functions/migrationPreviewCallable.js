"use strict";

/**
 * BOUSTIO — PHASE 8D.20
 *
 * Secure, read-only Firebase
 * migration preview callable.
 *
 * NOT exported from index.js.
 * NOT ready for production deployment.
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
 * Translate internal errors into safe
 * client-facing Firebase errors.
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
 * Internal testable handler.
 *
 * Dependencies are injectable for
 * automated tests only.
 *
 * The production callable below never
 * accepts dependencies from request.data.
 */
async function handleMigrationPreview(
  request,
  dependencies = {}
) {
  try {
    // Authenticate before database access.
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
 * Production request handler.
 *
 * No caller-controlled dependencies.
 * Business identity comes exclusively
 * from trusted Firebase Authentication.
 */
async function productionMigrationPreview(
  request
) {
  try {
    // Validate before obtaining Firestore.
    verifiedOwner(request);

    return await authenticatedMigrationPreview({
      db: getFirestore(),
      request
    });
  } catch (error) {
    throw toCallableError(error);
  }
}

/**
 * Callable configuration.
 *
 * App Check must be configured and
 * tested before production release.
 *
 * maxInstances limits scaling but is
 * not a per-user rate limit.
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
  toCallableError
};
