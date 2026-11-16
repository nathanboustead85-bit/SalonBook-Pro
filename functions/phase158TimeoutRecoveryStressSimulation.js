"use strict";
// Phase 15.8: deterministic timeout and recovery stress rehearsal; in-memory only.
// An uncertain timeout NEVER authorizes another booking attempt.
const {createMultiDeviceRecoverySimulation}=require("./phase155MultiDeviceRecoverySimulation");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const deny=(status,extra={})=>({status,acceptingBookings:false,reservationCreated:false,...extra});
function createTimeoutRecoveryStressSimulation(fixture){
 const shared=createMultiDeviceRecoverySimulation(fixture);
 function attempt(input,{timeoutAt="none"}={}){
  if(!["none","before","after"].includes(timeoutAt))return deny("TIMEOUT_INVALID");
  const device=shared.createDevice();
  if(timeoutAt==="before")return deny("TIMEOUT_OUTCOME_UNCERTAIN");
  const result=device.submit(input,{ackLost:timeoutAt==="after"});
  if(result.status==="MULTI_DEVICE_OUTCOME_UNCERTAIN")
   return deny("TIMEOUT_OUTCOME_UNCERTAIN");
  return result;
 }
 function recover(input,{offline=false}={}){
  const result=shared.createDevice().inspect(input,{offline});
  if(result.status==="MULTI_DEVICE_SIMULATED_OUTCOME_RECOVERED")
   return deny("TIMEOUT_SIMULATED_OUTCOME_RECOVERED",{replayed:true});
  if(result.status==="MULTI_DEVICE_KEY_REUSED")
   return deny("TIMEOUT_KEY_REUSED");
  // Absence, network failure, and invalid data must not authorize retries.
  return deny("TIMEOUT_OUTCOME_UNCERTAIN");
 }
 function stress(requests,{timeoutAt="after"}={}){
  if(!Array.isArray(requests)||requests.length<1||requests.length>100)
   return deny("TIMEOUT_INVALID");
  const outcomes=[];
  for(const input of requests){
   const first=attempt(input,{timeoutAt});
   const recovery=recover(input);
   outcomes.push({first:first.status,recovery:recovery.status});
  }
  return deny("TIMEOUT_STRESS_COMPLETE",{outcomes});
 }
 return Object.freeze({attempt,recover,stress,read:shared.read,
  markerCount:shared.markerCount,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createTimeoutRecoveryStressSimulation});
