"use strict";
// Phase 16.3: read-only server-side booking validation, no public endpoint or writes.
// A successful check is NOT proof of live availability or a reservation.
const {createOwnerAuthenticationPreparation}=require("./phase162OwnerAuthenticationPreparation");
const {validateBookingIntent}=require("./phase141BookingIntent");
const {checkExclusions}=require("./phase143BookingExclusions");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const deny=status=>Object.freeze({status,acceptingBookings:false,reservationCreated:false});
function createSecureBookingValidation({verifyIdToken,readPrivateProfile,readOwnerSnapshot,secret}={}){
 if(typeof readOwnerSnapshot!=="function")throw new TypeError("Server-owned snapshot reader required");
 const auth=createOwnerAuthenticationPreparation({verifyIdToken,readPrivateProfile,secret});
 async function inspect(input={}){
  // Never accept caller-provided catalogue, schedules, bookings or owner flags.
  const verified=await auth.inspect(input);
  if(verified.status!=="AUTHENTICATED_OWNER_PREPARATION_ONLY")
   return deny(verified.status);
  let snapshot;
  try{snapshot=await readOwnerSnapshot(input.ownerId);}
  catch{return deny("VALIDATION_SNAPSHOT_UNAVAILABLE");}
  if(!snapshot||snapshot.ownerId!==input.ownerId
   ||snapshot.serverRead!==true||snapshot.complete!==true)
   return deny("VALIDATION_SNAPSHOT_UNTRUSTED");
  const intent=validateBookingIntent(input.intent,snapshot.catalogue);
  if(intent.status!=="VALIDATED_INTENT_ONLY")return deny(intent.status);
  const check=checkExclusions(input.intent,snapshot.catalogue,
   snapshot.staffSchedules,snapshot.bookings);
  if(check.status!=="NO_KNOWN_CONFLICTS_ONLY")return deny(check.status);
  return Object.freeze({status:"VALIDATED_SERVER_SNAPSHOT_ONLY",
   acceptingBookings:false,reservationCreated:false,
   ownerId:input.ownerId,serviceId:intent.serviceId,staffId:intent.staffId,
   date:intent.date,time:intent.time,durationMinutes:intent.durationMinutes,
   // This is not authoritative transaction-time availability.
   liveAvailabilityConfirmed:false,legacyAppointmentsUntouched:true});
 }
 return Object.freeze({inspect,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createSecureBookingValidation});
