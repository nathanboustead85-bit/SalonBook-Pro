"use strict";
// Phase 14.11: persistent-record preparation using an injected test-only adapter.
// No Firestore import, no deployed endpoint, no real booking writes.
const {canonical}=require("./phase149IdempotencySimulator");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const KEY=/^[A-Za-z0-9_-]{8,128}$/;
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const MAX_AGE=7*24*60*60*1000;
function identity(owner,key,intent){
 if(typeof owner!=="string"||!UID.test(owner)||typeof key!=="string"||!KEY.test(key))return null;
 const payload=canonical(intent);
 return payload===null?null:{scope:JSON.stringify([owner,key]),payload};
}
function createRecoveryRecordPreparation(adapter,{clock=()=>Date.now()}={}){
 if(!adapter||typeof adapter.read!=="function"||typeof adapter.createIfAbsent!=="function")
  throw new TypeError("A test-only record adapter is required");
 const response=(status,extra={})=>({status,acceptingBookings:false,reservationCreated:false,...extra});
 async function recover(owner,key,intent){
  const id=identity(owner,key,intent);
  if(!id)return response("RECOVERY_REQUEST_INVALID");
  try{
   const record=await adapter.read(id.scope);
   if(!record)return response("RECOVERY_NOT_FOUND",{retryWithSameKey:true});
   if(record.payload!==id.payload)return response("IDEMPOTENCY_KEY_REUSED");
   if(record.state!=="COMMITTED_SIMULATION"||!Number.isSafeInteger(record.createdAt)
    ||!Number.isSafeInteger(clock())||record.createdAt>clock()
    ||clock()-record.createdAt>MAX_AGE)
    return response("RECOVERY_OUTCOME_UNCERTAIN");
   return response("SIMULATION_PREVIOUS_OUTCOME_FOUND",{simulatedOutcome:"SIMULATION_COMMITTED_IN_MEMORY_ONLY"});
  }catch{return response("RECOVERY_OUTCOME_UNCERTAIN");}
 }
 async function prepareRecord(owner,key,intent){
  const id=identity(owner,key,intent);
  if(!id)return response("RECOVERY_REQUEST_INVALID");
  const now=clock();
  if(!Number.isSafeInteger(now)||now<0)return response("RECOVERY_OUTCOME_UNCERTAIN");
  try{
   // This is a marker for a SIMULATED outcome, never a real booking.
   const created=await adapter.createIfAbsent(id.scope,
    {payload:id.payload,state:"COMMITTED_SIMULATION",createdAt:now});
   if(!created)return recover(owner,key,intent);
   return response("SIMULATION_RECOVERY_RECORD_PREPARED");
  }catch{return response("RECOVERY_OUTCOME_UNCERTAIN");}
 }
 return Object.freeze({recover,prepareRecord,reserve:async()=>({...DISABLED})});
}
function createInMemoryRecoveryAdapter(shared=new Map()){
 return Object.freeze({
  async read(scope){const value=shared.get(scope);return value?{...value}:null;},
  async createIfAbsent(scope,record){
   if(shared.has(scope))return false;
   shared.set(scope,{...record});return true;
  }
 });
}
module.exports=Object.freeze({createRecoveryRecordPreparation,createInMemoryRecoveryAdapter,MAX_AGE});
