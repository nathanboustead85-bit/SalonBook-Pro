"use strict";
// Phase 15.9: restart-persistent *mock* marker store, never production Firestore.
// Recovery is inspection-only; missing/corrupt/uncertain records never permit retries.
const {timingSafeEqual}=require("node:crypto");
const {prepareBookingStoragePlan}=require("./phase151BookingInfrastructurePreparation");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const HEX=/^[0-9a-f]{64}$/;
const deny=(status,extra={})=>({status,acceptingBookings:false,reservationCreated:false,...extra});
function createRestartRecoveryPreparation(store,{clock=()=>Date.now(),maxAgeMs=7*86400000}={}){
 if(!store||typeof store.get!=="function"||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<1)
  throw new TypeError("Read-only marker store and valid age required");
 async function inspect(input){
  const plan=prepareBookingStoragePlan(input);
  if(plan.status!=="BOOKING_STORAGE_PLAN_ONLY")return deny("RESTART_INVALID");
  try{
   const marker=await store.get(plan.recoveryDocumentPath);
   if(marker==null)return deny("RESTART_OUTCOME_UNCERTAIN");
   if(!marker||typeof marker!=="object"||typeof marker.fingerprint!=="string"
    ||!HEX.test(marker.fingerprint))return deny("RESTART_OUTCOME_UNCERTAIN");
   if(!timingSafeEqual(Buffer.from(marker.fingerprint,"hex"),Buffer.from(plan.fingerprint,"hex")))
    return deny("RESTART_KEY_REUSED_OR_CORRUPT");
   const now=clock();
   if(!Number.isSafeInteger(now)||now<0||!Number.isSafeInteger(marker.createdAt)
    ||marker.createdAt<0||marker.createdAt>now||now-marker.createdAt>maxAgeMs
    ||marker.state!=="COMMITTED_SIMULATION")
    return deny("RESTART_OUTCOME_UNCERTAIN");
   return deny("RESTART_SIMULATED_OUTCOME_RECOVERED",{replayed:true});
  }catch{return deny("RESTART_OUTCOME_UNCERTAIN");}
 }
 return Object.freeze({inspect,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createRestartRecoveryPreparation});
