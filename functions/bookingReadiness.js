"use strict";

/**
 * Boustio customer booking release readiness.
 * This is deliberately a fail-closed preflight, not a public endpoint.
 * All checks must be explicitly evidenced before enabling live bookings.
 */
const REQUIRED = Object.freeze([
  "androidBookingsSynced",
  "sharedConflictLocksVerified",
  "trustedCataloguePublished",
  "migrationVerified",
  "transactionConflictTestsPassed",
  "abuseProtectionEnabled",
  "endToEndBookingVerified"
]);

function assessBookingReadiness(evidence) {
  const checks = evidence && typeof evidence === "object" && !Array.isArray(evidence)
    ? evidence : {};
  const missing = REQUIRED.filter(key => checks[key] !== true);
  return Object.freeze({
    ready: missing.length === 0,
    missing: Object.freeze(missing),
    checked: REQUIRED.length
  });
}

function requireBookingReadiness(evidence) {
  const result = assessBookingReadiness(evidence);
  if (!result.ready) {
    const error = new Error("Public bookings remain disabled until all release checks pass.");
    error.code = "booking-release-blocked";
    error.missing = result.missing;
    throw error;
  }
  return true;
}

module.exports = { REQUIRED, assessBookingReadiness, requireBookingReadiness };
