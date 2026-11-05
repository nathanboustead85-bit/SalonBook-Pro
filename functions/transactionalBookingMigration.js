"use strict";

/**
 * BOUSTIO — PHASE 8D.57
 *
 * Transactional Android Booking Migration
 * with legacy appointment conflict protection.
 *
 * BACKEND ONLY.
 * Not a callable or HTTP endpoint.
 * Not exported from functions/index.js.
 *
 * Do not deploy or use with real customers
 * until further security and concurrency
 * testing has been completed.
 */

const {
  FieldValue
} = require("firebase-admin/firestore");

const {
  makeMigrationPlan
} = require("./bookingMigrationPlan");

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

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
    end =
      start + appointment.durationMinutes;
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
      const range =
        appointmentRange(appointment);

      if (!range) {
        fail(
          "Incoming appointment has an invalid time range."
        );
      }

      return range;
    });

  for (const existingDoc of existingDocuments) {
    const existing = existingDoc.data();

    // Cancelled appointments do not
    // reserve a booking time.
    if (existing.status === "cancelled") {
      continue;
    }

    const range = appointmentRange(existing);

    // If an existing appointment cannot
    // be understood safely, stop rather
    // than risk creating a double booking.
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
    // All reads must precede all writes.

    const migrationSnapshot =
      await transaction.get(migrationRef);

    if (migrationSnapshot.exists) {
      fail(
        "Android bookings have already been migrated.",
        "already-migrated"
      );
    }

    // Reading the source inside the
    // transaction protects against
    // concurrent source modifications
    // during this transaction.
    const sourceSnapshot =
      await transaction.get(sourceRef);

    const source = verifySource(sourceSnapshot);

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

    // Check duplicate appointment IDs.
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

    // Check existing booking locks.
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

    // PHASE 8D.57:
    // Also inspect existing server
    // appointments that may have no locks.
    const existingAppointments =
      await transaction.get(
        businessRef.collection("appointments")
      );

    checkLegacyConflicts(
      plan.appointments,
      existingAppointments.docs
    );

    // All validation has passed.
    // Begin atomic writes.

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
