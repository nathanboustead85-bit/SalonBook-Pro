"use strict";
// Phase 16.8: shared-store multi-device conflict rehearsal, NOT live Firestore.
// Every device uses the same serialized owner-scoped fixture store; independent
// local caches are deliberately ignored. Production booking remains disabled.
const {createAtomicIdempotencySafeguards}=require("./phase165AtomicIdempotencySafeguards");
const {checkExclusions}=require("./phase143BookingExclusions");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const deny=status=>Object.freeze({status,acceptingBookings:false,reservationCreated:false});
function createMultiDeviceConflictRehearsal({secret,catalogue,staffSchedules,initialBookings=[]}={}){
 if(!Array.isArray(initialBookings))throw new TypeError("Booking fixtures required");
 const safeguards=createAtomicIdempotencySafeguards({secret});
 const owners=new Map();
 let queue=Promise.resolve();
 const originalCount=initialBookings.length;
 function state(ownerId){
  if(!owners.has(ownerId))owners.set(ownerId,{
   bookings:initialBookings.map(b=>({...b})),markers:new Map()});
  return owners.get(ownerId);
 }
 function attempt({deviceId,ownerId,key,intent}={}){
  const operation=queue.then(()=>{
   if(typeof deviceId!=="string"||!/^[A-Za-z0-9_-]{1,64}$/.test(deviceId))
    return deny("DEVICE_ID_INVALID");
   const plan=safeguards.plan({ownerId,key,intent});
   if(plan.status!=="ATOMIC_IDEMPOTENCY_PLAN_ONLY")return deny("DEVICE_REQUEST_INVALID");
   const store=state(ownerId);
   const previous=store.markers.get(plan.requestId);
   if(previous)return deny(previous===plan.fingerprint
    ?"DEVICE_IDEMPOTENT_REPLAY":"DEVICE_IDEMPOTENCY_MISMATCH");
   // All devices inspect the same authoritative simulated bookings under one
   // shared critical section; a stale device cache cannot override conflicts.
   const result=checkExclusions(intent,catalogue,staffSchedules,store.bookings);
   if(result.status!=="NO_KNOWN_CONFLICTS_ONLY")return deny(result.status);
   store.bookings.push({staffId:intent.staffId,date:intent.date,time:intent.time,
    durationMinutes:result.durationMinutes,status:"confirmed"});
   store.markers.set(plan.requestId,plan.fingerprint);
   return deny("DEVICE_SHARED_COMMIT_SIMULATED");
  });
  queue=operation.then(()=>undefined,()=>undefined);
  return operation;
 }
 return Object.freeze({attempt,reserve:async()=>({...DISABLED}),
  inspect:ownerId=>{
   const s=state(ownerId);
   return Object.freeze({simulatedBookings:s.bookings.length,
    newSimulatedBookings:s.bookings.length-originalCount,requestMarkers:s.markers.size,
    productionWrites:0,acceptingBookings:false});
  }});
}
module.exports=Object.freeze({createMultiDeviceConflictRehearsal});
