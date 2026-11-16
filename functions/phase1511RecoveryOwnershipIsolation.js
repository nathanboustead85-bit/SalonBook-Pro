"use strict";
// Phase 15.11: ownership isolation for read-only mock recovery inspection.
// Authorization must be supplied by trusted server context, never from the request.
const {createRecoveryConsistencyPreparation}=require("./phase1510RecoveryConsistencyPreparation");
const {prepareBookingStoragePlan}=require("./phase151BookingInfrastructurePreparation");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const OWNER=/^[A-Za-z0-9_-]{1,128}$/;
const deny=status=>({status,acceptingBookings:false,reservationCreated:false});
function createRecoveryOwnershipIsolation(store,{clock,maxAgeMs}={}){
 if(!store||typeof store.readPair!=="function")throw new TypeError("Read-only store required");
 const consistency=createRecoveryConsistencyPreparation(store,{clock,maxAgeMs});
 async function inspect(input,context){
  // Fail closed unless a trusted, verified owner principal is explicitly provided.
  if(!context||context.trustedServerContext!==true
   ||context.emailVerified!==true
   ||typeof context.ownerId!=="string"||!OWNER.test(context.ownerId))
   return deny("OWNERSHIP_UNAUTHORIZED");
  const plan=prepareBookingStoragePlan(input);
  if(plan.status!=="BOOKING_STORAGE_PLAN_ONLY")return deny("OWNERSHIP_INVALID");
  if(context.ownerId!==plan.ownerId)return deny("OWNERSHIP_FORBIDDEN");
  const result=await consistency.inspect(input);
  if(result.status==="CONSISTENCY_SIMULATED_PAIR_VERIFIED")
   return deny("OWNERSHIP_SIMULATED_PAIR_VERIFIED");
  if(result.status==="CONSISTENCY_KEY_REUSED_OR_CORRUPT")
   return deny("OWNERSHIP_KEY_REUSED_OR_CORRUPT");
  return deny("OWNERSHIP_UNCERTAIN");
 }
 return Object.freeze({inspect,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createRecoveryOwnershipIsolation});
