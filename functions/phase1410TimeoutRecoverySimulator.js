"use strict";
// Phase 14.10: timeout and recovery rehearsal, entirely in memory.
// Not a Firebase endpoint; no Firestore reads/writes or customer activation.
const {createIdempotencySimulator,canonical}=require("./phase149IdempotencySimulator");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const KEY=/^[A-Za-z0-9_-]{8,128}$/;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
function createTimeoutRecoverySimulator(config){
 const engine=createIdempotencySimulator(config);
 const outcomes=new Map();
 const response=(status,extra={})=>({status,acceptingBookings:false,reservationCreated:false,...extra});
 const identity=(owner,key,intent)=>{
  if(typeof owner!=="string"||!UID.test(owner)||typeof key!=="string"||!KEY.test(key))return null;
  const payload=canonical(intent);
  return payload===null?null:{scope:JSON.stringify([owner,key]),payload};
 };
 function request(owner,key,intent,{timeoutAt=null,simulateFailure=false}={}){
  const id=identity(owner,key,intent);
  if(!id)return response("RECOVERY_REQUEST_INVALID");
  const prior=outcomes.get(id.scope);
  if(prior&&prior.payload!==id.payload)return response("IDEMPOTENCY_KEY_REUSED");
  if(timeoutAt==="before"){
   // No execution occurred. Caller may safely retry with the SAME key.
   return response("REQUEST_OUTCOME_UNKNOWN",{retryWithSameKey:true});
  }
  const outcome=engine.submit(owner,key,intent,{simulateFailure});
  if(outcome.status==="SIMULATION_COMMITTED_IN_MEMORY_ONLY"){
   outcomes.set(id.scope,{payload:id.payload,status:outcome.status});
  }
  if(timeoutAt==="after"){
   // Response was lost after simulated commit; never assume failure.
   return response("REQUEST_OUTCOME_UNKNOWN",{retryWithSameKey:true});
  }
  return response(outcome.status,{replayed:outcome.replayed});
 }
 function recover(owner,key,intent){
  const id=identity(owner,key,intent);
  if(!id)return response("RECOVERY_REQUEST_INVALID");
  const prior=outcomes.get(id.scope);
  if(!prior)return response("RECOVERY_NOT_FOUND",{retryWithSameKey:true});
  if(prior.payload!==id.payload)return response("IDEMPOTENCY_KEY_REUSED");
  return response("SIMULATION_PREVIOUS_OUTCOME_FOUND",{simulatedOutcome:prior.status});
 }
 return Object.freeze({request,recover,read:engine.read,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createTimeoutRecoverySimulator});
