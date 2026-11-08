"use strict";
/**
 * Phase 10.20 — trusted booking-mode initialization, NOT deployed.
 * No public endpoint, no automatic execution.
 * This writes ONLY the bookingMode document, and only in a transaction
 * after verifying the independently archived 10-booking snapshot.
 */
const {checkArchive}=require("./testBookingCleanupPlan");
const {digestBookings}=require("./finalBookingSyncVerifier");
const {MODES,MIGRATION_ID}=require("./bookingMode");
const ID=/^[A-Za-z0-9_-]{1,100}$/;
const APPROVAL="INITIALISE_LEGACY_BOOKING_MODE_ONLY";
function fail(message){const e=new Error(message);e.code="legacy-initialization-blocked";throw e;}
async function initialiseArchivedLegacyMode({
 db,businessId,authenticatedUid,archive,approval,executionEnabled=false
}){
 if(executionEnabled!==true)fail("Execution disabled by default");
 if(approval!==APPROVAL)fail("Separate explicit approval required");
 if(!ID.test(businessId||"")||businessId!==authenticatedUid)fail("Owner mismatch");
 const verified=checkArchive(archive);
 if(!verified)fail("Verified ten-booking archive required");
 if(!db||typeof db.collection!=="function"||typeof db.runTransaction!=="function")
  fail("Trusted Firestore required");
 const business=db.collection("businesses").doc(businessId);
 const mode=business.collection("settings").doc("bookingMode");
 const marker=business.collection("migrations").doc(MIGRATION_ID);
 const source=db.collection("users").doc(businessId).collection("liveData").doc("bookings");
 const appointments=business.collection("appointments");
 const locks=business.collection("bookingLocks");
 return db.runTransaction(async tx=>{
  const [modeSnap,markerSnap,sourceSnap,appointmentsSnap,locksSnap]=await Promise.all([
   tx.get(mode),tx.get(marker),tx.get(source),tx.get(appointments),tx.get(locks)
  ]);
  if(modeSnap.exists)fail("Booking mode already initialised");
  if(markerSnap.exists)fail("Migration already started");
  if(!appointmentsSnap.empty||!locksSnap.empty)fail("Shared calendar is not empty");
  if(!sourceSnap.exists||sourceSnap.data()?.schemaVersion!==1||
     typeof sourceSnap.data()?.json!=="string")fail("Invalid legacy booking source");
  const json=sourceSnap.data().json;
  let bookings;
  try{bookings=JSON.parse(json);}catch(_){fail("Malformed booking JSON");}
  if(!Array.isArray(bookings)||bookings.length!==10||
     digestBookings(json)!==verified.hash)fail("Cloud bookings differ from archive");
  tx.create(mode,{mode:MODES.LEGACY,schemaVersion:1,updatedAt:new Date()});
  return {initialized:true,mode:MODES.LEGACY,bookingCount:10,
   archiveHash:verified.hash,scope:"bookingMode document only",cleanupPerformed:false};
 });
}
module.exports={initialiseArchivedLegacyMode,APPROVAL};
