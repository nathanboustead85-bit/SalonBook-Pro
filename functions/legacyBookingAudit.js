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
  let items;
  try {
    items = typeof json === "string" ? JSON.parse(json) : json;
  } catch (_) {
    return { safe: false, count: 0, errors: ["Invalid booking JSON"], collisions };
  }
  if (!Array.isArray(items)) {
    return { safe: false, count: 0, errors: ["Expected a booking array"], collisions };
  }
  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push("Booking " + index + ": invalid object"); continue;
    }
    const id = item.id;
    if (typeof id !== "string" || !id || seenIds.has(id)) {
      errors.push("Booking " + index + ": missing or duplicate ID");
    } else seenIds.add(id);
    // Legacy Android fields may differ from trusted online schema. Reject
    // unknown shapes rather than guessing which time or staff to lock.
    const date = item.date, startTime = item.startTime, staffId = item.staffId;
    const duration = item.durationMinutes;
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
      else occupied.set(key, id || index);
    }
  }
  return { safe: errors.length === 0 && collisions.length === 0,
    count: items.length, errors, collisions, lockCount: occupied.size };
}
module.exports = { auditLegacyBookings };
