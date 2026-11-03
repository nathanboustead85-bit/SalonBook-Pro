"use strict";

/**
 * BOUSTIO — PHASE 8C.7
 *
 * Trusted Firebase business catalogue loader.
 *
 * SERVER-SIDE ONLY.
 *
 * This module:
 * - Reads a catalogue from Firestore
 * - Verifies the business owner
 * - Checks publication status
 * - Checks whether bookings are enabled
 * - Validates services and staff
 * - Rejects missing or malformed data
 *
 * IMPORTANT:
 * No customer-supplied catalogue is accepted.
 *
 * The catalogue document is expected at:
 *
 * businesses/{businessId}/catalogue/current
 *
 * This path is reserved for future trusted
 * backend publishing. The existing Android
 * app does not yet populate it.
 *
 * Do not enable public bookings until
 * catalogue publishing and existing booking
 * synchronisation are implemented.
 */

const ID_PATTERN =
  /^[A-Za-z0-9_-]{1,100}$/;

function catalogueError(message) {
  const error = new Error(message);
  error.code = "invalid-catalogue";
  throw error;
}

function validId(value) {
  return (
    typeof value === "string" &&
    ID_PATTERN.test(value)
  );
}

function validTime(value) {
  return (
    typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  );
}

function validInterval(interval) {
  if (
    !interval ||
    typeof interval !== "object" ||
    Array.isArray(interval) ||
    !validTime(interval.open) ||
    !validTime(interval.close)
  ) {
    return false;
  }

  return interval.open < interval.close;
}

function validateSchedule(schedule) {
  if (
    !schedule ||
    typeof schedule !== "object" ||
    Array.isArray(schedule)
  ) {
    return false;
  }

  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday"
  ];

  return days.every(day => {
    const interval = schedule[day];

    return (
      interval == null ||
      validInterval(interval)
    );
  });
}

function validateServices(services) {
  if (
    !Array.isArray(services) ||
    services.length === 0 ||
    services.length > 200
  ) {
    catalogueError(
      "Business services are unavailable."
    );
  }

  const ids = new Set();

  for (const service of services) {
    if (
      !service ||
      !validId(service.id) ||
      ids.has(service.id) ||
      typeof service.name !== "string" ||
      service.name.trim().length === 0 ||
      service.name.length > 150 ||
      typeof service.active !== "boolean" ||
      !Number.isInteger(
        service.durationMinutes
      ) ||
      service.durationMinutes < 1 ||
      service.durationMinutes > 1440 ||
      typeof service.price !== "number" ||
      !Number.isFinite(service.price) ||
      service.price < 0
    ) {
      catalogueError(
        "Business service information is invalid."
      );
    }

    ids.add(service.id);
  }

  return ids;
}

function validateStaff(staff, serviceIds) {
  if (
    !Array.isArray(staff) ||
    staff.length === 0 ||
    staff.length > 200
  ) {
    catalogueError(
      "Business staff are unavailable."
    );
  }

  const ids = new Set();

  for (const member of staff) {
    if (
      !member ||
      !validId(member.id) ||
      ids.has(member.id) ||
      typeof member.name !== "string" ||
      member.name.trim().length === 0 ||
      member.name.length > 150 ||
      typeof member.active !== "boolean" ||
      !Array.isArray(member.serviceIds) ||
      !member.serviceIds.every(
        id => serviceIds.has(id)
      ) ||
      !validateSchedule(
        member.weeklySchedule
      )
    ) {
      catalogueError(
        "Business staff information is invalid."
      );
    }

    const breaks = member.weeklyBreaks || [];
    const timeOff = member.timeOff || [];

    if (
      !Array.isArray(breaks) ||
      !Array.isArray(timeOff) ||
      breaks.length > 200 ||
      timeOff.length > 500
    ) {
      catalogueError(
        "Staff availability information is invalid."
      );
    }

    for (const item of breaks) {
      if (
        !item ||
        ![
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday"
        ].includes(item.day) ||
        !validTime(item.start) ||
        !validTime(item.end) ||
        item.start >= item.end
      ) {
        catalogueError(
          "Staff break information is invalid."
        );
      }
    }

    for (const item of timeOff) {
      if (
        !item ||
        typeof item.date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(
          item.date
        ) ||
        !validTime(item.start) ||
        !validTime(item.end) ||
        item.start >= item.end
      ) {
        catalogueError(
          "Staff time-off information is invalid."
        );
      }
    }

    ids.add(member.id);
  }
}

function validateCatalogue(
  data,
  businessId
) {
  if (!validId(businessId)) {
    catalogueError(
      "Invalid business identifier."
    );
  }

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !data.business ||
    typeof data.business !== "object"
  ) {
    catalogueError(
      "Business catalogue is unavailable."
    );
  }

  const business = data.business;

  if (
    business.ownerUid !== businessId
  ) {
    catalogueError(
      "Business ownership mismatch."
    );
  }

  if (
    business.published !== true ||
    business.acceptingBookings !== true
  ) {
    catalogueError(
      "This business is not accepting bookings."
    );
  }

  if (
    data.schemaVersion !== 1
  ) {
    catalogueError(
      "Unsupported catalogue version."
    );
  }

  const serviceIds =
    validateServices(data.services);

  validateStaff(
    data.staff,
    serviceIds
  );

  if (
    data.workingHours != null &&
    !validateSchedule(
      data.workingHours
    )
  ) {
    catalogueError(
      "Business working hours are invalid."
    );
  }

  return {
    business: {
      ownerUid: businessId,
      published: true,
      acceptingBookings: true
    },
    services: data.services,
    staff: data.staff,
    workingHours: data.workingHours || {}
  };
}

/**
 * Load the catalogue from the server's
 * Firestore database.
 *
 * Never pass a catalogue supplied by
 * the customer's browser to createBooking.
 *
 * This loader must only be used with a
 * trusted Admin SDK database instance.
 */
async function loadTrustedCatalogue({
  db,
  businessId
}) {
  if (
    !db ||
    typeof db.collection !== "function"
  ) {
    catalogueError(
      "Database is unavailable."
    );
  }

  if (!validId(businessId)) {
    catalogueError(
      "Invalid business identifier."
    );
  }

  const reference = db
    .collection("businesses")
    .doc(businessId)
    .collection("catalogue")
    .doc("current");

  const snapshot = await reference.get();

  if (!snapshot.exists) {
    catalogueError(
      "Business catalogue has not been published."
    );
  }

  return validateCatalogue(
    snapshot.data(),
    businessId
  );
}

module.exports = {
  validateCatalogue,
  loadTrustedCatalogue
};
