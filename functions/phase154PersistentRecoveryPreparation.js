"use strict";
// Phase 15.4: read-only durable Firestore recovery inspection preparation.
// No endpoint, no marker creation and no booking writes.
const {timingSafeEqual}=require("node:crypto");
const {prepareBookingStoragePlan}=require("./phase151BookingInfrastructurePreparation");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const MAX_AGE_MS=7*24*60*60*1000;
const HEX=/^[a-f0-9]{64}$/;
const deny=status=>({status,acceptingBookings:false,reservationCreated:false});
function equalDigest(a,b){
 return typeof a==="string"&&typeof b==="string"&&HEX.test(a)&&HEX.test(b)
  &&timingSafeEqual(Buffer.from(a,"hex"),Buffer.from(b,"hex"));
}
function createPersistentRecoveryPreparation(db,{clock=()=>Date.now()}={}){
 if(!db||typeof db.collection!=="function"||typeof db.runTransaction!=="function")
  throw new TypeError("Firestore transaction interface required");
 async function inspect(input){
  const plan=prepareBookingStoragePlan(input);
  if(plan.status!=="BOOKING_STORAGE_PLAN_ONLY")return deny("RECOVERY_REQUEST_INVALID");
  try{
   const owner=db.collection("users").doc(plan.ownerId);
   const ref=owner.collection("customerBookingRequests").doc(plan.requestId);
   return await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    if(!snap||typeof snap.exists!=="boolean")return deny("RECOVERY_OUTCOME_UNCERTAIN");
    if(!snap.exists)return deny("RECOVERY_NOT_FOUND_RETRY_NOT_AUTHORIZED");
    if(typeof snap.get!=="function")return deny("RECOVERY_OUTCOME_UNCERTAIN");
    if(!equalDigest(snap.get("fingerprint"),plan.fingerprint))
     return deny("RECOVERY_KEY_REUSED_OR_CORRUPT");
    const createdAt=snap.get("createdAt");
    const now=clock();
    if(!Number.isSafeInteger(now)||now<0||!Number.isSafeInteger(createdAt)
     ||createdAt<0||createdAt>now||now-createdAt>MAX_AGE_MS)
     return deny("RECOVERY_OUTCOME_UNCERTAIN");
    // This phase recognizes simulation markers only. Never assert a real booking.
    if(snap.get("state")!=="COMMITTED_SIMULATION")
     return deny("RECOVERY_OUTCOME_UNCERTAIN");
    return deny("RECOVERY_SIMULATED_OUTCOME_FOUND");
   },{maxAttempts:3,readOnly:true});
  }catch{return deny("RECOVERY_OUTCOME_UNCERTAIN");}
 }
 return Object.freeze({inspect,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createPersistentRecoveryPreparation,MAX_AGE_MS});
