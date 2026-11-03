"use strict";

/**
 * BOUSTIO — PHASE 8C.8
 *
 * Trusted Booking Integration
 *
 * SERVER-SIDE ONLY.
 *
 * This module connects:
 * 1. Public business verification
 * 2. Trusted Firebase catalogue
 * 3. Secure booking engine
 *
 * No HTTP or callable endpoint is created.
 *
 * IMPORTANT:
 * Do not enable live customer bookings
 * until existing Android appointments
 * share the same booking lock system.
 */

const {
  loadTrustedCatalogue
} = require("./trustedCatalogue");

const {
  createBooking
} = require("./bookingEngine");

const ID_PATTERN =
  /^[A-Za-z0-9_-]{1,100}$/;

function bookingError(message) {
  const error = new Error(message);
  error.code = "invalid-booking";
  throw error;
}

function validBusinessId(value) {
  return (
    typeof value === "string" &&
    ID_PATTERN.test(value)
  );
}

/**
 * Create a booking using trusted
 * server-side business information.
 *
 * The Firestore database must be an
 * Admin SDK instance supplied by
 * the trusted backend.
 *
 * The customer cannot supply the
 * catalogue, prices or staff schedules.
 */
async function createTrustedBooking({
  db,
  request,
  catalogueLoader = loadTrustedCatalogue,
  bookingCreator = createBooking
}) {
  if (
    !db ||
    typeof db.collection !== "function" ||
    typeof db.runTransaction !== "function"
  ) {
    bookingError(
      "Database is unavailable."
    );
  }

  if (
    !request ||
    typeof request !== "object" ||
    Array.isArray(request)
  ) {
    bookingError(
      "Invalid booking request."
    );
  }

  const businessId = request.businessId;

  if (!validBusinessId(businessId)) {
    bookingError(
      "Invalid business identifier."
    );
  }

  /**
   * First verify the authoritative
   * public business document.
   */
  const publicRef = db
    .collection("publicBusinesses")
    .doc(businessId);

  const publicSnapshot =
    await publicRef.get();

  if (!publicSnapshot.exists) {
    bookingError(
      "Business is unavailable."
    );
  }

  const publicBusiness =
    publicSnapshot.data();

  if (
    !publicBusiness ||
    publicBusiness.businessId !== businessId ||
    publicBusiness.published !== true ||
    publicBusiness.acceptingBookings !== true
  ) {
    bookingError(
      "Business is not accepting bookings."
    );
  }

  /**
   * Load trusted catalogue from
   * server-side Firestore.
   *
   * Never use request.catalogue.
   */
  const catalogue =
    await catalogueLoader({
      db,
      businessId
    });

  if (
    !catalogue ||
    !catalogue.business ||
    catalogue.business.ownerUid !== businessId ||
    catalogue.business.published !== true ||
    catalogue.business.acceptingBookings !== true
  ) {
    bookingError(
      "Trusted business catalogue is invalid."
    );
  }

  /**
   * Only validated booking fields
   * are passed to the booking engine.
   *
   * Customer-supplied prices and
   * catalogue information are ignored.
   */
  const bookingRequest = {
    businessId,
    serviceId: request.serviceId,
    staffId: request.staffId,
    date: request.date,
    startTime: request.startTime,
    customerName: request.customerName,
    customerEmail: request.customerEmail,
    customerPhone: request.customerPhone
  };

  return bookingCreator({
    db,
    catalogue,
    request: bookingRequest
  });
}

module.exports = {
  createTrustedBooking
};
