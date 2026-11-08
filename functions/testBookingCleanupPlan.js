"use strict";
/**
 * Boustio Phase 10.13 — dry-run only.
 * This module NEVER writes to Firestore and cannot delete bookings.
 * No deployed callable or public endpoint.
 */
const { digestBookings } = require("./finalBookingSyncVerifier");
const { MODES, MIGRATION_ID } = require("./bookingMode");
const ID = /^[A-Za-z0-9_-]{1,100}$/;
const HASH = /^[a-f0-9]{64}$/;
const ARCHIVE_TYPE = "boustio-cloud-bookings-readonly";
function blocked(reason) {
  return { safeToPrepare: false, deletionAuthorised: false, readOnly: true, reason };
}
function checkArchive(archive) {
  if (!archive || archive.archiveType !== ARCHIVE_TYPE ||
      archive.schemaVersion !== 1 || archive.bookingCount !== 10 ||
      typeof archive.bookingsJson !== "string" ||
      typeof archive.sourceSha256 !== "string" ||
      !HASH.test(archive.sourceSha256)) return null;
  try {
    const items = JSON.parse(archive.bookingsJson);
    if (!Array.isArray(items) || items.length !== 10 ||
        digestBookings(archive.bookingsJson) !== archive.sourceSha256) return null;
    const ids = items.map(x => x && x.id);
    if (ids.some(x => typeof x !== "string" || !ID.test(x)) ||
        new Set(ids).size !== 10) return null;
    return { count: items.length, hash: archive.sourceSha256 };
  } catch (_) { return null; }
}
async function prepareTestBookingCleanup({db,businessId,authenticatedUid,archive}) {
  if (!ID.test(businessId || "") || businessId !== authenticatedUid) {
    return blocked("Verified owner required");
  }
  if (!db || typeof db.collection !== "function") return blocked("Trusted database required");
  const validated = checkArchive(archive);
  if (!validated) return blocked("Archive is invalid, incomplete or not the expected ten bookings");
  const business = db.collection("businesses").doc(businessId);
  const source = db.collection("users").doc(businessId)
    .collection("liveData").doc("bookings");
  const [sourceSnap, modeSnap, markerSnap, appointmentsSnap, locksSnap] = await Promise.all([
    source.get(),
    business.collection("settings").doc("bookingMode").get(),
    business.collection("migrations").doc(MIGRATION_ID).get(),
    business.collection("appointments").get(),
    business.collection("bookingLocks").get()
  ]);
  if (markerSnap.exists) return blocked("Migration marker exists: cleanup must not proceed");
  const mode = modeSnap.exists ? modeSnap.data()?.mode : null;
  if (mode !== null && mode !== MODES.LEGACY) {
    return blocked("Business is not in legacy booking mode");
  }
  if (!appointmentsSnap.empty || !locksSnap.empty) {
    return blocked("Shared calendar contains appointments or booking locks");
  }
  if (!sourceSnap.exists || sourceSnap.data()?.schemaVersion !== 1 ||
      typeof sourceSnap.data()?.json !== "string") {
    return blocked("Cloud booking source missing or unsupported");
  }
  const json = sourceSnap.data().json;
  let count;
  try { count = JSON.parse(json).length; } catch (_) {
    return blocked("Cloud booking JSON invalid");
  }
  if (count !== validated.count || digestBookings(json) !== validated.hash) {
    return blocked("Cloud bookings differ from verified archive");
  }
  return {
    safeToPrepare: true,
    deletionAuthorised: false,
    readOnly: true,
    bookingCount: 10,
    sourceHash: validated.hash,
    sourcePath: "users/{owner}/liveData/bookings",
    cleanupScope: "legacy booking JSON only",
    warning: "No deletion implemented. Re-verify atomically under a future explicit approval; do not overwrite newer data."
  };
}
module.exports = { checkArchive, prepareTestBookingCleanup };
