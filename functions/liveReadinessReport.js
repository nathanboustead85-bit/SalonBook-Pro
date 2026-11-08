"use strict";
/**
 * Phase 10.23 — server-side, read-only live readiness report.
 * Inject a trusted, already authenticated Firestore client and a verified archive.
 * Not a callable, not deployed, and never invoked automatically.
 * Report deliberately omits owner ID, booking contents, and customer data.
 */
const {reviewLegacyProductionReadiness}=require("./legacyProductionReadinessReview");
const {digestBookings}=require("./finalBookingSyncVerifier");
const {MIGRATION_ID}=require("./bookingMode");
const ID=/^[A-Za-z0-9_-]{1,100}$/;
function fail(reason){return {ready:false,readOnly:true,productionChangePerformed:false,
 status:"BLOCKED",reason,requiresSeparateProductionApproval:true};}
async function generateLiveReadinessReport({db,businessId,authenticatedUid,archive}){
 if(!ID.test(businessId||"")||businessId!==authenticatedUid)
  return fail("Authenticated owner mismatch");
 if(!db||typeof db.collection!=="function")return fail("Trusted server Firestore required");
 if(!archive||archive.sourcePath!=="users/"+businessId+"/liveData/bookings")
  return fail("Archive does not belong to this business");
 let result;
 try{result=await reviewLegacyProductionReadiness({db,businessId,authenticatedUid,archive});}
 catch(_){return fail("Database verification failed");}
 if(!result.ready)return fail(result.reason||"Read-only preflight failed");
 return {ready:true,readOnly:true,productionChangePerformed:false,
  status:"READ_ONLY_READY",checkedAt:new Date().toISOString(),
  bookingCount:result.bookingCount,archiveSha256:result.archiveHash,
  mode:"NOT_INITIALISED",migrationMarker:"ABSENT",
  sharedAppointments:0,bookingLocks:0,cloudArchiveMatch:true,
  approvalRequired:"Separate, explicit production approval; this report is not approval",
  cautions:["Snapshot only; state may change","Never use this report to skip transactional rechecks",
   "No freeze, deletion, migration or website booking activation authorised"]};
}
module.exports={generateLiveReadinessReport};
