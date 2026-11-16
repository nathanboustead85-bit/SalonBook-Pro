"use strict";
// Phase 16.13: read-only recovery resilience rehearsal. No production endpoint or writes.
const {createRecoveryConsistencyInspector}=require("./phase1611RecoveryConsistencyInspector");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const LIMIT=100;
const VERIFIED="CONSISTENCY_PRIOR_SIMULATED_COMMIT_VERIFIED";
const ABSENT="CONSISTENCY_NO_RECORD_ONLY";
function createRecoveryResilienceInspector({secret,readConsistentPair}={}){
 const inspector=createRecoveryConsistencyInspector({secret,readConsistentPair});
 async function rehearse(requests){
  if(!Array.isArray(requests)||requests.length===0||requests.length>LIMIT)
   return Object.freeze({status:"REHEARSAL_INVALID",acceptingBookings:false,reservationCreated:false});
  const statuses=await Promise.all(requests.map(async request=>{
   try{return (await inspector.inspect(request)).status;}
   catch{return "CONSISTENCY_READ_UNAVAILABLE";}
  }));
  const uncertain=statuses.some(s=>s!==VERIFIED&&s!==ABSENT);
  const unique=new Set(statuses);
  // A mixed batch is never evidence that a customer booking succeeded.
  return Object.freeze({
   status:uncertain?"REHEARSAL_MANUAL_REVIEW_REQUIRED":"REHEARSAL_READ_ONLY_COMPLETE",
   checked:statuses.length,uncertainCount:statuses.filter(s=>s!==VERIFIED&&s!==ABSENT).length,
   distinctOutcomes:unique.size,acceptingBookings:false,reservationCreated:false
  });
 }
 return Object.freeze({rehearse,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createRecoveryResilienceInspector});
