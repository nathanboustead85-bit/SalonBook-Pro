"use strict";

/**
 * BOUSTIO — PHASE 8D.5
 *
 * Read-only Android booking migration planner.
 *
 * Produces a preview of appointment records
 * and their required 15-minute booking locks.
 *
 * NO Firebase writes.
 * NO appointment changes.
 * NO public booking activation.
 */

const {
  prepareAndroidBookings
} = require("./androidBookingAdapter");

const {
  createLockIds
} = require("./bookingEngine");

function minutes(time) {
  const [hour, minute] = time
    .split(":")
    .map(Number);

  return hour * 60 + minute;
}

function makeMigrationPlan({
  businessId,
  bookingsJson
}) {
  const report = prepareAndroidBookings({
    businessId,
    bookingsJson
  });

  const appointments = [];
  const locks = [];
  const lockOwners = new Map();
  const problems = [];

  for (const appointment of report.ready) {
    const start = minutes(
      appointment.startTime
    );

    const end =
      start + appointment.durationMinutes;

    const lockIds = createLockIds(
      appointment.staffId,
      appointment.date,
      start,
      end
    );

    if (lockIds.length === 0) {
      problems.push({
        bookingId: appointment.id,
        reason: "No booking locks generated"
      });

      continue;
    }

    let hasCollision = false;

    for (const lockId of lockIds) {
      if (lockOwners.has(lockId)) {
        hasCollision = true;

        problems.push({
          bookingId: appointment.id,
          conflictingBookingId:
            lockOwners.get(lockId),
          reason: "Booking lock collision"
        });
      }
    }

    if (hasCollision) {
      continue;
    }

    for (const lockId of lockIds) {
      lockOwners.set(
        lockId,
        appointment.id
      );

      locks.push({
        lockId,
        appointmentId: appointment.id,
        businessId,
        staffId: appointment.staffId,
        date: appointment.date
      });
    }

    appointments.push(appointment);
  }

  const safe =
    report.safeToMigrate &&
    problems.length === 0 &&
    appointments.length === report.total;

  return {
    businessId,
    sourceCount: report.total,
    appointmentCount: appointments.length,
    lockCount: locks.length,
    rejectedCount: report.rejectedCount,
    safeToMigrate: safe,
    appointments,
    locks,
    rejected: report.rejected,
    problems,
    warning:
      "READ-ONLY PREVIEW. No Firestore " +
      "writes performed. Existing server " +
      "appointments and locks have not " +
      "been checked. Migration requires " +
      "a separate authenticated, " +
      "transactional process."
  };
}

module.exports = {
  makeMigrationPlan
};
