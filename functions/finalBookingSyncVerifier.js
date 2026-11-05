"use strict";

/**
 * BOUSTIO — PHASE 8D.74
 *
 * Trusted, read-only final booking sync verifier.
 *
 * BACKEND ONLY.
 * No production deployment.
 * No migration or booking writes.
 *
 * The caller must supply an expected SHA-256
 * digest from an independently confirmed
 * final Android booking snapshot.
 *
 * A matching digest does not prove that all
 * devices have uploaded their local changes.
 */

const crypto = require("node:crypto");

const {
  MODES,
  MIGRATION_ID
} = require("./bookingMode");

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;

function blocked(message) {
  const error = new Error(message);
  error.code = "final-sync-blocked";
  return error;
}

function digestBookings(json) {
  if (typeof json !== "string") {
    throw blocked("Booking JSON must be a string");
  }

  try {
    const parsed = JSON.parse(json);

    if (!Array.isArray(parsed)) {
      throw new Error("Not an array");
    }
  } catch (_) {
    throw blocked("Invalid booking JSON array");
  }

  return crypto
    .createHash("sha256")
    .update(json, "utf8")
    .digest("hex");
}

function validateInput({
  db,
  businessId,
  authenticatedUid,
  expectedHash
}) {
  if (
    !db ||
    typeof db.collection !== "function"
  ) {
    throw blocked("Trusted Firestore required");
  }

  if (
    typeof businessId !== "string" ||
    !ID_PATTERN.test(businessId) ||
    typeof authenticatedUid !== "string" ||
    !ID_PATTERN.test(authenticatedUid)
  ) {
    throw blocked("Invalid business or owner ID");
  }

  if (businessId !== authenticatedUid) {
    throw blocked("Business ownership mismatch");
  }

  if (
    typeof expectedHash !== "string" ||
    !HASH_PATTERN.test(expectedHash)
  ) {
    throw blocked("Invalid expected booking hash");
  }
}

/**
 * Verify the current cloud booking document.
 *
 * Requires frozen mode to prevent further
 * legacy booking writes through security rules.
 *
 * Does not certify all Android devices synced.
 * Does not issue migration authorisation.
 */
async function verifyFinalBookingSync({
  db,
  businessId,
  authenticatedUid,
  expectedHash
}) {
  validateInput({
    db,
    businessId,
    authenticatedUid,
    expectedHash
  });

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

  let modeSnapshot;
  let migrationSnapshot;
  let sourceSnapshot;

  try {
    [
      modeSnapshot,
      migrationSnapshot,
      sourceSnapshot
    ] = await Promise.all([
      modeRef.get(),
      migrationRef.get(),
      sourceRef.get()
    ]);
  } catch (_) {
    throw blocked(
      "Unable to verify Firestore booking data"
    );
  }

  if (migrationSnapshot.exists) {
    throw blocked(
      "Business already migrated"
    );
  }

  if (
    !modeSnapshot.exists ||
    modeSnapshot.data()?.mode !== MODES.FROZEN
  ) {
    throw blocked(
      "Business must be frozen before final sync"
    );
  }

  if (!sourceSnapshot.exists) {
    throw blocked(
      "Cloud booking document is missing"
    );
  }

  const source = sourceSnapshot.data();

  if (
    !source ||
    source.schemaVersion !== 1 ||
    typeof source.json !== "string"
  ) {
    throw blocked(
      "Unsupported cloud booking data"
    );
  }

  const actualHash = digestBookings(source.json);

  const matches = crypto.timingSafeEqual(
    Buffer.from(actualHash, "hex"),
    Buffer.from(expectedHash, "hex")
  );

  if (!matches) {
    throw blocked(
      "Final booking data does not match"
    );
  }

  return {
    verified: true,
    businessId,
    mode: MODES.FROZEN,
    sourceHash: actualHash,
    sourceUpdatedAt: source.updatedAt || null,
    schemaVersion: 1,
    readOnly: true,
    migrationAuthorised: false
  };
}

module.exports = {
  digestBookings,
  validateInput,
  verifyFinalBookingSync
};
