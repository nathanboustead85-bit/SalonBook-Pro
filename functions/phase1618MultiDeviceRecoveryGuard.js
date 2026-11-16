"use strict";
// Phase 16.18: read-only multi-device retry collision rehearsal.
// Detects conflicting intents sharing an owner/idempotency key before any read.
// Not a production distributed lock or a booking endpoint.
const {prepareBookingStoragePlan}=require("./phase151BookingInfrastructurePreparation");
const {createRecoveryFailureMonitor}=require("./phase1616RecoveryFailureMonitor");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
function createMultiDeviceRecoveryGuard({secret,readConsistentPair}={}){
 const monitor=createRecoveryFailureMonitor({secret,readConsistentPair});
 async function inspect(requests){
  if(!Array.isArray(requests)||requests.length<1||requests.length>100)
   return Object.freeze({status:"MULTI_DEVICE_INPUT_INVALID",acceptingBookings:false,reservationCreated:false});
  const seen=new Map();
  let collisions=0,invalid=0;
  for(const request of requests){
   let plan;
   try{plan=prepareBookingStoragePlan({...request,secret});}
   catch{invalid++;continue;}
   if(plan.status!=="BOOKING_STORAGE_PLAN_ONLY"){invalid++;continue;}
   const identity=plan.ownerId+":"+plan.requestId;
   if(seen.has(identity)&&seen.get(identity)!==plan.fingerprint)collisions++;
   else seen.set(identity,plan.fingerprint);
  }
  // A conflicting or malformed request fails the whole rehearsal closed, with no reads.
  if(collisions||invalid)return Object.freeze({
   status:"MULTI_DEVICE_MANUAL_REVIEW_REQUIRED",checked:requests.length,
   collisions,invalid,inspected:0,acceptingBookings:false,reservationCreated:false
  });
  let result;
  try{result=await monitor.monitor(requests);}
  catch{return Object.freeze({status:"MULTI_DEVICE_MANUAL_REVIEW_REQUIRED",checked:requests.length,
   collisions:0,invalid:0,inspected:0,acceptingBookings:false,reservationCreated:false});}
  return Object.freeze({
   status:result.status==="MONITOR_READ_ONLY_CLEAR"?"MULTI_DEVICE_READ_ONLY_CLEAR":"MULTI_DEVICE_MANUAL_REVIEW_REQUIRED",
   checked:requests.length,collisions:0,invalid:0,inspected:result.inspected,
   throttled:result.throttled,uncertainCount:result.uncertainCount,
   acceptingBookings:false,reservationCreated:false
  });
 }
 return Object.freeze({inspect,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createMultiDeviceRecoveryGuard});
