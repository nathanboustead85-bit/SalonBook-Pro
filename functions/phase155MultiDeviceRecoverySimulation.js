"use strict";
// Phase 15.5: shared-memory multi-device retry/recovery rehearsal only.
// No Firestore access, deployed endpoint or customer booking writes.
const {createAtomicBookingSimulation}=require("./phase153AtomicBookingSimulation");
const {prepareBookingStoragePlan}=require("./phase151BookingInfrastructurePreparation");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const deny=(status,extra={})=>({status,acceptingBookings:false,reservationCreated:false,...extra});
function createMultiDeviceRecoverySimulation({catalogue,schedules,bookings}){
 const engine=createAtomicBookingSimulation({catalogue,schedules,bookings});
 const outcomes=new Map();
 const identity=input=>{
  const plan=prepareBookingStoragePlan(input);
  return plan.status==="BOOKING_STORAGE_PLAN_ONLY"?plan:null;
 };
 function createDevice(){
  function inspect(input,{offline=false}={}){
   const plan=identity(input);
   if(!plan)return deny("MULTI_DEVICE_INVALID");
   if(offline)return deny("MULTI_DEVICE_OUTCOME_UNCERTAIN");
   const marker=outcomes.get(plan.ownerId+":"+plan.requestId);
   if(!marker)return deny("MULTI_DEVICE_NOT_FOUND_RETRY_NOT_AUTHORIZED");
   if(marker.fingerprint!==plan.fingerprint)return deny("MULTI_DEVICE_KEY_REUSED");
   return deny("MULTI_DEVICE_SIMULATED_OUTCOME_RECOVERED",{replayed:true});
  }
  function prepare(input){return engine.prepare(input);}
  function commit(prepared,{offline=false,ackLost=false,simulateFailure=false}={}){
   if(offline)return deny("MULTI_DEVICE_OUTCOME_UNCERTAIN");
   if(!prepared||prepared.status!=="SIMULATION_PLAN_ONLY")return deny("MULTI_DEVICE_INVALID");
   const result=engine.commit(prepared,{simulateFailure});
   const {plan}=prepared;
   if(result.status==="SIMULATION_ATOMIC_COMMIT_ONLY"){
    outcomes.set(plan.ownerId+":"+plan.requestId,{fingerprint:plan.fingerprint});
    if(ackLost)return deny("MULTI_DEVICE_OUTCOME_UNCERTAIN");
   }
   return result;
  }
  function submit(input,options){return commit(prepare(input),options);}
  return Object.freeze({inspect,prepare,commit,submit,reserve:async()=>({...DISABLED})});
 }
 return Object.freeze({createDevice,read:engine.read,markerCount:()=>outcomes.size});
}
module.exports=Object.freeze({createMultiDeviceRecoverySimulation});
