"use strict";

/**
 * BOUSTIO — PHASE 8C.4
 * Secure appointment booking engine.
 *
 * Backend-only module.
 * Not a public HTTP endpoint.
 *
 * Features:
 * - Request validation
 * - UK local date protection
 * - Maximum 90-day booking window
 * - Staff working hours
 * - Recurring breaks
 * - Staff time off
 * - Service assignments
 * - 15-minute booking locks
 * - Atomic Firestore transactions
 * - Private appointment records
 *
 * IMPORTANT:
 * The caller must load the catalogue from
 * trusted server-controlled storage.
 *
 * Never accept an authoritative catalogue
 * directly from the customer's browser.
 *
 * Existing Android appointments must be
 * migrated or included in conflict checks
 * before public bookings are enabled.
 */

const {
  FieldValue
} = require("firebase-admin/firestore");

const DAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday"
];

const TIME_ZONE = "Europe/London";
const MAX_ADVANCE_DAYS = 90;

const DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}$/;

const TIME_PATTERN =
  /^([01]\d|2[0-3]):([0-5]\d)$/;

const ID_PATTERN =
  /^[A-Za-z0-9_-]{1,100}$/;

function fail(message) {
  const error = new Error(message);
  error.code = "invalid-booking";
  throw error;
}

function parseTime(value) {
  if (
    typeof value !== "string" ||
    !TIME_PATTERN.test(value)
  ) {
    fail("Invalid appointment time.");
  }

  const [hours, minutes] =
    value.split(":").map(Number);

  return hours * 60 + minutes;
}

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return String(hours).padStart(2, "0") +
    ":" +
    String(remainder).padStart(2, "0");
}

function parseDate(value) {
  if (
    typeof value !== "string" ||
    !DATE_PATTERN.test(value)
  ) {
    fail("Invalid appointment date.");
  }

  const date = new Date(value + "T12:00:00Z");

  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    fail("Invalid appointment date.");
  }

  return date;
}

function validId(value) {
  return typeof value === "string" &&
    ID_PATTERN.test(value);
}

function overlaps(
  firstStart,
  firstEnd,
  secondStart,
  secondEnd
) {
  return firstStart < secondEnd &&
    firstEnd > secondStart;
}

/**
 * Returns the current date and time in
 * the UK, accounting for GMT/BST.
 */
function ukNow() {
  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }
  ).formatToParts(new Date());

  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return {
    date:
      values.year + "-" +
      values.month + "-" +
      values.day,
    time:
      values.hour + ":" +
      values.minute
  };
}

/**
 * Reject past dates and dates beyond
 * the initial 90-day booking window.
 *
 * Uses calendar days rather than a
 * fixed 24-hour difference, so changes
 * between GMT and BST do not affect
 * the booking window.
 */
function validateBookingDate(date, startTime) {
  const selected = parseDate(date);
  const now = ukNow();

  const today = parseDate(now.date);

  const difference = Math.round(
    (selected.getTime() - today.getTime()) /
    86400000
  );

  if (difference < 0) {
    fail("Appointments cannot be booked in the past.");
  }

  if (difference > MAX_ADVANCE_DAYS) {
    fail("Appointments can only be booked 90 days ahead.");
  }

  if (
    difference === 0 &&
    parseTime(startTime) <= parseTime(now.time)
  ) {
    fail("This appointment time has already passed.");
  }

  return true;
}

function validateRequest(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    fail("Missing booking information.");
  }

  const {
    businessId,
    serviceId,
    staffId,
    date,
    startTime,
    customerName,
    customerEmail,
    customerPhone
  } = input;

  if (
    !validId(businessId) ||
    !validId(serviceId) ||
    !validId(staffId)
  ) {
    fail("Invalid business, service or staff.");
  }

  parseDate(date);

  const start = parseTime(startTime);

  if (start % 15 !== 0) {
    fail(
      "Appointments must start on a 15-minute interval."
    );
  }

  if (
    typeof customerName !== "string" ||
    customerName.trim().length < 2 ||
    customerName.trim().length > 100
  ) {
    fail("Enter a valid customer name.");
  }

  if (
    typeof customerEmail !== "string" ||
    customerEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      customerEmail
    )
  ) {
    fail("Enter a valid email address.");
  }

  if (
    typeof customerPhone !== "string" ||
    customerPhone.length > 50
  ) {
    fail("Invalid customer phone number.");
  }

  return {
    businessId,
    serviceId,
    staffId,
    date,
    startTime,
    customerName: customerName.trim(),
    customerEmail: customerEmail.trim(),
    customerPhone: customerPhone.trim()
  };
}

function findService(catalogue, serviceId) {
  const service = catalogue.services.find(
    item =>
      item.id === serviceId &&
      item.active === true
  );

  if (!service) {
    fail("This service is unavailable.");
  }

  if (
    !Number.isInteger(service.durationMinutes) ||
    service.durationMinutes < 1 ||
    service.durationMinutes > 1440
  ) {
    fail("Invalid service duration.");
  }

  if (
    typeof service.price !== "number" ||
    !Number.isFinite(service.price) ||
    service.price < 0
  ) {
    fail("Invalid service price.");
  }

  return service;
}

function findStaff(catalogue, staffId, serviceId) {
  const member = catalogue.staff.find(
    item =>
      item.id === staffId &&
      item.active === true
  );

  if (!member) {
    fail("This professional is unavailable.");
  }

  if (
    !Array.isArray(member.serviceIds) ||
    !member.serviceIds.includes(serviceId)
  ) {
    fail(
      "This professional does not offer that service."
    );
  }

  return member;
}

function workingHours(catalogue, member, day) {
  const schedule =
    member.weeklySchedule &&
    typeof member.weeklySchedule === "object"
      ? member.weeklySchedule
      : catalogue.workingHours;

  const interval = schedule?.[day];

  if (!interval) {
    fail(
      "The professional is not working on this date."
    );
  }

  const open = parseTime(interval.open);
  const close = parseTime(interval.close);

  if (open >= close) {
    fail("Invalid working hours.");
  }

  return { open, close };
}

function validateAvailability(
  catalogue,
  service,
  member,
  date,
  startTime
) {
  const selectedDate = parseDate(date);

  const day =
    DAYS[selectedDate.getUTCDay()];

  const { open, close } =
    workingHours(catalogue, member, day);

  const start = parseTime(startTime);
  const end = start + service.durationMinutes;

  if (
    start < open ||
    end > close ||
    end > 1440
  ) {
    fail(
      "Appointment is outside working hours."
    );
  }

  const breaks =
    Array.isArray(member.weeklyBreaks)
      ? member.weeklyBreaks
      : [];

  for (const item of breaks) {
    if (item.day !== day) {
      continue;
    }

    const breakStart = parseTime(item.start);
    const breakEnd = parseTime(item.end);

    if (
      overlaps(
        start,
        end,
        breakStart,
        breakEnd
      )
    ) {
      fail(
        "Appointment overlaps a staff break."
      );
    }
  }

  const timeOff =
    Array.isArray(member.timeOff)
      ? member.timeOff
      : [];

  for (const item of timeOff) {
    if (item.date !== date) {
      continue;
    }

    const offStart = parseTime(item.start);
    const offEnd = parseTime(item.end);

    if (
      overlaps(
        start,
        end,
        offStart,
        offEnd
      )
    ) {
      fail(
        "The professional is unavailable."
      );
    }
  }

  return { start, end };
}

/**
 * Each lock represents a 15-minute
 * interval occupied by an appointment.
 */
function createLockIds(
  staffId,
  date,
  start,
  end
) {
  const result = [];

  const first =
    Math.floor(start / 15) * 15;

  for (
    let minute = first;
    minute < end;
    minute += 15
  ) {
    result.push(
      staffId + "_" +
      date + "_" +
      formatTime(minute).replace(":", "")
    );
  }

  return result;
}

/**
 * Creates a booking using a Firestore
 * transaction.
 *
 * Security requirements:
 *
 * 1. db must be an Admin SDK Firestore.
 * 2. catalogue must be server-controlled.
 * 3. The caller must resolve and verify
 *    the correct business owner UID.
 * 4. Existing Android bookings must be
 *    represented in the same lock system.
 *
 * These requirements must be completed
 * before enabling public booking requests.
 */
async function createBooking({
  db,
  catalogue,
  request
}) {
  if (
    !db ||
    typeof db.runTransaction !== "function"
  ) {
    fail("Database is unavailable.");
  }

  if (
    !catalogue ||
    !catalogue.business ||
    !Array.isArray(catalogue.services) ||
    !Array.isArray(catalogue.staff)
  ) {
    fail(
      "Business catalogue is unavailable."
    );
  }

  const input = validateRequest(request);

  // If the trusted catalogue contains
  // an owner UID, it must match the
  // destination business document.
  if (
    typeof catalogue.business.ownerUid === "string" &&
    catalogue.business.ownerUid !== input.businessId
  ) {
    fail("Business ownership mismatch.");
  }

  if (
    catalogue.business.published !== true ||
    catalogue.business.acceptingBookings !== true
  ) {
    fail(
      "This business is not accepting bookings."
    );
  }

  // Validate the date before accessing
  // the booking database.
  validateBookingDate(
    input.date,
    input.startTime
  );

  const service =
    findService(
      catalogue,
      input.serviceId
    );

  const member =
    findStaff(
      catalogue,
      input.staffId,
      input.serviceId
    );

  const { start, end } =
    validateAvailability(
      catalogue,
      service,
      member,
      input.date,
      input.startTime
    );

  const lockIds = createLockIds(
    input.staffId,
    input.date,
    start,
    end
  );

  const businessRef = db
    .collection("businesses")
    .doc(input.businessId);

  const appointmentRef = businessRef
    .collection("appointments")
    .doc();

  const lockRefs = lockIds.map(id =>
    businessRef
      .collection("bookingLocks")
      .doc(id)
  );

  await db.runTransaction(
    async transaction => {
      const snapshots = [];

      // All reads must happen before
      // any transaction writes.
      for (const ref of lockRefs) {
        snapshots.push(
          await transaction.get(ref)
        );
      }

      if (
        snapshots.some(
          snapshot => snapshot.exists
        )
      ) {
        fail(
          "This appointment time is already booked."
        );
      }

      const appointment = {
        businessId: input.businessId,
        serviceId: input.serviceId,
        serviceName: service.name,
        staffId: input.staffId,
        staffName: member.name,
        date: input.date,
        startTime: input.startTime,
        endTime: formatTime(end),
        durationMinutes:
          service.durationMinutes,
        price: service.price,
        customerName:
          input.customerName,
        customerEmail:
          input.customerEmail,
        customerPhone:
          input.customerPhone,
        status: "confirmed",
        source: "online",
        schemaVersion: 1,
        createdAt:
          FieldValue.serverTimestamp(),
        updatedAt:
          FieldValue.serverTimestamp()
      };

      transaction.create(
        appointmentRef,
        appointment
      );

      for (const ref of lockRefs) {
        transaction.create(ref, {
          appointmentId:
            appointmentRef.id,
          businessId:
            input.businessId,
          staffId:
            input.staffId,
          date:
            input.date,
          createdAt:
            FieldValue.serverTimestamp()
        });
      }
    }
  );

  return {
    success: true,
    appointmentId:
      appointmentRef.id,
    date:
      input.date,
    startTime:
      input.startTime,
    endTime:
      formatTime(end),
    serviceName:
      service.name,
    staffName:
      member.name
  };
}

module.exports = {
  validateRequest,
  validateBookingDate,
  validateAvailability,
  createLockIds,
  createBooking
};
