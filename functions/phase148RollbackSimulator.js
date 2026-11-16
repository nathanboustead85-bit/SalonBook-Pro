"use strict";
// Phase 14.8: isolated in-memory simulation of atomic writes and rollback.
// NEVER connects to Firestore. NEVER creates real appointments.
// Real reservation entry point stays hard-disabled in phase147.
const {checkExclusions}=require("./phase143BookingExclusions");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
function clone(value){return JSON.parse(JSON.stringify(value));}
function createRollbackSimulator({catalogue,schedules,bookings}){
 if(!Array.isArray(bookings))throw new TypeError("Simulation bookings required");
 let state=clone(bookings),version=0;
 const read=()=>Object.freeze({version,bookings:clone(state)});
 function prepare(intent){
  const snapshot=read();
  const result=checkExclusions(intent,catalogue,schedules,snapshot.bookings);
  return {version:snapshot.version,intent:clone(intent),status:result.status};
 }
 function commit(plan,{simulateFailure=false}={}){
  const deny=status=>({status,reservationCreated:false,acceptingBookings:false});
  if(!plan||plan.status!=="NO_KNOWN_CONFLICTS_ONLY"
   ||!Number.isSafeInteger(plan.version)||!plan.intent)return deny("SIMULATION_REJECTED");
  // Simulates optimistic transaction compare-and-swap: reject outdated
  // versions and revalidate against the latest complete booking snapshot.
  if(plan.version!==version)return deny("SIMULATION_RETRY_REQUIRED");
  const latest=checkExclusions(plan.intent,catalogue,schedules,state);
  if(latest.status!=="NO_KNOWN_CONFLICTS_ONLY")return deny(latest.status);
  const service=catalogue.services.find(s=>s.id===plan.intent.serviceId);
  if(!service||!Number.isSafeInteger(service.durationMinutes)||service.durationMinutes<1)
   return deny("SIMULATION_REJECTED");
  const next=clone(state);
  next.push({staffId:plan.intent.staffId,date:plan.intent.date,time:plan.intent.time,
   durationMinutes:service.durationMinutes,status:"confirmed"});
  // Any failure before this swap leaves the original state untouched.
  if(simulateFailure)return deny("SIMULATION_ROLLED_BACK");
  state=next;
  version++;
  return deny("SIMULATION_COMMITTED_IN_MEMORY_ONLY");
 }
 return Object.freeze({read,prepare,commit,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createRollbackSimulator});
