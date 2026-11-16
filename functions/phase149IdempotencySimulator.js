"use strict";
// Phase 14.9: deterministic in-memory idempotency rehearsal only.
// No Firestore access, no customer endpoint, no real booking writes.
const {createRollbackSimulator}=require("./phase148RollbackSimulator");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const KEY=/^[A-Za-z0-9_-]{8,128}$/;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
function canonical(intent){
 if(!intent||typeof intent!=="object"||Array.isArray(intent))return null;
 const fields=["serviceId","staffId","date","time"];
 if(fields.some(k=>typeof intent[k]!=="string"||!intent[k]))return null;
 return JSON.stringify(fields.map(k=>intent[k]));
}
function createIdempotencySimulator(config){
 const simulation=createRollbackSimulator(config);
 const ledger=new Map();
 function submit(ownerId,key,intent,{simulateFailure=false}={}){
  const result=(status,replayed=false)=>({status,replayed,acceptingBookings:false,reservationCreated:false});
  if(typeof ownerId!=="string"||!UID.test(ownerId)
   ||typeof key!=="string"||!KEY.test(key))return result("IDEMPOTENCY_KEY_INVALID");
  const payload=canonical(intent);
  if(payload===null)return result("IDEMPOTENCY_REQUEST_INVALID");
  const scoped=ownerId+":"+key;
  const prior=ledger.get(scoped);
  if(prior){
   if(prior.payload!==payload)return result("IDEMPOTENCY_KEY_REUSED");
   return result(prior.status,true);
  }
  const plan=simulation.prepare(intent);
  if(plan.status!=="NO_KNOWN_CONFLICTS_ONLY")return result(plan.status);
  const attempt=simulation.commit(plan,{simulateFailure});
  // Only record committed simulation outcomes. Failures may be retried.
  if(attempt.status==="SIMULATION_COMMITTED_IN_MEMORY_ONLY"){
   ledger.set(scoped,{payload,status:attempt.status});
  }
  return result(attempt.status);
 }
 return Object.freeze({
  submit,read:simulation.read,reserve:async()=>({...DISABLED}),
  ledgerSize:()=>ledger.size
 });
}
module.exports=Object.freeze({createIdempotencySimulator,canonical});
