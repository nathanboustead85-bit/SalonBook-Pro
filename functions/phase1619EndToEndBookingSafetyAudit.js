"use strict";
// Phase 16.19: end-to-end read-only booking safety release rehearsal.
// Never creates a reservation or registers an HTTP/Firebase endpoint.
const {createMultiDeviceRecoveryGuard}=require("./phase1618MultiDeviceRecoveryGuard");
const {createRecoveryMonitoringStress}=require("./phase1617RecoveryMonitoringStress");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
function createEndToEndBookingSafetyAudit({secret,readConsistentPair}={}){
 const guard=createMultiDeviceRecoveryGuard({secret,readConsistentPair});
 const stress=createRecoveryMonitoringStress({secret,readConsistentPair});
 async function audit({requests,batches}={}){
  // Validate both parts before any reads; no partial success on malformed input.
  if(!Array.isArray(requests)||requests.length<1||requests.length>100||
     !Array.isArray(batches)||batches.length<1||batches.length>20||
     batches.some(b=>!Array.isArray(b)||b.length<1||b.length>100)||
     batches.reduce((n,b)=>n+b.length,0)>2000)
   return Object.freeze({status:"END_TO_END_INPUT_INVALID",acceptingBookings:false,reservationCreated:false});
  let recovery,monitoring;
  try{
   recovery=await guard.inspect(requests);
   // Stop immediately on a conflict, invalid request, or uncertain recovery.
   if(recovery.status!=="MULTI_DEVICE_READ_ONLY_CLEAR")
    return Object.freeze({status:"END_TO_END_MANUAL_REVIEW_REQUIRED",stage:"RECOVERY",
     acceptingBookings:false,reservationCreated:false});
   monitoring=await stress.rehearse(batches);
  }catch{
   return Object.freeze({status:"END_TO_END_MANUAL_REVIEW_REQUIRED",stage:"ERROR",
    acceptingBookings:false,reservationCreated:false});
  }
  if(monitoring.status!=="STRESS_READ_ONLY_CLEAR")
   return Object.freeze({status:"END_TO_END_MANUAL_REVIEW_REQUIRED",stage:"MONITORING",
    acceptingBookings:false,reservationCreated:false});
  return Object.freeze({status:"END_TO_END_READ_ONLY_CHECKS_PASSED",checked:recovery.checked+monitoring.checked,
   acceptingBookings:false,reservationCreated:false,legacyAppointmentsUntouched:true});
 }
 return Object.freeze({audit,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createEndToEndBookingSafetyAudit});
