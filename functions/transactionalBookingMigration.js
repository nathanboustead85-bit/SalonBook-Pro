"use strict";

/**
 * BOUSTIO — PHASE 8D.78
 *
 * Verified transactional Android booking migration.
 *
 * BACKEND ONLY — NOT A CLOUD FUNCTION.
 * NOT FOR PRODUCTION DEPLOYMENT.
 *
 * The unverified migration route has been removed.
 * All migrations require:
 * - Matching authenticated business owner
 * - Valid expected final source hash
 * - Frozen booking mode
 * - No previous migration marker
 * - Matching Firestore source snapshot
 * - Valid appointments and booking locks
 * - No existing appointment conflicts
 *
 * All reads and writes occur within one
 * Firestore transaction.
 */

const {
  FieldValue
} = require("firebase-admin/firestore");

const {
  makeMigrationPlan
} = require("./bookingMigrationPlan");

const {
  verifyMigrationFinalSync
} = require("./migrationFinalSyncGuard");

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;

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
  if (!plan || plan.safeToMigrate !== true) {
    fail(
      "Migration contains invalid or overlapping bookings."
    );
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
      fail(
        "Invalid or duplicate appointment identifier."
      );
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

function timeToMinutes(value) {
  if (
    typeof value !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(value)
  ) {
    return null;
  }

  const [hours, minutes] =
    value.split(":").map(Number);

  return hours * 60 + minutes;
}

function appointmentRange(appointment) {
  if (
    !appointment ||
    !validId(appointment.staffId) ||
    typeof appointment.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(appointment.date)
  ) {
    return null;
  }

  const start = timeToMinutes(
    appointment.startTime
  );

  let end = timeToMinutes(
    appointment.endTime
  );

  if (
    end === null &&
    Number.isInteger(
      appointment.durationMinutes
    ) &&
    start !== null
  ) {
    end = start + appointment.durationMinutes;
  }

  if (
    start === null ||
    end === null ||
    start >= end ||
    end > 1440
  ) {
    return null;
  }

  return {
    staffId: appointment.staffId,
    date: appointment.date,
    start,
    end
  };
}

function checkLegacyConflicts(
  incomingAppointments,
  existingDocuments
) {
  const incomingRanges =
    incomingAppointments.map(appointment => {
      const range = appointmentRange(appointment);

      if (!range) {
        fail(
          "Incoming appointment has an invalid time range."
        );
      }

      return range;
    });

  for (const existingDoc of existingDocuments) {
    const existing = existingDoc.data();

    if (existing.status === "cancelled") {
      continue;
    }

    const range = appointmentRange(existing);

    if (!range) {
      fail(
        "Existing server appointment has " +
        "an invalid time range."
      );
    }

    for (const incoming of incomingRanges) {
      if (
        range.staffId === incoming.staffId &&
        range.date === incoming.date &&
        range.start < incoming.end &&
        incoming.start < range.end
      ) {
        fail(
          "Migration blocked: overlapping " +
          "legacy server appointment."
        );
      }
    }
  }
}

function requireDatabase(db) {
  if (
    !db ||
    typeof db.runTransaction !== "function" ||
    typeof db.collection !== "function"
  ) {
    fail("Firestore database is unavailable.");
  }
}

/**
 * The only migration entry point.
 *
 * expectedHash must come from a trusted,
 * independently confirmed final snapshot.
 *
 * Never accept an arbitrary client hash
 * as proof of completed device syncing.
 */
async function migrateVerifiedAndroidBookings({
  db,
  businessId,
  authenticatedUid,
  expectedHash
}) {
  requireDatabase(db);
  verifyOwner(businessId, authenticatedUid);

  if (
    typeof expectedHash !== "string" ||
    !HASH_PATTERN.test(expectedHash)
  ) {
    fail("A valid final booking hash is required.");
  }

  const businessRef = db
    .collection("businesses")
    .doc(businessId);

  const migrationRef = businessRef
    .collection("migrations")
    .doc(MIGRATION_ID);

  return db.runTransaction(async transaction => {
    /*
     * Verify frozen mode, migration marker
     * and source hash inside this transaction.
     *
     * No writes before all validation
     * and conflict reads are complete.
     */

    const verification =
      await verifyMigrationFinalSync({
        transaction,
        db,
        businessId,
        authenticatedUid,
        expectedHash
      });

    const source = verification.source;
    const sourceHash = verification.sourceHash;

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

    const appointmentSnapshots = [];

    for (const ref of appointmentRefs) {
      appointmentSnapshots.push(
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

    const lockSnapshots = [];

    for (const ref of lockRefs) {
      lockSnapshots.push(
        await transaction.get(ref)
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

    const existingAppointments =
      await transaction.get(
        businessRef.collection("appointments")
      );

    checkLegacyConflicts(
      plan.appointments,
      existingAppointments.docs
    );

    /*
     * ALL TRANSACTION READS COMPLETE.
     * Begin atomic writes.
     */

    for (
      let i = 0;
      i < plan.appointments.length;
      i++
    ) {
      const appointment =
        plan.appointments[i];

      transaction.create(
        appointmentRefs[i],
        {
          ...appointment,
          customerName:
            appointment.clientName,
          schemaVersion: 1,
          migrationId: MIGRATION_ID,
          source: "android",
          status: "confirmed",
          createdAt:
            FieldValue.serverTimestamp(),
          updatedAt:
            FieldValue.serverTimestamp()
        }
      );
    }

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
          createdAt:
            FieldValue.serverTimestamp()
        }
      );
    }

    transaction.create(
      migrationRef,
      {
        businessId,
        migrationId: MIGRATION_ID,
        schemaVersion: 1,
        status: "completed",
        sourceCount: plan.sourceCount,
        appointmentCount:
          plan.appointmentCount,
        lockCount: plan.lockCount,
        writeCount,
        verifiedFinalSync: true,
        sourceHash,
        completedAt:
          FieldValue.serverTimestamp()
      }
    );

    return {
      success: true,
      migrationId: MIGRATION_ID,
      businessId,
      appointmentCount:
        plan.appointmentCount,
      lockCount: plan.lockCount,
      status: "completed",
      verifiedFinalSync: true,
      sourceHash
    };
  });
}

module.exports = {
  migrateVerifiedAndroidBookings,
  validatePlan,
  verifyOwner,
  verifySource,
  MIGRATION_ID,
  MAX_TRANSACTION_WRITES
};
