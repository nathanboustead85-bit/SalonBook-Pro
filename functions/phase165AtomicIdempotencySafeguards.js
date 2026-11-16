"use strict";
// Phase 16.5: atomicity/idempotency contract and isolated concurrency rehearsal.
// No Firestore writes, no deployed endpoint and no live customer reservations.
const {prepareBookingStoragePlan}=require("./phase151BookingInfrastructurePreparation");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const {checkExclusions}=require("./phase143BookingExclusions");
const {minuteOfDay}=require("./phase141BookingIntent");
const deny=status=>Object.freeze({status,acceptingBookings:false,reservationCreated:false});
function createAtomicIdempotencySafeguards({secret}={}){
 function plan(input){
  const storage=prepareBookingStoragePlan({...input,secret});
  if(storage.status!=="BOOKING_STORAGE_PLAN_ONLY")return deny("ATOMIC_PLAN_INVALID");
  const start=minuteOfDay(input.intent?.time);
  if(start===null)return deny("ATOMIC_PLAN_INVALID");
  return Object.freeze({status:"ATOMIC_IDEMPOTENCY_PLAN_ONLY",acceptingBookings:false,
   reservationCreated:false,requestId:storage.requestId,fingerprint:storage.fingerprint,
   recoveryDocumentPath:storage.recoveryDocumentPath,
   bookingCollectionPath:storage.bookingCollectionPath,
   requiresSingleAtomicCommit:true,requiresSharedStaffDateGuard:true});
 }
 return Object.freeze({plan,reserve:async()=>({...DISABLED})});
}
// Strictly memory-only test harness; never use as a production reservation adapter.
function createIsolatedAtomicRehearsal({secret,catalogue,staffSchedules,initialBookings=[]}={}){
 if(!Array.isArray(initialBookings))throw new TypeError("Booking fixtures required");
 const safeguards=createAtomicIdempotencySafeguards({secret});
 const bookings=initialBookings.map(x=>({...x}));
 const requests=new Map();
 let queue=Promise.resolve();
 function attempt(input){
  const work=queue.then(()=>{
   const p=safeguards.plan(input);
   if(p.status!=="ATOMIC_IDEMPOTENCY_PLAN_ONLY")return deny(p.status);
   const existing=requests.get(p.requestId);
   if(existing)return deny(existing.fingerprint===p.fingerprint
    ?"REHEARSAL_IDEMPOTENT_REPLAY":"REHEARSAL_IDEMPOTENCY_MISMATCH");
   const checked=checkExclusions(input.intent,catalogue,staffSchedules,bookings);
   if(checked.status!=="NO_KNOWN_CONFLICTS_ONLY")return deny(checked.status);
   // Rehearsal-only atomic state change: both arrays/maps updated in one
   // synchronous critical section, serialized across all simulated requests.
   const record={staffId:input.intent.staffId,date:input.intent.date,
    time:input.intent.time,durationMinutes:checked.durationMinutes,status:"confirmed"};
   bookings.push(record);
   requests.set(p.requestId,{fingerprint:p.fingerprint});
   return deny("REHEARSAL_ATOMIC_COMMIT_SIMULATED");
  });
  queue=work.then(()=>undefined,()=>undefined);
  return work;
 }
 return Object.freeze({attempt,reserve:async()=>({...DISABLED}),
  inspect:()=>Object.freeze({simulatedBookings:bookings.length,requestMarkers:requests.size,
   acceptingBookings:false,productionWrites:0})});
}
module.exports=Object.freeze({createAtomicIdempotencySafeguards,createIsolatedAtomicRehearsal});
