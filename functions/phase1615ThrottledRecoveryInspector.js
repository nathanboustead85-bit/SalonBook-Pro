"use strict";
// Phase 16.15: fail-closed, read-only recovery request throttling rehearsal.
// Per-batch only: not a distributed or persistent production rate limiter.
const {createRecoveryConsistencyInspector}=require("./phase1611RecoveryConsistencyInspector");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const MAX_REQUESTS=100, MAX_PER_OWNER=10, MAX_PARALLEL=5;
const VERIFIED="CONSISTENCY_PRIOR_SIMULATED_COMMIT_VERIFIED";
const ABSENT="CONSISTENCY_NO_RECORD_ONLY";
function createThrottledRecoveryInspector({secret,readConsistentPair}={}){
 const inspector=createRecoveryConsistencyInspector({secret,readConsistentPair});
 async function inspectBatch(requests){
  if(!Array.isArray(requests)||requests.length===0||requests.length>MAX_REQUESTS)
   return Object.freeze({status:"THROTTLE_BATCH_INVALID",acceptingBookings:false,reservationCreated:false});
  const counts=new Map(),outcomes=new Array(requests.length),accepted=[];
  for(let i=0;i<requests.length;i++){
   const request=requests[i];
   const owner=request&&typeof request==="object"&&!Array.isArray(request)
     &&typeof request.ownerId==="string"&&request.ownerId.length>0&&request.ownerId.length<=128
     ?request.ownerId:null;
   if(!owner){outcomes[i]="CONSISTENCY_REQUEST_INVALID";continue;}
   const count=(counts.get(owner)||0)+1;
   counts.set(owner,count);
   if(count>MAX_PER_OWNER){outcomes[i]="RECOVERY_THROTTLED";continue;}
   accepted.push(i);
  }
  let cursor=0;
  async function worker(){
   while(cursor<accepted.length){
    const index=accepted[cursor++];
    try{outcomes[index]=(await inspector.inspect(requests[index])).status;}
    catch{outcomes[index]="CONSISTENCY_READ_UNAVAILABLE";}
   }
  }
  await Promise.all(Array.from({length:Math.min(MAX_PARALLEL,accepted.length)},()=>worker()));
  const throttled=outcomes.filter(s=>s==="RECOVERY_THROTTLED").length;
  const uncertain=outcomes.filter(s=>s!==VERIFIED&&s!==ABSENT).length;
  return Object.freeze({
   status:uncertain?"THROTTLE_MANUAL_REVIEW_REQUIRED":"THROTTLE_READ_ONLY_COMPLETE",
   checked:outcomes.length,inspected:accepted.length,throttled,uncertainCount:uncertain,
   acceptingBookings:false,reservationCreated:false
  });
 }
 return Object.freeze({inspectBatch,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createThrottledRecoveryInspector});
