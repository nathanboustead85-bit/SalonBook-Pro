"use strict";
// Phase 15.10: read-only consistency checks against injected recovery + reservation snapshots.
// This is an isolated mock contract, NOT a production booking or Firestore endpoint.
const {timingSafeEqual}=require("node:crypto");
const {prepareBookingStoragePlan}=require("./phase151BookingInfrastructurePreparation");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const HEX=/^[a-f0-9]{64}$/;
const deny=status=>({status,acceptingBookings:false,reservationCreated:false});
function equal(a,b){return typeof a==="string"&&typeof b==="string"&&HEX.test(a)&&HEX.test(b)
 &&timingSafeEqual(Buffer.from(a,"hex"),Buffer.from(b,"hex"));}
function createRecoveryConsistencyPreparation(store,{clock=()=>Date.now(),maxAgeMs=7*86400000}={}){
 if(!store||typeof store.readPair!=="function"||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<1)
  throw new TypeError("Read-only consistent snapshot provider required");
 async function inspect(input){
  const plan=prepareBookingStoragePlan(input);
  if(plan.status!=="BOOKING_STORAGE_PLAN_ONLY")return deny("CONSISTENCY_INVALID");
  try{
   // The injected provider MUST return both documents from one consistent snapshot.
   const pair=await store.readPair(plan.recoveryDocumentPath,plan.bookingCollectionPath);
   if(!pair||pair.consistentSnapshot!==true||!pair.marker||!pair.reservation)
    return deny("CONSISTENCY_UNCERTAIN");
   const {marker,reservation}=pair;
   if(!equal(marker.fingerprint,plan.fingerprint))
    return deny("CONSISTENCY_KEY_REUSED_OR_CORRUPT");
   const now=clock();
   if(!Number.isSafeInteger(now)||now<0||!Number.isSafeInteger(marker.createdAt)
    ||marker.createdAt<0||marker.createdAt>now||now-marker.createdAt>maxAgeMs
    ||marker.state!=="COMMITTED_SIMULATION"
    ||typeof marker.reservationId!=="string"||!HEX.test(marker.reservationId)
    ||!equal(reservation.id,marker.reservationId)
    ||!equal(reservation.requestId,plan.requestId)
    ||!equal(reservation.fingerprint,plan.fingerprint)
    ||reservation.state!=="COMMITTED_SIMULATION"
    ||reservation.ownerId!==plan.ownerId)
    return deny("CONSISTENCY_UNCERTAIN");
   return deny("CONSISTENCY_SIMULATED_PAIR_VERIFIED");
  }catch{return deny("CONSISTENCY_UNCERTAIN");}
 }
 return Object.freeze({inspect,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createRecoveryConsistencyPreparation});
