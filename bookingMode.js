"use strict";

/**
 * BOUSTIO — PHASE 8D.66
 *
 * Server-controlled booking-mode setup.
 *
 * This module is NOT a deployed Cloud
 * Function and exposes no public endpoint.
 *
 * It only initialises the legacy mode.
 * It cannot reset frozen/cloud businesses
 * back to legacy.
 */

const MODES = Object.freeze({
  LEGACY: "legacy",
  FROZEN: "frozen",
  CLOUD: "cloud"
});

const MIGRATION_ID = "android-bookings-v1";

function fail(message) {
  const error = new Error(message);
  error.code = "booking-mode-blocked";
  return error;
}

function requireBusinessId(businessId) {
  if (
    typeof businessId !== "string" ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(businessId)
  ) {
    throw fail("Invalid business ID");
  }
}

function requireDatabase(db) {
  if (
    !db ||
    typeof db.collection !== "function" ||
    typeof db.runTransaction !== "function"
  ) {
    throw fail("A trusted Firestore database is required");
  }
}

/**
 * Read booking mode using trusted backend access.
 *
 * Missing or invalid modes are never
 * treated as legacy automatically.
 */
async function readBookingMode(db, businessId) {
  requireDatabase(db);
  requireBusinessId(businessId);

  const ref = db
    .collection("businesses")
    .doc(businessId)
    .collection("settings")
    .doc("bookingMode");

  const snapshot = await ref.get();

  if (!snapshot.exists) {
    return null;
  }

  const mode = snapshot.data()?.mode;

  if (!Object.values(MODES).includes(mode)) {
    throw fail("Unknown booking mode");
  }

  return mode;
}

/**
 * Initialise a business in legacy mode.
 *
 * SAFETY:
 * - Never overwrite an existing mode.
 * - Never initialise after migration.
 * - Read marker and mode in one transaction.
 * - Do not expose this as an unauthenticated
 *   or owner-controlled Cloud Function.
 *
 * A separate trusted cutover process will
 * eventually manage frozen/cloud states.
 */
async function initialiseLegacyMode(
  db,
  businessId
) {
  requireDatabase(db);
  requireBusinessId(businessId);

  const businessRef = db
    .collection("businesses")
    .doc(businessId);

  const modeRef = businessRef
    .collection("settings")
    .doc("bookingMode");

  const migrationRef = businessRef
    .collection("migrations")
    .doc(MIGRATION_ID);

  return db.runTransaction(async transaction => {

    const modeSnapshot =
      await transaction.get(modeRef);

    const migrationSnapshot =
      await transaction.get(migrationRef);

    if (migrationSnapshot.exists) {
      throw fail(
        "Cannot initialise legacy mode " +
        "after migration"
      );
    }

    if (modeSnapshot.exists) {
      const existing =
        modeSnapshot.data()?.mode;

      if (!Object.values(MODES).includes(existing)) {
        throw fail("Existing booking mode is invalid");
      }

      return {
        mode: existing,
        created: false
      };
    }

    transaction.create(modeRef, {
      mode: MODES.LEGACY,
      schemaVersion: 1,
      updatedAt: new Date()
    });

    return {
      mode: MODES.LEGACY,
      created: true
    };
  });
}

module.exports = {
  MODES,
  MIGRATION_ID,
  readBookingMode,
  initialiseLegacyMode
};
