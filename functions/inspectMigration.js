"use strict";
const { auditLegacyBookings } = require("./legacyBookingAudit");

/**
 * Owner-scoped read-only preflight. db and uid are supplied by an authenticated
 * callable. No write methods are used anywhere in this module.
 */
async function inspectMigration(db, uid) {
  const snapshot = await db.collection("users").doc(uid)
    .collection("liveData").doc("bookings").get();
  if (!snapshot.exists) return {
    safe: false, count: 0, lockCount: 0, issueCount: 1,
    issues: ["No cloud booking snapshot exists"],
    migrationPerformed: false, liveBookingsEnabled: false
  };
  const json = snapshot.get("json");
  if (typeof json !== "string" || json.length > 500000)
    throw new Error("Invalid legacy cloud booking snapshot.");
  const result = auditLegacyBookings(json);
  let existingLockConflicts = 0;
  let existingLocksChecked = false;
  if (result.safe && result.lockPlan.length <= 500) {
    const businessRef = db.collection("businesses").doc(uid);
    const refs = result.lockPlan.map(item =>
      businessRef.collection("bookingLocks").doc(item.lockId));
    if (refs.length) {
      const snapshots = await db.getAll(...refs);
      if (!Array.isArray(snapshots) || snapshots.length !== refs.length)
        throw new Error("Incomplete booking lock comparison.");
      existingLockConflicts = snapshots.filter(item => item.exists).length;
    }
    existingLocksChecked = true;
  }
  const sharedAppointments = await db.collection("businesses").doc(uid)
    .collection("appointments").limit(1).get();
  const existingSharedAppointments = !sharedAppointments.empty;
  return {
    safe: result.safe && existingLocksChecked &&
      existingLockConflicts === 0 && !existingSharedAppointments,
    existingSharedAppointments,
    legacySnapshotValid: result.safe,
    existingLocksChecked,
    existingLockConflicts,
    count: result.count,
    lockCount: result.lockCount || 0,
    issueCount: result.errors.length,
    collisionCount: result.collisions.length,
    issues: result.errors.slice(0,20).map(message =>
      message.replace(/Booking \d+/g, "Appointment")),
    migrationPerformed: false,
    liveBookingsEnabled: false
  };
}
module.exports = { inspectMigration };
