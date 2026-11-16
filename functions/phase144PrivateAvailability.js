"use strict";
// Phase 14.4 — private, server-side availability preflight.
// Never expose private booking/staff records; never write or enable booking.
// This is NOT a public HTTP handler or a transaction-safe reservation.
const {parseDocument}=require("./phase1320OwnerCataloguePublish");
const {checkExclusions}=require("./phase143BookingExclusions");
const UID=/^[A-Za-z0-9_-]{1,128}$/;
function normalizeBookings(records){
 if(!Array.isArray(records)||records.length>10000)return null;
 const ids=new Set(),result=[];
 for(const b of records){
  if(!b||typeof b!=="object"||Array.isArray(b)||typeof b.id!=="string"||!b.id||ids.has(b.id))return null;
  ids.add(b.id);
  // Android stores duration (not durationMinutes) and no status for active bookings.
  // Missing staff assignment must NOT be interpreted as a free calendar.
  if(typeof b.staffId!=="string"||!b.staffId||typeof b.date!=="string"||typeof b.time!=="string"
   ||!Number.isSafeInteger(b.duration)||b.duration<1)return null;
  result.push({staffId:b.staffId,date:b.date,time:b.time,durationMinutes:b.duration,status:"confirmed"});
 }
 return result;
}
function createPrivateAvailabilityReader(db){
 if(!db||typeof db.collection!=="function")throw new TypeError("Firestore required");
 return async function(ownerId,intent){
  const unavailable=()=>({status:"CLOUD_AVAILABILITY_UNAVAILABLE",acceptingBookings:false});
  if(typeof ownerId!=="string"||!UID.test(ownerId))return unavailable();
  try{
   const owner=db.collection("users").doc(ownerId);
   const [publicDoc,staffDoc,bookingDoc]=await Promise.all([
    db.collection("publicBusinesses").doc(ownerId).get(),
    owner.collection("liveData").doc("staff").get(),
    owner.collection("liveData").doc("bookings").get()
   ]);
   if(!publicDoc.exists||publicDoc.get("businessId")!==ownerId||publicDoc.get("published")!==true
    ||publicDoc.get("acceptingBookings")!==false)return unavailable();
   const services=publicDoc.get("services"),publicStaff=publicDoc.get("staff");
   if(!Array.isArray(services)||!Array.isArray(publicStaff))return unavailable();
   const schedules=parseDocument(staffDoc),legacyBookings=parseDocument(bookingDoc);
   if(!schedules||!legacyBookings)return unavailable();
   const bookings=normalizeBookings(legacyBookings);
   if(!bookings)return unavailable();
   const result=checkExclusions(intent,{services,staff:publicStaff},schedules,bookings);
   // Never disclose owner records, client names, notes, or booking details.
   return {status:result.status,acceptingBookings:false};
  }catch{return unavailable();}
 };
}
module.exports=Object.freeze({normalizeBookings,createPrivateAvailabilityReader});
