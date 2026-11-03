"use strict";

/**
 * BOUSTIO — PHASE 8D.17
 *
 * Authenticated Firebase callable
 * migration preview.
 *
 * Read-only.
 *
 * NOT exported from index.js yet.
 * Do not deploy until security and
 * integration tests are complete.
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
  MigrationAuthError
} = require("./authenticatedMigrationPreview");

/**
 * Convert internal errors to safe
 * Firebase callable error responses.
 *
 * Do not expose Firestore paths,
 * customer data or stack traces.
 */
function toCallableError(error) {
  if (error instanceof HttpsError) {
    return error;
  }

  if (error instanceof MigrationAuthError) {
    const allowedCodes = [
      "unauthenticated",
      "permission-denied",
      "unavailable"
    ];

    const code = allowedCodes.includes(
      error.code
    )
      ? error.code
      : "internal";

    return new HttpsError(
      code,
      error.message
    );
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
 * Callable request handler.
 *
 * Firebase Authentication supplies
 * request.auth.
 *
 * The client cannot choose which
 * business's records are read.
 */
async function handleMigrationPreview(
  request,
  dependencies = {}
) {
  try {
    const db = dependencies.db ||
      getFirestore();

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
 * Firebase callable definition.
 *
 * Kept separate from index.js until
 * deployment has been authorised.
 *
 * App Check enforcement can be enabled
 * after client integration is ready.
 */
const migrationPreviewCallable = onCall(
  {
    region: "europe-west2",
    maxInstances: 2,
    timeoutSeconds: 30,
    memory: "256MiB",
    enforceAppCheck: false
  },
  async request => {
    return handleMigrationPreview(request);
  }
);

module.exports = {
  migrationPreviewCallable,
  handleMigrationPreview,
  toCallableError
};
