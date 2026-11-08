"use strict";
/**
 * Phase 10.8 — read-only migration preflight.
 * Inputs MUST come from trusted, owner-scoped server reads.
 * This is NOT migration authorisation and performs no Firestore writes.
 */
const { validateMigration } = require("./bookingMigrationValidator");
const { auditCalendarLocks } = require("./calendarLockAudit");
const { digestBookings } = require("./finalBookingSyncVerifier");

function preflightAndroidCalendar({ businessId, bookingsJson, existingAppointments, existingLocks }) {
  if (typeof bookingsJson !== "string" ||
      !Array.isArray(existingAppointments) || !Array.isArray(existingLocks)) {
    throw new Error("Trusted migration source and server snapshots required");
  }
  // Reject empty source: zero records cannot prove that device sync completed.
  const source = JSON.parse(bookingsJson);
  if (!Array.isArray(source) || source.length === 0) {
    return { safeToProceed: false, status: "BLOCKED_EMPTY_SOURCE",
      sourceCount: Array.isArray(source) ? source.length : null,
      problems: ["No Android bookings to verify; explicit empty-calendar cutover required"] };
  }
  const audit = auditCalendarLocks(
    existingAppointments,
    existingLocks.map(lock => ({ ...lock, id: lock.lockId }))
  );
  const proposal = validateMigration({
    businessId, bookingsJson, existingAppointments, existingLocks
  });
  const problems = [...proposal.problems];
  if (!audit.reconciled) problems.push({
    reason: "Existing server appointment locks are not reconciled",
    issueCount: audit.issues.length
  });
  return {
    safeToProceed: proposal.safeToMigrate && audit.reconciled,
    status: proposal.safeToMigrate && audit.reconciled ? "READ_ONLY_PREFLIGHT_PASSED" : "MIGRATION_BLOCKED",
    sourceCount: proposal.sourceCount,
    proposedAppointmentCount: proposal.proposedAppointmentCount,
    proposedLockCount: proposal.proposedLockCount,
    sourceHash: digestBookings(bookingsJson),
    existingAudit: audit,
    problems,
    warning: "READ-ONLY. Not an authorisation to migrate, freeze writes, or enable online bookings. A verified final device sync and transactional migration are still required."
  };
}
module.exports = { preflightAndroidCalendar };
