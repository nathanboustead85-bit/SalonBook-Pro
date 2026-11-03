"use strict";

/**
 * BOUSTIO — PHASE 8D.8
 *
 * Read-only migration safety validator.
 *
 * Checks a proposed Android booking migration
 * against snapshots of existing server
 * appointments and booking locks.
 *
 * IMPORTANT:
 * - Does not read Firestore itself
 * - Does not write or delete anything
 * - Does not activate online bookings
 * - Does not authorise a live migration
 *
 * A real migration must later use an
 * authenticated server-side transaction
 * and recheck database state atomically.
 */

const {
  makeMigrationPlan
} = require("./bookingMigrationPlan");

function validId(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 150 &&
    !value.includes("/")
  );
}

function fail(message) {
  const error = new Error(message);
  error.code = "migration-validation-error";
  throw error;
}

function validateSnapshots(
  existingAppointments,
  existingLocks
) {
  if (
    !Array.isArray(existingAppointments) ||
    !Array.isArray(existingLocks)
  ) {
    fail(
      "Existing appointments and locks " +
      "must both be supplied as arrays."
    );
  }

  const appointmentIds = new Set();
  const lockIds = new Set();

  for (const item of existingAppointments) {
    if (!item || !validId(item.id)) {
      fail(
        "Invalid existing appointment snapshot."
      );
    }

    if (appointmentIds.has(item.id)) {
      fail(
        "Duplicate IDs in existing " +
        "appointment snapshot."
      );
    }

    appointmentIds.add(item.id);
  }

  for (const item of existingLocks) {
    if (!item || !validId(item.lockId)) {
      fail(
        "Invalid existing booking lock snapshot."
      );
    }

    if (lockIds.has(item.lockId)) {
      fail(
        "Duplicate IDs in existing " +
        "booking lock snapshot."
      );
    }

    lockIds.add(item.lockId);
  }

  return {
    appointmentIds,
    lockIds
  };
}

function validateMigration({
  businessId,
  bookingsJson,
  existingAppointments,
  existingLocks
}) {
  const existing = validateSnapshots(
    existingAppointments,
    existingLocks
  );

  const plan = makeMigrationPlan({
    businessId,
    bookingsJson
  });

  const problems = [...plan.problems];

  for (const rejected of plan.rejected) {
    problems.push({
      bookingId: rejected.id,
      reason:
        "Invalid Android booking: " +
        rejected.errors.join("; ")
    });
  }

  for (const appointment of plan.appointments) {
    if (
      existing.appointmentIds.has(
        appointment.id
      )
    ) {
      problems.push({
        bookingId: appointment.id,
        reason:
          "Appointment ID already exists " +
          "on the server."
      });
    }
  }

  for (const lock of plan.locks) {
    if (
      existing.lockIds.has(lock.lockId)
    ) {
      problems.push({
        bookingId: lock.appointmentId,
        lockId: lock.lockId,
        reason:
          "Booking slot already locked " +
          "on the server."
      });
    }
  }

  const ready =
    plan.safeToMigrate === true &&
    problems.length === 0;

  return {
    businessId,
    safeToMigrate: ready,
    sourceCount: plan.sourceCount,
    proposedAppointmentCount:
      plan.appointmentCount,
    proposedLockCount: plan.lockCount,
    existingAppointmentCount:
      existingAppointments.length,
    existingLockCount:
      existingLocks.length,
    problemCount: problems.length,
    problems,
    appointments: ready
      ? plan.appointments
      : [],
    locks: ready
      ? plan.locks
      : [],
    status: ready
      ? "PREFLIGHT_PASSED"
      : "MIGRATION_BLOCKED",
    warning:
      "READ-ONLY PREFLIGHT ONLY. " +
      "Snapshots must be obtained from " +
      "trusted server-side Firestore reads. " +
      "This result does not guarantee " +
      "database state remains unchanged. " +
      "A live migration requires " +
      "authentication, ownership checks, " +
      "transactional conflict checks, " +
      "and atomic writes."
  };
}

module.exports = {
  validateMigration,
  validateSnapshots
};
