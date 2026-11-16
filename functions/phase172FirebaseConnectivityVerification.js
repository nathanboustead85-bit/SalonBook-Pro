"use strict";
// Phase 17.2: server-side read-only Firebase connectivity verification.
// No Firebase endpoint, no writes, no booking activation. Never return document data.
const {createControlledBookingIntegration}=require("./phase171ControlledBookingIntegration");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const ID=/^[A-Za-z0-9_-]{1,128}$/;
function createFirebaseConnectivityVerification(db,{secret,clock,maxAgeMs}={}){
 const options={secret};
 if(clock!==undefined)options.clock=clock;
 if(maxAgeMs!==undefined)options.maxAgeMs=maxAgeMs;
 const controlled=createControlledBookingIntegration(db,options);
 async function verify({ownerId,key,intent}={}){
  if(typeof ownerId!=="string"||!ID.test(ownerId))
   return Object.freeze({status:"FIREBASE_VERIFICATION_INVALID",connected:false,acceptingBookings:false,reservationCreated:false});
  let result;
  try{result=await controlled.inspect({ownerId,key,intent});}
  catch{return Object.freeze({status:"FIREBASE_VERIFICATION_REVIEW_REQUIRED",connected:false,acceptingBookings:false,reservationCreated:false});}
  // A successful availability inspection is evidence of readable consistent snapshots,
  // NOT proof of production readiness or ability to write a booking.
  const verified=result.status==="CONTROLLED_INTEGRATION_READ_ONLY_PREPARED";
  return Object.freeze({
   status:verified?"FIREBASE_READ_ONLY_SNAPSHOT_VERIFIED":"FIREBASE_VERIFICATION_REVIEW_REQUIRED",
   snapshotVerified:verified,productionReady:false,acceptingBookings:false,reservationCreated:false
  });
 }
 return Object.freeze({verify,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createFirebaseConnectivityVerification});
