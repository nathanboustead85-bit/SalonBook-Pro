"use strict";
/**
 * Phase 10.17 — production freeze READINESS ONLY.
 * Trusted backend helper, not exported from index.js.
 * Reads server state; never changes booking mode or bookings.
 */
const {checkArchive}=require("./testBookingCleanupPlan");
const {digestBookings}=require("./finalBookingSyncVerifier");
const {MODES,MIGRATION_ID}=require("./bookingMode");
const ID=/^[A-Za-z0-9_-]{1,100}$/;
function stop(reason){return {ready:false,readOnly:true,freezePerformed:false,cleanupPerformed:false,reason};}
async function inspectFreezeReadiness({db,businessId,authenticatedUid,archive}){
 if(!ID.test(businessId||"")||businessId!==authenticatedUid)
  return stop("Owner identity mismatch");
 const verified=checkArchive(archive);
 if(!verified)return stop("Ten-booking archive invalid");
 if(!db||typeof db.collection!=="function")return stop("Trusted database required");
 const business=db.collection("businesses").doc(businessId);
 const source=db.collection("users").doc(businessId).collection("liveData").doc("bookings");
 const [modeSnap,markerSnap,sourceSnap,appointments,locks]=await Promise.all([
  business.collection("settings").doc("bookingMode").get(),
  business.collection("migrations").doc(MIGRATION_ID).get(),
  source.get(),
  business.collection("appointments").get(),
  business.collection("bookingLocks").get()
 ]);
 if(markerSnap.exists)return stop("Migration marker exists");
 if(!appointments.empty||!locks.empty)return stop("Shared calendar contains bookings or locks");
 if(!modeSnap.exists)return stop("Booking mode not initialised; requires separate trusted setup");
 const mode=modeSnap.data()?.mode;
 if(mode!==MODES.LEGACY&&mode!==MODES.FROZEN)return stop("Invalid booking mode for freeze");
 if(!sourceSnap.exists||sourceSnap.data()?.schemaVersion!==1||
  typeof sourceSnap.data()?.json!=="string")return stop("Cloud booking source invalid");
 const raw=sourceSnap.data().json;
 let items;
 try{items=JSON.parse(raw);}catch(_){return stop("Malformed cloud booking JSON");}
 if(!Array.isArray(items)||items.length!==10||digestBookings(raw)!==verified.hash)
  return stop("Cloud bookings changed since archive");
 return {ready:true,readOnly:true,freezePerformed:false,cleanupPerformed:false,
  currentMode:mode,bookingCount:10,sourceHash:verified.hash,
  requiresSeparateApproval:true,
  warnings:[
   "Old Android versions may retain local test bookings.",
   "Freeze blocks legacy booking uploads, including legitimate local booking edits.",
   "Confirm all devices and pending writes before production freeze.",
   "Re-check live Firestore after freezing; do not execute cleanup based on this preview."
  ]};
}
module.exports={inspectFreezeReadiness};
