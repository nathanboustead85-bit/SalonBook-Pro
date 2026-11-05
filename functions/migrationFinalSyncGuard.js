"use strict";

/**
 * BOUSTIO — PHASE 8D.75
 *
 * Final-sync guard for a Firestore transaction.
 *
 * BACKEND ONLY.
 *
 * No HTTP endpoint.
 * No production deployment.
 * No Firestore writes.
 *
 * Intended to run inside the same transaction
 * that performs Android booking migration.
 *
 * This verifies:
 * - The business is frozen.
 * - Migration has not already completed.
 * - The server booking source is valid.
 * - The source matches the expected hash.
 *
 * It does NOT prove that all Android devices
 * have finished syncing their local changes.
 */

const crypto = require("node:crypto");

const {
  MODES,
  MIGRATION_ID
} = require("./bookingMode");

const {
  digestBookings
} = require("./finalBookingSyncVerifier");

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;

function fail(message) {
  const error = new Error(message);
  error.code = "migration-final-sync-blocked";
  throw error;
}

function validateIdentifiers(
  businessId,
  authenticatedUid
) {
  if (
    typeof businessId !== "string" ||
    !ID_PATTERN.test(businessId) ||
    typeof authenticatedUid !== "string" ||
    !ID_PATTERN.test(authenticatedUid)
  ) {
    fail("Invalid business or owner identifier");
  }

  if (businessId !== authenticatedUid) {
    fail("Business ownership verification failed");
  }
}

function validateExpectedHash(expectedHash) {
  if (
    typeof expectedHash !== "string" ||
    !HASH_PATTERN.test(expectedHash)
  ) {
    fail("Invalid expected booking hash");
  }
}

function hashesMatch(actualHash, expectedHash) {
  return crypto.timingSafeEqual(
    Buffer.from(actualHash, "hex"),
    Buffer.from(expectedHash, "hex")
  );
}

/**
 * Call this BEFORE any transaction writes.
 *
 * The migration transaction must use the
 * returned source and must not independently
 * fetch a different booking source.
 *
 * The caller must obtain expectedHash from
 * an independently verified cutover process.
 * Never trust an arbitrary client-provided
 * hash as proof of completed device syncing.
 */
async function verifyMigrationFinalSync({
  transaction,
  db,
  businessId,
  authenticatedUid,
  expectedHash
}) {
  if (
    !transaction ||
    typeof transaction.get !== "function"
  ) {
    fail("Trusted Firestore transaction required");
  }

  if (
    !db ||
    typeof db.collection !== "function"
  ) {
    fail("Trusted Firestore database required");
  }

  validateIdentifiers(
    businessId,
    authenticatedUid
  );

  validateExpectedHash(expectedHash);

  const businessRef = db
    .collection("businesses")
    .doc(businessId);

  const modeRef = businessRef
    .collection("settings")
    .doc("bookingMode");

  const migrationRef = businessRef
    .collection("migrations")
    .doc(MIGRATION_ID);

  const sourceRef = db
    .collection("users")
    .doc(authenticatedUid)
    .collection("liveData")
    .doc("bookings");

  /*
   * All reads happen inside the supplied
   * Firestore transaction.
   *
   * The caller must complete its remaining
   * reads before performing any writes.
   */

  const modeSnapshot =
    await transaction.get(modeRef);

  const migrationSnapshot =
    await transaction.get(migrationRef);

  const sourceSnapshot =
    await transaction.get(sourceRef);

  if (migrationSnapshot.exists) {
    fail("Android bookings already migrated");
  }

  if (!modeSnapshot.exists) {
    fail("Booking mode is missing");
  }

  const mode = modeSnapshot.data()?.mode;

  if (mode !== MODES.FROZEN) {
    fail("Business must be frozen before migration");
  }

  if (!sourceSnapshot.exists) {
    fail("Android booking source is missing");
  }

  const source = sourceSnapshot.data();

  if (
    !source ||
    source.schemaVersion !== 1 ||
    typeof source.json !== "string"
  ) {
    fail("Unsupported Android booking source");
  }

  let actualHash;

  try {
    actualHash = digestBookings(source.json);
  } catch (_) {
    fail("Invalid Android booking source JSON");
  }

  if (!hashesMatch(actualHash, expectedHash)) {
    fail("Final booking snapshot mismatch");
  }

  return {
    verified: true,
    businessId,
    mode: MODES.FROZEN,
    source,
    sourceHash: actualHash,
    sourceUpdatedAt: source.updatedAt || null,
    sourceRef,
    migrationRef,
    modeRef,
    migrationAuthorised: false
  };
}

module.exports = {
  verifyMigrationFinalSync,
  validateIdentifiers,
  validateExpectedHash,
  hashesMatch
};
