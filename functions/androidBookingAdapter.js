"use strict";

/**
 * BOUSTIO — PHASE 8D.2
 *
 * Android Booking Synchronisation Adapter
 *
 * READ-ONLY PREPARATION MODULE.
 *
 * Converts legacy Android booking JSON into
 * validated server-side appointment records.
 *
 * This module does NOT:
 * - Write to Firestore
 * - Create booking locks
 * - Delete or change Android bookings
 * - Enable public customer bookings
 *
 * Invalid records are quarantined in the
 * returned report, not silently discarded.
 */

const ID_PATTERN =
  /^[A-Za-z0-9_-]{1,100}$/;

const DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}$/;

const TIME_PATTERN =
  /^([01]\d|2[0-3]):[0-5]\d$/;

function validId(value) {
  return (
    typeof value === "string" &&
    ID_PATTERN.test(value)
  );
}

function validDate(value) {
  if (
    typeof value !== "string" ||
    !DATE_PATTERN.test(value)
  ) {
    return false;
  }

  const [year, month, day] =
    value.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validTime(value) {
  return (
    typeof value === "string" &&
    TIME_PATTERN.test(value)
  );
}

function toMinutes(value) {
  const [hours, minutes] =
    value.split(":").map(Number);

  return hours * 60 + minutes;
}

function toTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  return (
    String(hours).padStart(2, "0") +
    ":" +
    String(remainder).padStart(2, "0")
  );
}

function validPrice(value) {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return false;
  }

  const text = String(value).trim();

  return (
    /^\d+(?:\.\d{1,2})?$/.test(text) &&
    Number.isFinite(Number(text)) &&
    Number(text) >= 0 &&
    Number(text) <= 100000
  );
}

function normalizeBooking(
  source,
  businessId
) {
  const errors = [];

  if (
    !source ||
    typeof source !== "object" ||
    Array.isArray(source)
  ) {
    return {
      valid: false,
      errors: ["Invalid booking record"]
    };
  }

  if (!validId(businessId)) {
    errors.push(
      "Invalid business identifier"
    );
  }

  const id = source.id;
  const staffId = source.staffId;
  const serviceId = source.serviceId;
  const date = source.date;
  const startTime = source.time;
  const durationMinutes = source.duration;

  if (
    typeof id !== "string" ||
    id.trim().length === 0 ||
    id.length > 150 ||
    id.includes("/")
  ) {
    errors.push("Invalid booking ID");
  }

  if (!validId(staffId)) {
    errors.push("Missing or invalid staff ID");
  }

  if (!validId(serviceId)) {
    errors.push("Missing or invalid service ID");
  }

  if (!validDate(date)) {
    errors.push("Invalid booking date");
  }

  if (!validTime(startTime)) {
    errors.push("Invalid booking time");
  }

  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > 1440
  ) {
    errors.push("Invalid booking duration");
  }

  if (
    typeof source.client !== "string" ||
    source.client.trim().length === 0
  ) {
    errors.push("Missing client name");
  }

  if (!validPrice(source.price)) {
    errors.push("Invalid booking price");
  }

  if (
    errors.length > 0
  ) {
    return {
      valid: false,
      errors
    };
  }

  const startMinutes =
    toMinutes(startTime);

  const endMinutes =
    startMinutes + durationMinutes;

  if (endMinutes > 1440) {
    return {
      valid: false,
      errors: [
        "Appointment extends beyond midnight"
      ]
    };
  }

  const endTime =
    endMinutes === 1440
      ? "24:00"
      : toTime(endMinutes);

  return {
    valid: true,
    appointment: {
      id,
      businessId,
      staffId,
      serviceId,
      date,
      startTime,
      endTime,
      durationMinutes,
      clientName: source.client.trim(),
      serviceName:
        typeof source.service === "string"
          ? source.service.trim()
          : "",
      price: Number(source.price),
      notes:
        typeof source.notes === "string"
          ? source.notes
          : "",
      source: "android",
      status: "confirmed"
    }
  };
}

/**
 * Detect overlapping appointments for
 * the same staff member and date.
 *
 * Both conflicting records are flagged.
 */
function detectConflicts(appointments) {
  const conflicts = new Set();

  for (
    let i = 0;
    i < appointments.length;
    i++
  ) {
    const first = appointments[i];

    for (
      let j = i + 1;
      j < appointments.length;
      j++
    ) {
      const second = appointments[j];

      if (
        first.staffId !== second.staffId ||
        first.date !== second.date
      ) {
        continue;
      }

      const firstStart =
        toMinutes(first.startTime);

      const firstEnd =
        firstStart +
        first.durationMinutes;

      const secondStart =
        toMinutes(second.startTime);

      const secondEnd =
        secondStart +
        second.durationMinutes;

      if (
        firstStart < secondEnd &&
        secondStart < firstEnd
      ) {
        conflicts.add(first.id);
        conflicts.add(second.id);
      }
    }
  }

  return conflicts;
}

/**
 * Produce a migration preview.
 *
 * Nothing is written to Firebase.
 *
 * The original booking JSON is not
 * modified.
 */
function prepareAndroidBookings({
  businessId,
  bookingsJson
}) {
  if (!validId(businessId)) {
    throw new Error(
      "Invalid business identifier"
    );
  }

  let records;

  if (typeof bookingsJson === "string") {
    try {
      records = JSON.parse(bookingsJson);
    } catch (_) {
      throw new Error(
        "Android booking JSON is invalid"
      );
    }
  } else {
    records = bookingsJson;
  }

  if (!Array.isArray(records)) {
    throw new Error(
      "Android bookings must be an array"
    );
  }

  if (records.length > 10000) {
    throw new Error(
      "Too many Android booking records"
    );
  }

  const validRecords = [];
  const rejected = [];
  const seenIds = new Set();

  records.forEach((record, index) => {
    const result =
      normalizeBooking(record, businessId);

    if (!result.valid) {
      rejected.push({
        index,
        id:
          record &&
          typeof record.id === "string"
            ? record.id
            : null,
        errors: result.errors
      });

      return;
    }

    const appointment =
      result.appointment;

    if (seenIds.has(appointment.id)) {
      rejected.push({
        index,
        id: appointment.id,
        errors: [
          "Duplicate booking ID"
        ]
      });

      return;
    }

    seenIds.add(appointment.id);

    validRecords.push({
      index,
      appointment
    });
  });

  const conflicts = detectConflicts(
    validRecords.map(
      entry => entry.appointment
    )
  );

  const ready = [];

  for (const entry of validRecords) {
    if (
      conflicts.has(entry.appointment.id)
    ) {
      rejected.push({
        index: entry.index,
        id: entry.appointment.id,
        errors: [
          "Overlapping staff appointment"
        ]
      });
    } else {
      ready.push(entry.appointment);
    }
  }

  rejected.sort(
    (a, b) => a.index - b.index
  );

  return {
    businessId,
    total: records.length,
    readyCount: ready.length,
    rejectedCount: rejected.length,
    ready,
    rejected,
    safeToMigrate:
      rejected.length === 0
  };
}

module.exports = {
  normalizeBooking,
  detectConflicts,
  prepareAndroidBookings
};
