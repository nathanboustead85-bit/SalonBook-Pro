"use strict";

/**
 * BOUSTIO — PHASE 8D.11
 *
 * Secure, read-only Firestore migration preview.
 *
 * Backend-only module.
 *
 * This module:
 * - Reads Android cloud bookings
 * - Reads existing server appointments
 * - Reads existing server booking locks
 * - Runs migration safety validation
 *
 * It does NOT:
 * - Write to Firestore
 * - Import appointments
 * - Create booking locks
 * - Enable public bookings
 * - Expose a public HTTP endpoint
 */

const {
  validateMigration
} = require("./bookingMigrationValidator");

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

function fail(message) {
  const error = new Error(message);
  error.code = "migration-preview-error";
  throw error;
}

function validId(value) {
  return (
    typeof value === "string" &&
    ID_PATTERN.test(value)
  );
}

/**
 * Caller must authenticate the Firebase user
 * and pass the verified UID.
 *
 * The business identifier is the owner's UID,
 * not the public business slug.
 */
async function previewFirestoreMigration({
  db,
  businessId,
  authenticatedUid
}) {
  if (
    !db ||
    typeof db.collection !== "function"
  ) {
    fail("Firestore database is unavailable.");
  }

  if (
    !validId(businessId) ||
    !validId(authenticatedUid)
  ) {
    fail("Invalid business or user identifier.");
  }

  if (businessId !== authenticatedUid) {
    fail("Business ownership verification failed.");
  }

  const bookingsRef = db
    .collection("users")
    .doc(authenticatedUid)
    .collection("liveData")
    .doc("bookings");

  const businessRef = db
    .collection("businesses")
    .doc(businessId);

  const appointmentsRef = businessRef
    .collection("appointments");

  const locksRef = businessRef
    .collection("bookingLocks");

  /*
   * All three reads must succeed.
   * A failed read must never be treated
   * as an empty collection.
   */
  let bookingsSnapshot;
  let appointmentsSnapshot;
  let locksSnapshot;

  try {
    [
      bookingsSnapshot,
      appointmentsSnapshot,
      locksSnapshot
    ] = await Promise.all([
      bookingsRef.get(),
      appointmentsRef.get(),
      locksRef.get()
    ]);
  } catch (_) {
    fail(
      "Unable to read all Firestore booking " +
      "records. Migration preview blocked."
    );
  }

  if (!bookingsSnapshot.exists) {
    fail(
      "Android cloud booking document is " +
      "missing. Cannot confirm source data."
    );
  }

  const source = bookingsSnapshot.data();

  if (
    !source ||
    source.schemaVersion !== 1 ||
    typeof source.json !== "string"
  ) {
    fail(
      "Android cloud booking document " +
      "has an unsupported format."
    );
  }

  const existingAppointments = [];
  const existingLocks = [];

  appointmentsSnapshot.forEach(doc => {
    existingAppointments.push({
      id: doc.id
    });
  });

  locksSnapshot.forEach(doc => {
    existingLocks.push({
      lockId: doc.id
    });
  });

  const report = validateMigration({
    businessId,
    bookingsJson: source.json,
    existingAppointments,
    existingLocks
  });

  return {
    ...report,
    source: "firestore",
    readOnly: true,
    sourceUpdatedAt:
      source.updatedAt || null,
    warning:
      "READ-ONLY FIRESTORE PREVIEW. " +
      "No records were changed. " +
      "The supplied authenticated UID " +
      "must come from trusted Firebase " +
      "authentication, never client input. " +
      "This preview does not reserve " +
      "booking slots or guarantee that " +
      "the database remains unchanged. " +
      "A future migration must recheck " +
      "conflicts inside authenticated " +
      "server-side transactions."
  };
}

module.exports = {
  previewFirestoreMigration
};
