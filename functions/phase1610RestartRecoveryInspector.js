"use strict";
// Phase 16.10: restart-safe read-only recovery contract.
// The injected reader must be a trusted server-side consistent Firestore read.
// This module NEVER writes, reserves, or exposes a callable endpoint.
const {timingSafeEqual}=require("node:crypto");
const {prepareBookingStoragePlan}=require("./phase151BookingInfrastructurePreparation");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const HEX=/^[0-9a-f]{64}$/;
const deny=status=>Object.freeze({status,acceptingBookings:false,reservationCreated:false});
function equal(a,b){
 return typeof a==="string"&&typeof b==="string"&&HEX.test(a)&&HEX.test(b)
  &&timingSafeEqual(Buffer.from(a,"hex"),Buffer.from(b,"hex"));
}
function createRestartRecoveryInspector({secret,readConsistentPair}={}){
 if(typeof readConsistentPair!=="function")throw new TypeError("Trusted consistent reader required");
 async function inspect(input){
  const plan=prepareBookingStoragePlan({...input,secret});
  if(plan.status!=="BOOKING_STORAGE_PLAN_ONLY")return deny("RESTART_REQUEST_INVALID");
  let pair;
  try{
   pair=await readConsistentPair({
    ownerId:plan.ownerId,requestId:plan.requestId,
    recoveryDocumentPath:plan.recoveryDocumentPath,
    bookingCollectionPath:plan.bookingCollectionPath
   });
  }catch{return deny("RESTART_READ_UNAVAILABLE");}
  // A mock's consistentSnapshot flag is a contract, not proof of a real
  // Firestore consistent read. Production adapter verification remains required.
  if(!pair||pair.consistentSnapshot!==true)return deny("RESTART_SNAPSHOT_UNTRUSTED");
  const {marker,reservation}=pair;
  if(!marker&&!reservation)return deny("RESTART_NO_PRIOR_RECORD_ONLY");
  if(!marker||!reservation)return deny("RESTART_PARTIAL_RECORD_MANUAL_REVIEW");
  if(!equal(marker.fingerprint,plan.fingerprint))return deny("RESTART_IDEMPOTENCY_KEY_REUSED");
  if(!equal(marker.requestId,plan.requestId)
   ||!equal(reservation.requestId,plan.requestId)
   ||!equal(reservation.fingerprint,plan.fingerprint)
   ||!equal(marker.reservationId,reservation.id)
   ||marker.ownerId!==plan.ownerId||reservation.ownerId!==plan.ownerId
   ||marker.state!=="COMMITTED_SIMULATION"||reservation.state!=="COMMITTED_SIMULATION")
   return deny("RESTART_RECORD_INCONSISTENT_MANUAL_REVIEW");
  return deny("RESTART_PREVIOUS_SIMULATED_COMMIT_VERIFIED");
 }
 return Object.freeze({inspect,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createRestartRecoveryInspector});
