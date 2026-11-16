"use strict";
// Phase 16.12: read-only multi-device recovery audit. No production endpoint or writes.
const {createRecoveryConsistencyInspector}=require("./phase1611RecoveryConsistencyInspector");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const MAX=100;
function createRecoveryBatchAuditor({secret,readConsistentPair}={}){
 const inspector=createRecoveryConsistencyInspector({secret,readConsistentPair});
 async function audit(requests){
  if(!Array.isArray(requests)||requests.length<1||requests.length>MAX)
   return Object.freeze({status:"BATCH_INVALID",acceptingBookings:false,reservationCreated:false});
  const results=[];
  for(const request of requests){
   let outcome;
   try{outcome=await inspector.inspect(request);}
   catch{outcome={status:"CONSISTENCY_READ_UNAVAILABLE"};}
   // Do not disclose request keys, customer data, identifiers, or raw records.
   results.push(outcome.status);
  }
  const safe=results.every(s=>s==="CONSISTENCY_PRIOR_SIMULATED_COMMIT_VERIFIED"||s==="CONSISTENCY_NO_RECORD_ONLY");
  return Object.freeze({status:safe?"BATCH_REVIEW_COMPLETE":"BATCH_MANUAL_REVIEW_REQUIRED",
   checked:results.length,statuses:Object.freeze(results),acceptingBookings:false,reservationCreated:false});
 }
 return Object.freeze({audit,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createRecoveryBatchAuditor});
