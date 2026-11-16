"use strict";
// Phase 15.14: privacy-minimal, in-memory audit preparation for mock recovery.
// No production logging, Firestore writes, customer identifiers or booking endpoints.
const {createRecoveryOwnershipIsolation}=require("./phase1511RecoveryOwnershipIsolation");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const ALLOWED=new Set(["OWNERSHIP_UNAUTHORIZED","OWNERSHIP_FORBIDDEN","OWNERSHIP_INVALID",
 "OWNERSHIP_KEY_REUSED_OR_CORRUPT","OWNERSHIP_UNCERTAIN","OWNERSHIP_SIMULATED_PAIR_VERIFIED"]);
const deny=status=>({status,acceptingBookings:false,reservationCreated:false});
function createRecoveryAuditPreparation(store,{clock=()=>Date.now(),maxAgeMs,emit=()=>{}}={}){
 if(typeof emit!=="function")throw new TypeError("Audit sink must be a function");
 const recovery=createRecoveryOwnershipIsolation(store,{clock,maxAgeMs});
 const counters=new Map();
 async function inspect(input,context){
  let result;
  try{result=await recovery.inspect(input,context);}
  catch{result=deny("OWNERSHIP_UNCERTAIN");}
  const status=ALLOWED.has(result?.status)?result.status:"OWNERSHIP_UNCERTAIN";
  const category=status==="OWNERSHIP_SIMULATED_PAIR_VERIFIED"?"recovered":
   status==="OWNERSHIP_FORBIDDEN"||status==="OWNERSHIP_UNAUTHORIZED"?"access_denied":
   status==="OWNERSHIP_KEY_REUSED_OR_CORRUPT"?"integrity_alert":"uncertain";
  const event=Object.freeze({type:"recovery_inspection",category,status,
   acceptingBookings:false,reservationCreated:false});
  counters.set(category,(counters.get(category)||0)+1);
  // Never pass request, owner, key, fingerprint, customer data, or raw error to the sink.
  try{await emit(event);}catch{/* audit outage must never authorize a booking */}
  return deny(status);
 }
 function summary(){return Object.freeze(Object.fromEntries(counters));}
 return Object.freeze({inspect,summary,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createRecoveryAuditPreparation});
