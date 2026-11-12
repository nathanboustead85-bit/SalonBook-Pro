"use strict";

/**
 * Read-only migration preflight for legacy Android bookings.
 * No Firestore writes, no booking activation. This detects data quality
 * blockers before the legacy JSON snapshot can share online booking locks.
 */
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
function minute(value) {
  if (typeof value !== "string" || !CLOCK.test(value)) return null;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
function auditLegacyBookings(json) {
  const errors = [], collisions = [], seenIds = new Set(), occupied = new Map();
  const lockPlan = [];
  let items;
  try {
    items = typeof json === "string" ? JSON.parse(json) : json;
  } catch (_) {
    return { safe: false, count: 0, errors: ["Invalid booking JSON"], collisions, lockPlan };
  }
  if (!Array.isArray(items)) {
    return { safe: false, count: 0, errors: ["Expected a booking array"], collisions, lockPlan };
  }
  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push("Booking " + index + ": invalid object"); continue;
    }
    const id = item.id;
    if (typeof id !== "string" || !id || seenIds.has(id)) {
      errors.push("Booking " + index + ": missing or duplicate ID");
    } else seenIds.add(id);
    // MainActivity.Booking serialises time and duration (not startTime /
    // durationMinutes). Require explicit valid staff IDs and duration.
    // Old appointments with missing metadata must be resolved manually.
    const date = item.date, startTime = item.time, staffId = item.staffId;
    const duration = item.duration;
    const start = minute(startTime);
    const validDate = typeof date === "string" && DATE.test(date) &&
      !Number.isNaN(Date.parse(date + "T12:00:00Z")) &&
      new Date(date + "T12:00:00Z").toISOString().slice(0,10) === date;
    if (!validDate || start === null || start % 15 !== 0 ||
        typeof staffId !== "string" || !staffId ||
        !Number.isInteger(duration) || duration <= 0 ||
        start + duration > 1440) {
      errors.push("Booking " + index + ": cannot safely map to shared booking locks");
      continue;
    }
    for (let m = start; m < start + duration; m += 15) {
      const key = JSON.stringify([staffId,date,Math.floor(m/15)]);
      if (occupied.has(key)) collisions.push([occupied.get(key), id || index]);
      else {
        occupied.set(key, id || index);
        lockPlan.push({ bookingId: id, staffId, date, minute: m,
          lockId: staffId + "_" + date + "_" +
            String(Math.floor(m/60)).padStart(2,"0") +
            String(m%60).padStart(2,"0") });
      }
    }
  }
  return { safe: errors.length === 0 && collisions.length === 0,
    count: items.length, errors, collisions, lockCount: occupied.size,
    lockPlan: errors.length === 0 && collisions.length === 0 ? lockPlan : [] };
}
module.exports = { auditLegacyBookings };
