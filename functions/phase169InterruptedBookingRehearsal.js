"use strict";
// Phase 16.9: isolated lost-response and interrupted-transaction rehearsal.
// No Firebase SDK, live bookings, persistent storage or production writes.
const {createMultiDeviceConflictRehearsal}=require("./phase168MultiDeviceConflictRehearsal");
const {createAtomicIdempotencySafeguards}=require("./phase165AtomicIdempotencySafeguards");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const deny=(status,extra={})=>Object.freeze({status,acceptingBookings:false,reservationCreated:false,...extra});
function createInterruptedBookingRehearsal(config={}){
 const shared=createMultiDeviceConflictRehearsal(config);
 const safeguards=createAtomicIdempotencySafeguards({secret:config.secret});
 const outcomes=new Map();
 let queue=Promise.resolve();
 function request(input,{failure="none"}={}){
  const work=queue.then(async()=>{
   const plan=safeguards.plan(input);
   if(plan.status!=="ATOMIC_IDEMPOTENCY_PLAN_ONLY")return deny("INTERRUPTED_REQUEST_INVALID");
   if(!["none","before","after","outage"].includes(failure))
    return deny("INTERRUPTED_FAILURE_MODE_INVALID");
   const previous=outcomes.get(plan.requestId);
   if(previous&&previous.fingerprint!==plan.fingerprint)
    return deny("INTERRUPTED_KEY_REUSED");
   if(failure==="before")return deny("INTERRUPTED_BEFORE_COMMIT_UNKNOWN",{retrySameKeyOnly:true});
   if(failure==="outage")return deny("INTERRUPTED_BACKEND_UNAVAILABLE",{retrySameKeyOnly:true});
   const result=await shared.attempt(input);
   if(result.status==="DEVICE_SHARED_COMMIT_SIMULATED"){
    outcomes.set(plan.requestId,{fingerprint:plan.fingerprint,state:"COMMITTED_SIMULATION"});
    if(failure==="after")return deny("INTERRUPTED_RESPONSE_LOST_UNKNOWN",{retrySameKeyOnly:true});
    return deny("INTERRUPTED_COMMIT_SIMULATED");
   }
   if(result.status==="DEVICE_IDEMPOTENT_REPLAY"){
    return previous&&previous.fingerprint===plan.fingerprint
     ?deny("INTERRUPTED_PREVIOUS_COMMIT_FOUND")
     :deny("INTERRUPTED_REPLAY_UNCERTAIN");
   }
   if(result.status==="DEVICE_IDEMPOTENCY_MISMATCH")return deny("INTERRUPTED_KEY_REUSED");
   return deny(result.status);
  });
  queue=work.then(()=>undefined,()=>undefined);
  return work;
 }
 function recover(input){
  const plan=safeguards.plan(input);
  if(plan.status!=="ATOMIC_IDEMPOTENCY_PLAN_ONLY")return deny("INTERRUPTED_REQUEST_INVALID");
  const record=outcomes.get(plan.requestId);
  if(!record)return deny("INTERRUPTED_NO_COMMIT_PROVEN_ONLY",{retrySameKeyOnly:true});
  if(record.fingerprint!==plan.fingerprint)return deny("INTERRUPTED_KEY_REUSED");
  return deny("INTERRUPTED_PREVIOUS_COMMIT_FOUND");
 }
 return Object.freeze({request,recover,inspect:shared.inspect,
  reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createInterruptedBookingRehearsal});
