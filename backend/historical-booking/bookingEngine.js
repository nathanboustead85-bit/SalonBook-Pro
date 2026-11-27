"use strict";

/**
 * BOUSTIO — PHASE 8C.6
 * Secure appointment booking engine.
 *
 * Backend-only module.
 * Not a public HTTP endpoint.
 *
 * IMPORTANT:
 * The catalogue must come from trusted,
 * server-controlled storage.
 *
 * This module does not independently
 * authenticate the caller or verify
 * the source of catalogue data.
 *
 * Existing Android bookings must be
 * included in the same conflict system
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

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

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
  const day = DAYS[selectedDate.getUTCDay()];

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
      fail("Appointment overlaps a staff break.");
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
      fail("The professional is unavailable.");
    }
  }

  return { start, end };
}

function createLockIds(
  staffId,
  date,
  start,
  end
) {
  const result = [];
  const first = Math.floor(start / 15) * 15;

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
 * Creates an appointment using a Firestore
 * transaction and 15-minute lock records.
 *
 * Preconditions:
 * - Admin SDK Firestore supplied by backend
 * - Trusted catalogue loaded by backend
 * - Catalogue ownerUid matches businessId
 * - Existing bookings represented by locks
 *
 * Not yet a public booking endpoint.
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
    fail("Business catalogue is unavailable.");
  }

  const input = validateRequest(request);

  // Phase 8C.6: ownership is mandatory.
  if (
    typeof catalogue.business.ownerUid !== "string" ||
    catalogue.business.ownerUid.length === 0
  ) {
    fail("Business ownership is missing.");
  }

  if (
    catalogue.business.ownerUid !== input.businessId
  ) {
    fail("Business ownership mismatch.");
  }

  if (
    catalogue.business.published !== true ||
    catalogue.business.acceptingBookings !== true
  ) {
    fail("This business is not accepting bookings.");
  }

  validateBookingDate(
    input.date,
    input.startTime
  );

  const service = findService(
    catalogue,
    input.serviceId
  );

  const member = findStaff(
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

      // Firestore requires reads before writes.
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
        durationMinutes: service.durationMinutes,
        price: service.price,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        status: "confirmed",
        source: "online",
        schemaVersion: 1,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      transaction.create(
        appointmentRef,
        appointment
      );

      for (const ref of lockRefs) {
        transaction.create(ref, {
          appointmentId: appointmentRef.id,
          businessId: input.businessId,
          staffId: input.staffId,
          date: input.date,
          createdAt: FieldValue.serverTimestamp()
        });
      }
    }
  );

  return {
    success: true,
    appointmentId: appointmentRef.id,
    date: input.date,
    startTime: input.startTime,
    endTime: formatTime(end),
    serviceName: service.name,
    staffName: member.name
  };
}

module.exports = {
  validateRequest,
  validateBookingDate,
  validateAvailability,
  createLockIds,
  createBooking
};
