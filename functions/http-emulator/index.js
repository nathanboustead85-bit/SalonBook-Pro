"use strict";

/**
 * BOUSTIO — PHASE 8D.35
 *
 * Isolated Firebase callable HTTP
 * integration test entry point.
 *
 * Emulator only. Never deploy.
 */

const PROJECT_ID =
  "demo-boustio-migration";

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
 * Load Firebase Admin from the parent
 * functions/node_modules directory.
 *
 * This uses the same Admin SDK instance
 * as migrationPreviewCallable.js.
 *
 * The previous path was missing one
 * directory level.
 */
const {
  initializeApp,
  getApps
} = require(
  "../../functions/node_modules/firebase-admin/app"
);

/**
 * Initialise the shared Admin SDK
 * against the isolated test project.
 */
if (!getApps().length) {
  initializeApp({
    projectId: PROJECT_ID
  });
}

/**
 * Expose only the read-only migration
 * preview callable to the emulator.
 */
const {
  migrationPreviewCallable
} = require(
  "../migrationPreviewCallable"
);

exports.migrationPreviewCallable =
  migrationPreviewCallable;
