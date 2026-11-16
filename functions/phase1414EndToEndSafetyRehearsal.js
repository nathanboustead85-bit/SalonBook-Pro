"use strict";
// Phase 14.14: isolated end-to-end rehearsal. No deployed endpoint or cloud writes.
// Storage records are SIMULATED markers only, never evidence of a real reservation.
const {createMultiDeviceConflictSimulator}=require("./phase1413MultiDeviceConflictSimulator");
const {createSecureStoragePreparation}=require("./phase1412SecureStoragePreparation");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
function createEndToEndSafetyRehearsal(config,{adapter,secret,clock}={}){
 const devices=createMultiDeviceConflictSimulator(config);
 const recovery=createSecureStoragePreparation(adapter,{secret,clock});
 const response=(status)=>({status,acceptingBookings:false,reservationCreated:false});
 async function simulate({owner,key,intent,device="customer",simulateFailure=false}){
  // Reconciliation MUST happen before any simulated mutation.
  const previous=await recovery.inspect(owner,key,intent);
  if(previous.status==="SIMULATION_PREVIOUS_OUTCOME_FOUND")return response("SIMULATION_ALREADY_RECORDED");
  if(previous.status!=="SECURE_RECORD_NOT_FOUND")return previous;
  const client=devices.device(device);
  const plan=client.prepare(intent);
  if(plan.status!=="NO_KNOWN_CONFLICTS_ONLY")return response(plan.status);
  const outcome=client.attempt(plan,{simulateFailure});
  if(outcome.status!=="SIMULATION_COMMITTED_IN_MEMORY_ONLY")return outcome;
  // This two-step rehearsal is NOT atomic: a failure here must be treated as unknown.
  const record=await recovery.prepare(owner,key,intent);
  if(record.status!=="SECURE_SIMULATION_RECORD_PREPARED")return response("SIMULATION_OUTCOME_UNCERTAIN");
  return response("SIMULATION_RECORDED_IN_TEST_ONLY");
 }
 return Object.freeze({simulate,recover:recovery.inspect,read:devices.read,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createEndToEndSafetyRehearsal});
