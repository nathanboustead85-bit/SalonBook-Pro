"use strict";

/**
 * BOUSTIO — PHASE 8D.34
 *
 * Isolated HTTP Emulator entry point.
 *
 * IMPORTANT:
 * This file is for emulator testing only.
 * It must never be deployed to production.
 */

const PROJECT_ID =
  "demo-boustio-migration";

/**
 * Verify this is our isolated
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
 * IMPORTANT FIX:
 *
 * Load Firebase Admin from the parent
 * functions directory.
 *
 * migrationPreviewCallable.js also loads
 * Firebase Admin from that directory.
 *
 * This ensures both modules use the
 * same Firebase Admin app registry.
 */
const {
  initializeApp,
  getApps
} = require("../node_modules/firebase-admin/app");

/**
 * Initialise the shared Firebase
 * Admin instance.
 */
if (!getApps().length) {
  initializeApp({
    projectId: PROJECT_ID
  });
}

/**
 * Load the existing read-only
 * migration preview callable.
 *
 * No booking creation or migration
 * execution is exposed.
 */
const {
  migrationPreviewCallable
} = require(
  "../migrationPreviewCallable"
);

exports.migrationPreviewCallable =
  migrationPreviewCallable;
