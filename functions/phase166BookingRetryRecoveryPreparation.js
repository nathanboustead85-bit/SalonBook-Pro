"use strict";
// Phase 16.6: read-only retry and ambiguous-commit recovery inspection.
// No customer booking endpoint, no writes and no assertion of live availability.
const {timingSafeEqual}=require("node:crypto");
const {prepareBookingStoragePlan}=require("./phase151BookingInfrastructurePreparation");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const HEX=/^[a-f0-9]{64}$/;
const deny=status=>Object.freeze({status,acceptingBookings:false,reservationCreated:false});
function same(a,b){
 return typeof a==="string"&&typeof b==="string"&&HEX.test(a)&&HEX.test(b)
  &&timingSafeEqual(Buffer.from(a,"hex"),Buffer.from(b,"hex"));
}
function createBookingRetryRecoveryPreparation({secret,readConsistentPair}={}){
 if(typeof readConsistentPair!=="function")throw new TypeError("Consistent read-only provider required");
 async function inspect(input){
  const plan=prepareBookingStoragePlan({...input,secret});
  if(plan.status!=="BOOKING_STORAGE_PLAN_ONLY")return deny("RECOVERY_REQUEST_INVALID");
  let pair;
  try{pair=await readConsistentPair({
   ownerId:plan.ownerId,requestId:plan.requestId,
   recoveryDocumentPath:plan.recoveryDocumentPath,
   bookingCollectionPath:plan.bookingCollectionPath
  });}catch{return deny("RECOVERY_READ_UNAVAILABLE");}
  if(!pair||pair.consistentSnapshot!==true)return deny("RECOVERY_SNAPSHOT_UNTRUSTED");
  const marker=pair.marker,reservation=pair.reservation;
  if(!marker&&!reservation)return deny("RECOVERY_NO_PRIOR_REQUEST_ONLY");
  if(!marker||!reservation)return deny("RECOVERY_AMBIGUOUS_REQUIRES_MANUAL_REVIEW");
  if(!same(marker.fingerprint,plan.fingerprint))
   return deny("RECOVERY_IDEMPOTENCY_KEY_REUSED");
  if(!same(marker.requestId,plan.requestId)
   ||!same(reservation.requestId,plan.requestId)
   ||!same(reservation.fingerprint,plan.fingerprint)
   ||!same(marker.reservationId,reservation.id)
   ||marker.ownerId!==plan.ownerId||reservation.ownerId!==plan.ownerId
   ||marker.state!=="COMMITTED_SIMULATION"||reservation.state!=="COMMITTED_SIMULATION")
   return deny("RECOVERY_AMBIGUOUS_REQUIRES_MANUAL_REVIEW");
  return deny("RECOVERY_PRIOR_SIMULATED_COMMIT_VERIFIED");
 }
 return Object.freeze({inspect,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createBookingRetryRecoveryPreparation});
