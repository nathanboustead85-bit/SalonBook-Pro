"use strict";
// Phase 17.1: controlled Firestore read-only booking integration diagnostic.
// Not exported as a Firebase endpoint; cannot create or modify appointments.
const {createDisabledAtomicReservation,DISABLED}=require("./phase147DisabledAtomicReservation");
const {prepareBookingStoragePlan}=require("./phase151BookingInfrastructurePreparation");
function createControlledBookingIntegration(db,{secret,clock,maxAgeMs}={}){
 // The underlying inspector uses an explicitly read-only Firestore transaction.
 const inspector=createDisabledAtomicReservation(db,{clock,maxAgeMs});
 async function inspect({ownerId,key,intent}={}){
  const plan=prepareBookingStoragePlan({ownerId,key,intent,secret});
  if(plan.status!=="BOOKING_STORAGE_PLAN_ONLY")
   return Object.freeze({status:"CONTROLLED_INTEGRATION_INVALID",acceptingBookings:false,reservationCreated:false});
  let result;
  try{result=await inspector.inspect(ownerId,intent);}
  catch{return Object.freeze({status:"CONTROLLED_INTEGRATION_REVIEW_REQUIRED",acceptingBookings:false,reservationCreated:false});}
  const prepared=result.status==="ATOMIC_RESERVATION_PREPARED_ONLY";
  return Object.freeze({
   status:prepared?"CONTROLLED_INTEGRATION_READ_ONLY_PREPARED":"CONTROLLED_INTEGRATION_REVIEW_REQUIRED",
   acceptingBookings:false,reservationCreated:false,productionReady:false,
   legacyAppointmentsUntouchedByDiagnostic:true
  });
 }
 return Object.freeze({inspect,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createControlledBookingIntegration});
