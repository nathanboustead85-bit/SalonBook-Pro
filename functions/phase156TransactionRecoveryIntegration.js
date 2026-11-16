"use strict";
// Phase 15.6: read-only composition of transaction and recovery inspectors.
// Does not reserve slots, authorize retries, or access production Firestore itself.
const {createAtomicTransactionPreparation}=require("./phase152AtomicTransactionPreparation");
const {createPersistentRecoveryPreparation}=require("./phase154PersistentRecoveryPreparation");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const deny=(status,extra={})=>({status,acceptingBookings:false,reservationCreated:false,...extra});
function createTransactionRecoveryIntegration(db,options){
 const atomic=createAtomicTransactionPreparation(db);
 const recovery=createPersistentRecoveryPreparation(db,options);
 async function inspect(input){
  const first=await atomic.inspect(input);
  if(first.status==="ATOMIC_PREPARATION_READ_ONLY")
   return deny("INTEGRATION_READ_ONLY_NO_RESERVATION");
  if(first.status==="ATOMIC_PREPARATION_EXISTING_REQUEST_REQUIRES_RECOVERY"){
   const outcome=await recovery.inspect(input);
   if(outcome.status==="RECOVERY_SIMULATED_OUTCOME_FOUND")
    return deny("INTEGRATION_SIMULATED_OUTCOME_RECOVERED");
   if(outcome.status==="RECOVERY_KEY_REUSED_OR_CORRUPT")
    return deny("INTEGRATION_KEY_REUSED_OR_CORRUPT");
   return deny("INTEGRATION_RECOVERY_UNCERTAIN");
  }
  return deny("INTEGRATION_UNAVAILABLE");
 }
 return Object.freeze({inspect,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createTransactionRecoveryIntegration});
