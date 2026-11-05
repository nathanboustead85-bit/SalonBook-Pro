"use strict";

/**
 * BOUSTIO — PHASE 8D.70
 *
 * Trusted booking freeze manager.
 *
 * BACKEND ONLY.
 *
 * Not exported from functions/index.js.
 * Not callable by Android clients.
 * Not connected to production.
 */

const {
  MODES,
  MIGRATION_ID
} = require("./bookingMode");

const ID_PATTERN =
  /^[A-Za-z0-9_-]{1,100}$/;

function blocked(message) {
  const error = new Error(message);
  error.code = "booking-freeze-blocked";
  return error;
}

function validateDatabase(db) {
  if (
    !db ||
    typeof db.collection !== "function" ||
    typeof db.runTransaction !== "function"
  ) {
    throw blocked(
      "Trusted Firestore database required"
    );
  }
}

function validateBusinessId(businessId) {
  if (
    typeof businessId !== "string" ||
    !ID_PATTERN.test(businessId)
  ) {
    throw blocked("Invalid business ID");
  }
}

/**
 * Freeze an existing legacy business.
 *
 * Requirements:
 *
 * 1. Mode document must exist.
 * 2. Current mode must be legacy.
 * 3. Migration must not be completed.
 * 4. Transition must use a transaction.
 *
 * This does not migrate appointments.
 * This does not activate cloud bookings.
 */
async function freezeBookingMode(
  db,
  businessId
) {
  validateDatabase(db);
  validateBusinessId(businessId);

  const businessRef = db
    .collection("businesses")
    .doc(businessId);

  const modeRef = businessRef
    .collection("settings")
    .doc("bookingMode");

  const migrationRef = businessRef
    .collection("migrations")
    .doc(MIGRATION_ID);

  return db.runTransaction(
    async transaction => {

      // All reads before writes.

      const modeSnapshot =
        await transaction.get(modeRef);

      const migrationSnapshot =
        await transaction.get(migrationRef);

      if (migrationSnapshot.exists) {
        throw blocked(
          "Business already migrated"
        );
      }

      if (!modeSnapshot.exists) {
        throw blocked(
          "Booking mode not initialised"
        );
      }

      const currentMode =
        modeSnapshot.data()?.mode;

      if (currentMode === MODES.FROZEN) {
        return {
          success: true,
          mode: MODES.FROZEN,
          changed: false
        };
      }

      if (currentMode !== MODES.LEGACY) {
        throw blocked(
          "Only legacy mode can be frozen"
        );
      }

      transaction.update(modeRef, {
        mode: MODES.FROZEN,
        schemaVersion: 1,
        updatedAt: new Date()
      });

      return {
        success: true,
        mode: MODES.FROZEN,
        changed: true
      };
    }
  );
}

module.exports = {
  freezeBookingMode,
  validateBusinessId,
  validateDatabase
};
