"use strict";

/**
 * Phase 10.2: internal availability calculation (NOT a public endpoint).
 * Never use this to enable bookings until Android appointments have been
 * migrated into the shared Firestore bookingLocks collection.
 */
const { validateBookingDate, validateAvailability, createLockIds } = require("./bookingEngine");

function fail(message) {
  const error = new Error(message);
  error.code = "availability-unavailable";
  throw error;
}

const ID = /^[A-Za-z0-9_-]{1,100}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function minutes(value) {
  if (!TIME.test(value)) fail("Invalid time.");
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
function time(value) {
  return String(Math.floor(value / 60)).padStart(2, "0") + ":" +
    String(value % 60).padStart(2, "0");
}
function ukToday() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return p.year + "-" + p.month + "-" + p.day;
}

/**
 * Returns verified free start times, or rejects all availability if migration
 * is incomplete. Caller must supply the authoritative server-side catalogue.
 * Reads locks using getAll in chunks to avoid oversized Firestore requests.
 */
async function getTrustedAvailability({ db, businessId, catalogue, serviceId, staffId, date }) {
  if (!db || typeof db.collection !== "function" || typeof db.getAll !== "function" ||
      !ID.test(businessId || "") || !ID.test(serviceId || "") ||
      !ID.test(staffId || "") || !DATE.test(date || "")) fail("Invalid availability request.");

  const parsed = new Date(date + "T12:00:00Z");
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    fail("Invalid date.");
  }
  // Reuse the booking engine's 90-day and past-date rules.
  validateBookingDate(date, "23:45");

  if (!catalogue || !catalogue.business ||
      catalogue.business.ownerUid !== businessId ||
      catalogue.business.published !== true ||
      catalogue.business.acceptingBookings !== true) fail("Bookings are disabled.");

  const businessRef = db.collection("businesses").doc(businessId);
  const migration = await businessRef.collection("bookingMigration").doc("status").get();
  // A marker alone is not proof of completeness: migration must also have
  // an explicit audited reconciliation result from the rollout process.
  if (!migration.exists || migration.get("androidLocksReconciled") !== true ||
      migration.get("schemaVersion") !== 1) fail("Calendar migration is incomplete.");

  if (!Array.isArray(catalogue.services) || !Array.isArray(catalogue.staff)) fail("Invalid catalogue.");
  const service = catalogue.services.find(x => x.id === serviceId && x.active === true);
  const staff = catalogue.staff.find(x => x.id === staffId && x.active === true &&
    Array.isArray(x.serviceIds) && x.serviceIds.includes(serviceId));
  if (!service || !staff || !Number.isInteger(service.durationMinutes) ||
      service.durationMinutes < 1 || service.durationMinutes > 1440) fail("Service unavailable.");

  const day = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][parsed.getUTCDay()];
  const hours = staff.weeklySchedule && typeof staff.weeklySchedule === "object"
    ? staff.weeklySchedule[day] : catalogue.workingHours?.[day];
  if (!hours) return [];
  const open = minutes(hours.open), close = minutes(hours.close);
  if (close <= open) fail("Invalid working hours.");

  const candidates = [];
  for (let start = Math.ceil(open / 15) * 15; start + service.durationMinutes <= close; start += 15) {
    const startTime = time(start);
    try {
      validateBookingDate(date, startTime);
      validateAvailability(catalogue, service, staff, date, startTime);
      candidates.push({ startTime, locks: createLockIds(staffId, date, start, start + service.durationMinutes) });
    } catch (error) {
      if (error?.code !== "invalid-booking") throw error;
    }
  }
  if (!candidates.length) return [];

  const allIds = [...new Set(candidates.flatMap(x => x.locks))];
  const lockCollection = businessRef.collection("bookingLocks");
  const occupied = new Set();
  for (let i = 0; i < allIds.length; i += 100) {
    const slice = allIds.slice(i, i + 100);
    const snapshots = await db.getAll(...slice.map(id => lockCollection.doc(id)));
    if (!Array.isArray(snapshots) || snapshots.length !== slice.length) fail("Lock lookup failed.");
    snapshots.forEach((snapshot, index) => {
      if (snapshot.exists) occupied.add(slice[index]);
    });
  }
  return candidates.filter(x => x.locks.every(id => !occupied.has(id)))
    .map(x => x.startTime);
}

module.exports = { getTrustedAvailability };
