"use strict";
// Phase 15.17: bounded stress harness for mock recovery monitoring and alert delivery.
// No production transport, Firestore access, booking writes or customer endpoint.
const {createPersistentRecoveryMonitor}=require("./phase1516PersistentRecoveryMonitor");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const deny=status=>({status,acceptingBookings:false,reservationCreated:false});
function createRecoveryMonitoringStressPreparation(store,snapshotStore,options={}){
 const monitor=createPersistentRecoveryMonitor(store,snapshotStore,options);
 async function inspectBatch(requests){
  if(!Array.isArray(requests)||requests.length<1||requests.length>500
   ||requests.some(x=>!x||typeof x!=="object"))return deny("MONITORING_STRESS_INVALID");
  // Phase 15.16 serializes mock snapshot updates to avoid lost counters.
  const outcomes=await Promise.all(requests.map(async request=>{
   try{return await monitor.inspect(request.input,request.context);}
   catch{return deny("MONITORING_UNAVAILABLE");}
  }));
  return Object.freeze({status:"MONITORING_STRESS_COMPLETE",acceptingBookings:false,
   reservationCreated:false,outcomes});
 }
 return Object.freeze({inspectBatch,inspect:monitor.inspect,
  reserve:async()=>({...DISABLED}),monitoringStatus:monitor.monitoringStatus});
}
module.exports=Object.freeze({createRecoveryMonitoringStressPreparation});
