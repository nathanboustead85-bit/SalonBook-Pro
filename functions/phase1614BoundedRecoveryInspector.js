"use strict";
// Phase 16.14: bounded-concurrency read-only recovery inspection.
// Does not register a Firebase endpoint, write bookings, or enable reservations.
const {createRecoveryConsistencyInspector}=require("./phase1611RecoveryConsistencyInspector");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const MAX_REQUESTS=100;
const MAX_PARALLEL=5;
const VERIFIED="CONSISTENCY_PRIOR_SIMULATED_COMMIT_VERIFIED";
const ABSENT="CONSISTENCY_NO_RECORD_ONLY";
function createBoundedRecoveryInspector({secret,readConsistentPair}={}){
 const inspector=createRecoveryConsistencyInspector({secret,readConsistentPair});
 async function inspectBatch(requests){
  if(!Array.isArray(requests)||requests.length<1||requests.length>MAX_REQUESTS)
   return Object.freeze({status:"BOUNDED_BATCH_INVALID",acceptingBookings:false,reservationCreated:false});
  const outcomes=new Array(requests.length);
  let next=0;
  async function worker(){
   while(next<requests.length){
    const i=next++;
    try{outcomes[i]=(await inspector.inspect(requests[i])).status;}
    catch{outcomes[i]="CONSISTENCY_READ_UNAVAILABLE";}
   }
  }
  await Promise.all(Array.from({length:Math.min(MAX_PARALLEL,requests.length)},()=>worker()));
  const uncertain=outcomes.filter(s=>s!==VERIFIED&&s!==ABSENT).length;
  return Object.freeze({status:uncertain?"BOUNDED_BATCH_MANUAL_REVIEW_REQUIRED":"BOUNDED_BATCH_READ_ONLY_COMPLETE",
   checked:outcomes.length,uncertainCount:uncertain,acceptingBookings:false,reservationCreated:false});
 }
 return Object.freeze({inspectBatch,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createBoundedRecoveryInspector});
