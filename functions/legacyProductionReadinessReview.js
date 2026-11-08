"use strict";
/**
 * Phase 10.22 — read-only production readiness review.
 * No Firebase credentials, production connections, writes, or deployment.
 * This helper is not exported from functions/index.js.
 */
const {checkArchive}=require("./testBookingCleanupPlan");
const {inspectLegacyInitialization}=require("./legacyModeInitializationPreflight");
const ID=/^[A-Za-z0-9_-]{1,100}$/;
function blocked(reason){return {ready:false,readOnly:true,productionChangePerformed:false,reason};}
async function reviewLegacyProductionReadiness({db,businessId,authenticatedUid,archive}){
 if(!ID.test(businessId||"")||businessId!==authenticatedUid)
  return blocked("Authenticated business owner mismatch");
 if(!archive||archive.sourcePath!=="users/"+businessId+"/liveData/bookings")
  return blocked("Archive sourcePath does not match authenticated owner");
 const verified=checkArchive(archive);
 if(!verified)return blocked("Archive hash, count or record IDs invalid");
 if(!db||typeof db.collection!=="function")return blocked("Trusted server database required");
 let preflight;
 try{preflight=await inspectLegacyInitialization({db,businessId,authenticatedUid,archive});}
 catch(_){return blocked("Server database checks failed; fail closed");}
 if(!preflight.ready)return blocked(preflight.reason||"Live database preflight blocked");
 return {
  ready:true,readOnly:true,productionChangePerformed:false,
  bookingCount:verified.count,archiveHash:verified.hash,
  proposedMode:"legacy",requiresSeparateProductionApproval:true,
  checks:["Verified archive owner path","Verified archive integrity",
   "Authenticated owner matches business","No booking mode or migration marker",
   "No shared appointments or locks","Live legacy bookings match archive"],
  warnings:["Read-only snapshot; state may change before execution",
   "Recheck all conditions inside a trusted transaction",
   "Do not freeze or clear legacy bookings as part of initialization",
   "Confirm devices and pending booking uploads before any later freeze"]
 };
}
module.exports={reviewLegacyProductionReadiness};
