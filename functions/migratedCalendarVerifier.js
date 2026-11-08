"use strict";
/**
 * Phase 10.9: read-only verification of a completed migration against
 * actual trusted Firestore documents. Never changes booking mode or data.
 * A successful check is not permission to enable customer bookings.
 */
const { auditCalendarLocks } = require("./calendarLockAudit");
const { MODES, MIGRATION_ID } = require("./bookingMode");
const ID = /^[A-Za-z0-9_-]{1,100}$/;
const HASH = /^[a-f0-9]{64}$/;
function blocked(reason) {
  return { verified: false, status: "MIGRATION_VERIFICATION_BLOCKED", reason };
}
async function verifyMigratedCalendar({db, businessId, authenticatedUid, expectedSourceHash}) {
  if (!ID.test(businessId || "") || businessId !== authenticatedUid ||
      !HASH.test(expectedSourceHash || "")) {
    throw new Error("Verified owner and independent source hash required");
  }
  if (!db || typeof db.collection !== "function") throw new Error("Trusted database required");
  const business = db.collection("businesses").doc(businessId);
  const [marker, mode, appointmentSnapshot, lockSnapshot] = await Promise.all([
    business.collection("migrations").doc(MIGRATION_ID).get(),
    business.collection("settings").doc("bookingMode").get(),
    business.collection("appointments").get(),
    business.collection("bookingLocks").get()
  ]);
  if (!marker.exists || marker.get("status") !== "completed" ||
      marker.get("verifiedFinalSync") !== true ||
      marker.get("schemaVersion") !== 1 ||
      marker.get("businessId") !== businessId ||
      marker.get("sourceHash") !== expectedSourceHash) {
    return blocked("Migration marker or final source hash does not match");
  }
  if (!mode.exists || mode.get("mode") !== MODES.CLOUD) {
    return blocked("Business is not in shared cloud booking mode");
  }
  const appointments = appointmentSnapshot.docs.map(doc => ({...doc.data(), id:doc.id}));
  const locks = lockSnapshot.docs.map(doc => ({...doc.data(), id:doc.id}));
  if (appointments.some(a => a.businessId !== businessId) ||
      locks.some(l => l.businessId !== businessId)) {
    return blocked("Cross-business calendar document detected");
  }
  const migrated = appointments.filter(a => a.migrationId === MIGRATION_ID);
  const migratedLocks = locks.filter(l => l.migrationId === MIGRATION_ID);
  if (!Number.isInteger(marker.get("appointmentCount")) ||
      !Number.isInteger(marker.get("lockCount")) ||
      marker.get("appointmentCount") < 1 ||
      marker.get("lockCount") < 1 ||
      migrated.length !== marker.get("appointmentCount") ||
      migratedLocks.length !== marker.get("lockCount")) {
    return blocked("Migrated appointment or lock counts do not match marker");
  }
  const audit = auditCalendarLocks(appointments,locks);
  if (!audit.reconciled) return {
    ...blocked("Calendar booking locks do not reconcile"),
    audit
  };
  return {
    verified: true, status: "READ_ONLY_VERIFICATION_PASSED",
    appointmentCount: appointments.length, lockCount: locks.length,
    migratedAppointmentCount: migrated.length, migratedLockCount: migratedLocks.length,
    sourceHash: expectedSourceHash, audit,
    warning: "READ ONLY: independent device sync and production rollout approval are still required."
  };
}
module.exports = { verifyMigratedCalendar };
