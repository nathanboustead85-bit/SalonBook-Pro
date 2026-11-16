"use strict";
// Phase 16.17: bounded, read-only recovery-monitor stress rehearsal.
// Sequential batches ensure this wrapper does not amplify parallel read load.
const {createRecoveryFailureMonitor}=require("./phase1616RecoveryFailureMonitor");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const MAX_BATCHES=20,MAX_TOTAL=2000;
function createRecoveryMonitoringStress({secret,readConsistentPair}={}){
 const monitor=createRecoveryFailureMonitor({secret,readConsistentPair});
 async function rehearse(batches){
  if(!Array.isArray(batches)||batches.length<1||batches.length>MAX_BATCHES||
     batches.some(b=>!Array.isArray(b)||b.length<1||b.length>100)||
     batches.reduce((sum,b)=>sum+b.length,0)>MAX_TOTAL)
   return Object.freeze({status:"STRESS_INPUT_INVALID",acceptingBookings:false,reservationCreated:false});
  let checked=0,inspected=0,throttled=0,uncertainCount=0,highSeverityBatches=0,reviewBatches=0;
  for(const batch of batches){
   let result;
   try{result=await monitor.monitor(batch);}
   catch{return Object.freeze({status:"STRESS_MANUAL_REVIEW_REQUIRED",acceptingBookings:false,reservationCreated:false});}
   if(result.status==="MONITOR_INVALID")
    return Object.freeze({status:"STRESS_MANUAL_REVIEW_REQUIRED",acceptingBookings:false,reservationCreated:false});
   checked+=result.checked;inspected+=result.inspected;throttled+=result.throttled;
   uncertainCount+=result.uncertainCount;
   if(result.severity==="HIGH")highSeverityBatches++;
   else if(result.severity==="REVIEW")reviewBatches++;
  }
  return Object.freeze({
   status:uncertainCount?"STRESS_MANUAL_REVIEW_REQUIRED":"STRESS_READ_ONLY_CLEAR",
   batches:batches.length,checked,inspected,throttled,uncertainCount,
   highSeverityBatches,reviewBatches,acceptingBookings:false,reservationCreated:false
  });
 }
 return Object.freeze({rehearse,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createRecoveryMonitoringStress});
