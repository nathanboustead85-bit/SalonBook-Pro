"use strict";

/**
 * BOUSTIO — PHASE 8D.14
 *
 * Authenticated, read-only migration
 * preview handler.
 *
 * Backend-only. Not exported as a
 * Firebase Cloud Function yet.
 */

const {
  previewFirestoreMigration
} = require("./firestoreMigrationPreview");

class MigrationAuthError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MigrationAuthError";
    this.code = code;
  }
}

function verifiedOwner(request) {
  const auth = request && request.auth;

  if (
    !auth ||
    typeof auth.uid !== "string" ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(auth.uid)
  ) {
    throw new MigrationAuthError(
      "unauthenticated",
      "Sign in to your business account."
    );
  }

  if (
    !auth.token ||
    auth.token.email_verified !== true
  ) {
    throw new MigrationAuthError(
      "permission-denied",
      "Verify your email before continuing."
    );
  }

  return auth.uid;
}

/**
 * The business ID always comes from
 * trusted Firebase Authentication.
 *
 * Client-supplied business IDs and
 * customer-supplied booking data
 * are never used.
 */
async function authenticatedMigrationPreview({
  db,
  request,
  preview = previewFirestoreMigration
}) {
  const uid = verifiedOwner(request);

  if (
    !db ||
    typeof db.collection !== "function"
  ) {
    throw new MigrationAuthError(
      "unavailable",
      "Firestore is currently unavailable."
    );
  }

  const report = await preview({
    db,
    businessId: uid,
    authenticatedUid: uid
  });

  /*
   * Return only summary information.
   *
   * Customer names, appointment details,
   * and individual booking locks are
   * deliberately excluded.
   */
  return {
    success: true,
    businessId: uid,
    readOnly: true,
    status: report.status,
    safeToMigrate: report.safeToMigrate,
    sourceCount: report.sourceCount,
    proposedAppointmentCount:
      report.proposedAppointmentCount,
    proposedLockCount:
      report.proposedLockCount,
    existingAppointmentCount:
      report.existingAppointmentCount,
    existingLockCount:
      report.existingLockCount,
    problemCount: report.problemCount,
    warning:
      "Read-only preview. No appointments " +
      "or booking locks have been changed. " +
      "A passing preview does not authorise " +
      "a live migration."
  };
}

module.exports = {
  MigrationAuthError,
  verifiedOwner,
  authenticatedMigrationPreview
};
