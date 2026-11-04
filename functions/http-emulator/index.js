"use strict";

/**
 * BOUSTIO — PHASE 8D.29
 *
 * ISOLATED FIREBASE FUNCTIONS
 * EMULATOR ENTRY POINT.
 *
 * This file is exclusively for
 * local HTTP integration testing.
 *
 * It is NOT the production entry point.
 * Never deploy this test source.
 */

const {
  initializeApp,
  getApps
} = require("firebase-admin/app");

const PROJECT_ID =
  "demo-boustio-migration";

/**
 * Fail closed unless running inside
 * the dedicated Firebase Emulator
 * environment.
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
 * Initialise Admin SDK against the
 * dedicated emulator project.
 */
if (!getApps().length) {
  initializeApp({
    projectId: PROJECT_ID
  });
}

/**
 * Export only the read-only callable
 * for isolated HTTP testing.
 *
 * Do not add booking creation,
 * migration execution or payment
 * functions to this entry point.
 */
const {
  migrationPreviewCallable
} = require(
  "../migrationPreviewCallable"
);

exports.migrationPreviewCallable =
  migrationPreviewCallable;
