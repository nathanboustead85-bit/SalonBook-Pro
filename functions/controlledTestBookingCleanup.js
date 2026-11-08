"use strict";
/**
 * Phase 10.14: PRIVATE, DISABLED-BY-DEFAULT cleanup mechanism.
 * NOT exported by functions/index.js; no HTTP/callable endpoint.
 * No production execution. Tests use an in-memory fake transaction.
 *
 * Only ever replaces the legacy liveData/bookings JSON with [].
 * Does not delete a Firestore document or touch any other collection.
 */
const {checkArchive} = require("./testBookingCleanupPlan");
const {digestBookings} = require("./finalBookingSyncVerifier");
const {MODES,MIGRATION_ID} = require("./bookingMode");
const ID=/^[A-Za-z0-9_-]{1,100}$/;
const APPROVAL="CLEAR_ONLY_TEN_ARCHIVED_TEST_BOOKINGS";
function fail(message){const e=new Error(message);e.code="test-booking-cleanup-blocked";throw e;}
async function clearArchivedTestBookings({
  db,businessId,authenticatedUid,archive,approval,executionEnabled=false
}){
  // Hard gate: no operation is enabled by default, including in production.
  if(executionEnabled!==true)fail("Cleanup execution is disabled");
  if(approval!==APPROVAL)fail("Explicit cleanup approval missing");
  if(!ID.test(businessId||"")||businessId!==authenticatedUid)fail("Owner mismatch");
  const verified=checkArchive(archive);
  if(!verified)fail("Verified ten-booking archive required");
  if(!db||typeof db.runTransaction!=="function"||typeof db.collection!=="function")
    fail("Trusted Firestore transaction required");
  const business=db.collection("businesses").doc(businessId);
  const source=db.collection("users").doc(businessId).collection("liveData").doc("bookings");
  const mode=business.collection("settings").doc("bookingMode");
  const marker=business.collection("migrations").doc(MIGRATION_ID);
  const appointments=business.collection("appointments");
  const locks=business.collection("bookingLocks");
  return db.runTransaction(async tx=>{
    // All reads inside the same transaction, before the single update.
    const [sourceSnap,modeSnap,markerSnap,appointmentsSnap,locksSnap]=await Promise.all([
      tx.get(source),tx.get(mode),tx.get(marker),tx.get(appointments),tx.get(locks)
    ]);
    if(!modeSnap.exists||modeSnap.data().mode!==MODES.FROZEN)
      fail("Frozen booking mode required to prevent stale device uploads");
    if(markerSnap.exists)fail("Migration marker exists");
    if(!appointmentsSnap.empty||!locksSnap.empty)
      fail("Shared appointments or locks exist");
    if(!sourceSnap.exists||sourceSnap.data().schemaVersion!==1||
       typeof sourceSnap.data().json!=="string")fail("Booking source invalid");
    const raw=sourceSnap.data().json;
    let records;
    try{records=JSON.parse(raw);}catch(_){fail("Booking source malformed");}
    if(!Array.isArray(records)||records.length!==10||
       digestBookings(raw)!==verified.hash)
      fail("Cloud bookings changed since verified archive");
    // Preserve document schema and unrelated fields; do not touch other paths.
    tx.update(source,{json:"[]",schemaVersion:1,updatedAt:new Date()});
    return {cleared:10,sourceHash:verified.hash,scope:"frozen legacy bookings JSON only"};
  });
}
module.exports={clearArchivedTestBookings,APPROVAL};
