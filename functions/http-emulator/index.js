"use strict";

/**
 * BOUSTIO — PHASE 8D.36
 *
 * Isolated Firebase callable HTTP
 * emulator entry point.
 *
 * TESTING ONLY — NEVER DEPLOY.
 */

const {
  createRequire
} = require("node:module");

const path = require("node:path");

const PROJECT_ID =
  "demo-boustio-migration";

/**
 * Only allow the dedicated local
 * Firebase Emulator environment.
 */
function verifyEmulatorEnvironment() {
  const project =
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT;

  const firestoreHost =
    process.env.FIRESTORE_EMULATOR_HOST;

  if (project !== PROJECT_ID) {
    throw new Error(
      "Safety stop: incorrect Firebase project."
    );
  }

  if (
    !firestoreHost ||
    !/^(localhost|127\.0\.0\.1):[0-9]+$/.test(
      firestoreHost
    )
  ) {
    throw new Error(
      "Safety stop: local Firestore " +
      "Emulator is required."
    );
  }

  if (
    process.env.FUNCTIONS_EMULATOR !==
    "true"
  ) {
    throw new Error(
      "Safety stop: Functions Emulator " +
      "is required."
    );
  }
}

verifyEmulatorEnvironment();

/**
 * Resolve Firebase Admin exactly as
 * modules inside the parent functions
 * directory resolve it.
 *
 * This avoids loading a separate
 * Firebase Admin instance from the
 * http-emulator dependencies.
 */
const parentRequire = createRequire(
  path.join(__dirname, "..", "index.js")
);

const {
  initializeApp,
  getApps
} = parentRequire("firebase-admin/app");

/**
 * Initialise the shared Admin SDK.
 */
if (!getApps().length) {
  initializeApp({
    projectId: PROJECT_ID
  });
}

/**
 * Export only the existing read-only
 * migration preview callable.
 */
const {
  migrationPreviewCallable
} = parentRequire(
  "./migrationPreviewCallable"
);

exports.migrationPreviewCallable =
  migrationPreviewCallable;
