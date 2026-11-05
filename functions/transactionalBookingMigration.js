"use strict";

/**
 * BOUSTIO — PHASE 8D.56
 *
 * Transactional Android Booking Migration
 *
 * BACKEND ONLY.
 *
 * NOT a callable function.
 * NOT a public HTTP endpoint.
 * NOT exported from functions/index.js.
 *
 * No operation occurs until this function
 * is explicitly invoked by trusted backend
 * code with a Firestore database instance.
 *
 * IMPORTANT:
 * Must pass emulator integration tests
 * before any production use.
 */

const {
  FieldValue
} = require("firebase-admin/firestore");

const {
  makeMigrationPlan
} = require("./bookingMigrationPlan");

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

// Conservative limit below Firestore's
// 500-write transaction limit.
const MAX_TRANSACTION_WRITES = 450;

const MIGRATION_ID = "android-bookings-v1";

function fail(message, code = "migration-blocked") {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function validId(value) {
  return (
    typeof value === "string" &&
    ID_PATTERN.test(value)
  );
}

function verifyOwner(businessId, authenticatedUid) {
  if (
    !validId(businessId) ||
    !validId(authenticatedUid)
  ) {
    fail("Invalid business or owner identifier.");
  }

  if (businessId !== authenticatedUid) {
    fail("Business ownership verification failed.");
  }
}

function verifySource(snapshot) {
  if (!snapshot.exists) {
    fail("Android booking backup is missing.");
  }

  const data = snapshot.data();

  if (
    !data ||
    data.schemaVersion !== 1 ||
    typeof data.json !== "string"
  ) {
    fail("Unsupported Android booking data.");
  }

  return data;
}

function validatePlan(plan) {
  if (
    !plan ||
    plan.safeToMigrate !== true
  ) {
    fail("Migration contains invalid or overlapping bookings.");
  }

  if (
    plan.sourceCount === 0 ||
    plan.appointmentCount !== plan.sourceCount
  ) {
    fail("Migration source is empty or incomplete.");
  }

  const writes =
    plan.appointments.length +
    plan.locks.length +
    1;

  if (writes > MAX_TRANSACTION_WRITES) {
    fail(
      "Migration exceeds the safe transaction size. " +
      "A separate batching strategy is required."
    );
  }

  const appointmentIds = new Set();
  const lockIds = new Set();

  for (const appointment of plan.appointments) {
    if (
      !appointment ||
      !validId(appointment.id) ||
      appointmentIds.has(appointment.id)
    ) {
      fail("Invalid or duplicate appointment identifier.");
    }

    appointmentIds.add(appointment.id);
  }

  for (const lock of plan.locks) {
    if (
      !lock ||
      typeof lock.lockId !== "string" ||
      lock.lockId.length > 150 ||
      lock.lockId.includes("/") ||
      !appointmentIds.has(lock.appointmentId) ||
      lockIds.has(lock.lockId)
    ) {
      fail("Invalid or duplicate booking lock.");
    }

    lockIds.add(lock.lockId);
  }

  return writes;
}

/**
 * Explicit trusted-server migration.
 *
 * Preconditions:
 * - authenticatedUid must be supplied by
 *   verified server-side authentication
 * - caller must independently verify
 *   email verification and authorisation
 * - businessId is the owner's Firebase UID
 * - existing online booking writes must
 *   remain disabled during migration
 *
 * Transaction reads:
 * - Migration completion marker
 * - Android liveData booking source
 * - Every proposed appointment document
 * - Every proposed booking lock
 *
 * All reads happen before writes.
 *
 * Any detected conflict aborts the entire
 * Firestore transaction.
 */
async function migrateAndroidBookings({
  db,
  businessId,
  authenticatedUid
}) {
  if (
    !db ||
    typeof db.runTransaction !== "function" ||
    typeof db.collection !== "function"
  ) {
    fail("Firestore database is unavailable.");
  }

  verifyOwner(businessId, authenticatedUid);

  const businessRef = db
    .collection("businesses")
    .doc(businessId);

  const sourceRef = db
    .collection("users")
    .doc(authenticatedUid)
    .collection("liveData")
    .doc("bookings");

  const migrationRef = businessRef
    .collection("migrations")
    .doc(MIGRATION_ID);

  return db.runTransaction(async transaction => {
    // READ 1: Migration marker.
    const migrationSnapshot =
      await transaction.get(migrationRef);

    if (migrationSnapshot.exists) {
      fail(
        "Android bookings have already been migrated.",
        "already-migrated"
      );
    }

    // READ 2: Current Android source.
    // This is read inside the transaction to
    // protect against concurrent source edits.
    const sourceSnapshot =
      await transaction.get(sourceRef);

    const source = verifySource(sourceSnapshot);

    // Build the plan from the transactional
    // source snapshot, not an earlier preview.
    const plan = makeMigrationPlan({
      businessId,
      bookingsJson: source.json
    });

    const writeCount = validatePlan(plan);

    const appointmentRefs =
      plan.appointments.map(appointment =>
        businessRef
          .collection("appointments")
          .doc(appointment.id)
      );

    const lockRefs =
      plan.locks.map(lock =>
        businessRef
          .collection("bookingLocks")
          .doc(lock.lockId)
      );

    // READ 3: Existing appointment IDs.
    // READ 4: Existing lock IDs.
    //
    // Firestore transaction reads must
    // complete before any write.
    const appointmentSnapshots = [];

    for (const ref of appointmentRefs) {
      appointmentSnapshots.push(
        await transaction.get(ref)
      );
    }

    const lockSnapshots = [];

    for (const ref of lockRefs) {
      lockSnapshots.push(
        await transaction.get(ref)
      );
    }

    if (
      appointmentSnapshots.some(
        snapshot => snapshot.exists
      )
    ) {
      fail(
        "An appointment already exists on the server."
      );
    }

    if (
      lockSnapshots.some(
        snapshot => snapshot.exists
      )
    ) {
      fail(
        "One or more booking slots are already occupied."
      );
    }

    // WRITE: Appointment records.
    for (
      let i = 0;
      i < plan.appointments.length;
      i++
    ) {
      const appointment = plan.appointments[i];

      transaction.create(
        appointmentRefs[i],
        {
          ...appointment,
          customerName: appointment.clientName,
          schemaVersion: 1,
          migrationId: MIGRATION_ID,
          source: "android",
          status: "confirmed",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        }
      );
    }

    // WRITE: Booking locks.
    for (
      let i = 0;
      i < plan.locks.length;
      i++
    ) {
      const lock = plan.locks[i];

      transaction.create(
        lockRefs[i],
        {
          ...lock,
          migrationId: MIGRATION_ID,
          createdAt: FieldValue.serverTimestamp()
        }
      );
    }

    // WRITE: Completion marker.
    // This is created in the same transaction
    // as the appointments and booking locks.
    transaction.create(
      migrationRef,
      {
        businessId,
        migrationId: MIGRATION_ID,
        schemaVersion: 1,
        status: "completed",
        sourceCount: plan.sourceCount,
        appointmentCount: plan.appointmentCount,
        lockCount: plan.lockCount,
        writeCount,
        completedAt: FieldValue.serverTimestamp()
      }
    );

    return {
      success: true,
      migrationId: MIGRATION_ID,
      businessId,
      appointmentCount: plan.appointmentCount,
      lockCount: plan.lockCount,
      status: "completed"
    };
  });
}

module.exports = {
  migrateAndroidBookings,
  validatePlan,
  verifyOwner,
  verifySource,
  MIGRATION_ID,
  MAX_TRANSACTION_WRITES
};
