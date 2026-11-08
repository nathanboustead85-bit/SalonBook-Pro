"use strict";
/**
 * Phase 10.4 — read-only Android calendar migration audit.
 * Checks whether existing appointments are represented by the exact shared
 * booking locks used by online bookings. Does NOT migrate or modify data.
 */
const { createLockIds } = require("./bookingEngine");
const ID = /^[A-Za-z0-9_-]{1,100}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMinutes(value) {
  if (typeof value !== "string" || !TIME.test(value)) throw new Error("Invalid appointment time");
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function auditCalendarLocks(appointments, locks) {
  if (!Array.isArray(appointments) || !Array.isArray(locks)) {
    throw new Error("Invalid calendar audit input");
  }
  const issues = [];
  const expected = new Map();
  const seenAppointments = new Set();
  for (const appointment of appointments) {
    const id = appointment?.id;
    if (typeof id !== "string" || !ID.test(id) || seenAppointments.has(id)) {
      issues.push({ appointmentId: String(id), reason: "invalid-or-duplicate-id" });
      continue;
    }
    seenAppointments.add(id);
    if (appointment.status === "cancelled" || appointment.status === "canceled") continue;
    try {
      if (!ID.test(appointment.staffId || "") || !DATE.test(appointment.date || "") ||
          new Date(appointment.date + "T12:00:00Z").toISOString().slice(0, 10) !== appointment.date) {
        throw new Error("Invalid staff or date");
      }
      const start = toMinutes(appointment.startTime);
      const end = toMinutes(appointment.endTime);
      if (start % 15 !== 0 || end <= start || end > 1440) throw new Error("Invalid duration or grid");
      for (const lockId of createLockIds(appointment.staffId, appointment.date, start, end)) {
        if (expected.has(lockId)) {
          issues.push({ appointmentId: id, reason: "overlapping-appointments", lockId });
        } else {
          expected.set(lockId, id);
        }
      }
    } catch (_) {
      issues.push({ appointmentId: id, reason: "invalid-appointment" });
    }
  }
  const actual = new Map();
  for (const lock of locks) {
    if (!lock || typeof lock.id !== "string" || actual.has(lock.id)) {
      issues.push({ reason: "invalid-or-duplicate-lock" });
      continue;
    }
    actual.set(lock.id, lock.appointmentId);
  }
  for (const [lockId, appointmentId] of expected) {
    if (!actual.has(lockId)) issues.push({ appointmentId, lockId, reason: "missing-lock" });
    else if (actual.get(lockId) !== appointmentId) {
      issues.push({ appointmentId, lockId, reason: "wrong-lock-owner" });
    }
  }
  for (const lockId of actual.keys()) {
    if (!expected.has(lockId)) issues.push({ lockId, reason: "orphan-lock" });
  }
  return {
    reconciled: issues.length === 0,
    appointmentCount: appointments.length,
    expectedLockCount: expected.size,
    actualLockCount: actual.size,
    issues
  };
}
module.exports = { auditCalendarLocks };
