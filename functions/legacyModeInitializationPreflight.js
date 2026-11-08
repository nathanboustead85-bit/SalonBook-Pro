"use strict";
/**
 * Boustio Phase 10.19 — booking mode initialization preflight.
 * READ ONLY: no writes, no mode initialization, no freeze.
 * No deployed endpoint.
 */
const {digestBookings}=require("./finalBookingSyncVerifier");
const {checkArchive}=require("./testBookingCleanupPlan");
const {MODES,MIGRATION_ID}=require("./bookingMode");
const ID=/^[A-Za-z0-9_-]{1,100}$/;
function blocked(reason){return {ready:false,readOnly:true,initialized:false,frozen:false,reason};}
async function inspectLegacyInitialization({db,businessId,authenticatedUid,archive}){
 if(!ID.test(businessId||"")||businessId!==authenticatedUid)
  return blocked("Owner identity mismatch");
 const checked=checkArchive(archive);
 if(!checked)return blocked("Verified ten-booking archive required");
 if(!db||typeof db.collection!=="function")return blocked("Trusted Firestore required");
 const business=db.collection("businesses").doc(businessId);
 const source=db.collection("users").doc(businessId).collection("liveData").doc("bookings");
 const [mode,marker,bookings,appointments,locks]=await Promise.all([
  business.collection("settings").doc("bookingMode").get(),
  business.collection("migrations").doc(MIGRATION_ID).get(),
  source.get(),business.collection("appointments").get(),
  business.collection("bookingLocks").get()
 ]);
 if(marker.exists)return blocked("Migration marker exists");
 if(!appointments.empty||!locks.empty)return blocked("Shared calendar is not empty");
 if(mode.exists)return blocked("Booking mode already exists; never overwrite");
 if(!bookings.exists||bookings.data()?.schemaVersion!==1||
  typeof bookings.data()?.json!=="string")return blocked("Invalid cloud bookings");
 const json=bookings.data().json;
 let records;
 try{records=JSON.parse(json);}catch(_){return blocked("Invalid cloud JSON");}
 if(!Array.isArray(records)||records.length!==10||digestBookings(json)!==checked.hash)
  return blocked("Cloud data no longer matches archive");
 return {ready:true,readOnly:true,initialized:false,frozen:false,
  proposedMode:MODES.LEGACY,bookingCount:10,sourceHash:checked.hash,
  requiresSeparateProductionApproval:true,
  note:"Review and initialise in a trusted backend transaction only. Recheck source and all guards before writing."};
}
module.exports={inspectLegacyInitialization};
