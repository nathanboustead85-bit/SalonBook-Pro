"use strict";
// Phase 15.3: entirely in-memory rehearsal of an atomic booking + request marker.
// No Firebase imports, no production endpoints and no real appointment writes.
const {prepareBookingStoragePlan}=require("./phase151BookingInfrastructurePreparation");
const {checkExclusions}=require("./phase143BookingExclusions");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const clone=value=>JSON.parse(JSON.stringify(value));
function createAtomicBookingSimulation({catalogue,schedules,bookings}){
 if(!catalogue||!Array.isArray(bookings))throw new TypeError("Simulation fixture required");
 let state=clone(bookings),version=0;
 const requests=new Map();
 const deny=(status,replayed=false)=>({status,replayed,acceptingBookings:false,reservationCreated:false});
 function read(){return {version,bookings:clone(state),requestCount:requests.size};}
 function prepare(input){
  const plan=prepareBookingStoragePlan(input);
  if(plan.status!=="BOOKING_STORAGE_PLAN_ONLY")return {status:"SIMULATION_INVALID"};
  return {status:"SIMULATION_PLAN_ONLY",version,plan,intent:clone(input.intent)};
 }
 function commit(prepared,{simulateFailure=false}={}){
  if(!prepared||prepared.status!=="SIMULATION_PLAN_ONLY"||!prepared.plan
   ||!Number.isSafeInteger(prepared.version)||!prepared.intent)
   return deny("SIMULATION_INVALID");
  const {plan,intent}=prepared;
  const scope=plan.ownerId+":"+plan.requestId;
  const previous=requests.get(scope);
  if(previous){
   return previous.fingerprint===plan.fingerprint
    ?deny("SIMULATION_PREVIOUS_OUTCOME_FOUND",true)
    :deny("SIMULATION_IDEMPOTENCY_KEY_REUSED");
  }
  if(prepared.version!==version)return deny("SIMULATION_RETRY_REQUIRED");
  const checked=checkExclusions(intent,catalogue,schedules,state);
  if(checked.status!=="NO_KNOWN_CONFLICTS_ONLY")return deny(checked.status);
  const service=catalogue.services.find(s=>s.id===intent.serviceId);
  if(!service||!Number.isSafeInteger(service.durationMinutes)||service.durationMinutes<1)
   return deny("SIMULATION_INVALID");
  // Stage both changes first; publish both together only on successful commit.
  const nextBookings=clone(state);
  nextBookings.push({staffId:intent.staffId,date:intent.date,time:intent.time,
   durationMinutes:service.durationMinutes,status:"confirmed"});
  const marker={fingerprint:plan.fingerprint,status:"SIMULATION_ATOMIC_COMMIT_ONLY"};
  if(simulateFailure)return deny("SIMULATION_ATOMIC_ROLLBACK");
  state=nextBookings;
  requests.set(scope,marker);
  version++;
  return deny(marker.status);
 }
 return Object.freeze({
  read,prepare,commit,
  submit(input,options){return commit(prepare(input),options);},
  reserve:async()=>({...DISABLED})
 });
}
module.exports=Object.freeze({createAtomicBookingSimulation});
