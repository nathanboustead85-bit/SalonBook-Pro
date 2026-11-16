"use strict";
// Phase 15.1: production storage layout preparation only.
// This module never creates, updates, deletes or reserves a Firestore document.
const {createHmac}=require("node:crypto");
const {canonical}=require("./phase149IdempotencySimulator");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const ID=/^[A-Za-z0-9_-]{1,128}$/;
const KEY=/^[A-Za-z0-9_-]{8,128}$/;
function digest(secret,value){
 return createHmac("sha256",secret).update(value).digest("hex");
}
function prepareBookingStoragePlan({ownerId,key,intent,secret}={}){
 const unavailable=status=>({status,acceptingBookings:false,reservationCreated:false});
 if(typeof ownerId!=="string"||!ID.test(ownerId)
  ||typeof key!=="string"||!KEY.test(key)
  ||typeof secret!=="string"||Buffer.byteLength(secret,"utf8")<32)
  return unavailable("BOOKING_STORAGE_PLAN_INVALID");
 const payload=canonical(intent);
 if(payload===null)return unavailable("BOOKING_STORAGE_PLAN_INVALID");
 // Domain-separated opaque IDs avoid exposing keys or personal booking details.
 const requestId=digest(secret,"boustio:v1:request:"+JSON.stringify([ownerId,key]));
 const fingerprint=digest(secret,"boustio:v1:intent:"+payload);
 return Object.freeze({
  status:"BOOKING_STORAGE_PLAN_ONLY",acceptingBookings:false,reservationCreated:false,
  ownerId,requestId,fingerprint,
  bookingCollectionPath:"users/"+ownerId+"/customerBookingReservations",
  recoveryDocumentPath:"users/"+ownerId+"/customerBookingRequests/"+requestId,
  atomicityRequirement:"booking and idempotency marker must commit in the SAME Firestore transaction",
  legacyAppointmentsUntouched:true
 });
}
function createBookingInfrastructurePreparation(){
 return Object.freeze({
  plan:prepareBookingStoragePlan,
  reserve:async()=>({...DISABLED})
 });
}
module.exports=Object.freeze({prepareBookingStoragePlan,createBookingInfrastructurePreparation});
