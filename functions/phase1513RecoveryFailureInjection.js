"use strict";
// Phase 15.13: deterministic read-only failure injection, mock snapshots only.
// Never retry a reservation after uncertain recovery; no production Firestore access.
const {createRecoveryOwnershipIsolation}=require("./phase1511RecoveryOwnershipIsolation");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const deny=status=>({status,acceptingBookings:false,reservationCreated:false});
function createRecoveryFailureInjection(baseStore,{fault="none",clock,maxAgeMs}={}){
 if(!baseStore||typeof baseStore.readPair!=="function")throw new TypeError("Snapshot provider required");
 const modes=new Set(["none","offline","timeout","interrupted","malformed","torn","stale","storage-error"]);
 if(!modes.has(fault))throw new TypeError("Unknown failure mode");
 let reads=0;
 const injected={async readPair(...args){
  reads++;
  if(fault==="offline")throw Error("simulated offline");
  if(fault==="timeout")throw Error("simulated deadline exceeded");
  if(fault==="interrupted")throw Error("simulated interrupted read");
  if(fault==="storage-error")throw Error("simulated storage exception");
  const pair=await baseStore.readPair(...args);
  if(fault==="malformed")return {consistentSnapshot:true,marker:{},reservation:{}};
  if(fault==="torn")return {...pair,consistentSnapshot:false};
  if(fault==="stale")return {...pair,marker:{...pair?.marker,createdAt:-1}};
  return pair;
 }};
 const recovery=createRecoveryOwnershipIsolation(injected,{clock,maxAgeMs});
 async function inspect(input,context){
  try{return await recovery.inspect(input,context);}
  catch{return deny("FAILURE_OUTCOME_UNCERTAIN");}
 }
 return Object.freeze({inspect,reserve:async()=>({...DISABLED}),readCount:()=>reads});
}
module.exports=Object.freeze({createRecoveryFailureInjection});
