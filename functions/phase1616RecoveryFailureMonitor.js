"use strict";
// Phase 16.16: privacy-safe read-only recovery failure monitoring rehearsal.
// Batch-scoped telemetry only; no persistent production alerts or booking writes.
const {createThrottledRecoveryInspector}=require("./phase1615ThrottledRecoveryInspector");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
function createRecoveryFailureMonitor({secret,readConsistentPair}={}){
 const inspector=createThrottledRecoveryInspector({secret,readConsistentPair});
 async function monitor(requests){
  const result=await inspector.inspectBatch(requests);
  if(result.status==="THROTTLE_BATCH_INVALID")
   return Object.freeze({status:"MONITOR_INVALID",acceptingBookings:false,reservationCreated:false});
  const uncertain=result.uncertainCount;
  const severity=uncertain===0?"NONE":uncertain>=5?"HIGH":"REVIEW";
  return Object.freeze({
   status:uncertain===0?"MONITOR_READ_ONLY_CLEAR":"MONITOR_MANUAL_REVIEW_REQUIRED",
   severity,checked:result.checked,inspected:result.inspected,
   throttled:result.throttled,uncertainCount:uncertain,
   acceptingBookings:false,reservationCreated:false
  });
 }
 return Object.freeze({monitor,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createRecoveryFailureMonitor});
