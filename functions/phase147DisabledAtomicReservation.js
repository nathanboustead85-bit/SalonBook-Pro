"use strict";
// Phase 14.7: disabled-by-default atomic reservation preparation.
// NO production write capability, no endpoint, no customer activation.
// Reservation eligibility is a plan only; NEVER a confirmed booking.
const {parseDocument}=require("./phase1320OwnerCataloguePublish");
const {normalizeBookings}=require("./phase144PrivateAvailability");
const {checkExclusions}=require("./phase143BookingExclusions");
const {fresh,MAX_AGE_MS}=require("./phase145ConsistentAvailability");
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const DISABLED=Object.freeze({status:"CUSTOMER_BOOKINGS_DISABLED",acceptingBookings:false,reservationCreated:false});
function assessAtomicReservationSnapshot(ownerId,intent,docs,now,maxAgeMs=MAX_AGE_MS){
 const result=status=>({status,acceptingBookings:false,reservationCreated:false});
 if(typeof ownerId!=="string"||!UID.test(ownerId)||!Array.isArray(docs)||docs.length!==3
  ||!Number.isSafeInteger(now)||docs.some(d=>!fresh(d,now,maxAgeMs)))
  return result("RESERVATION_SNAPSHOT_UNAVAILABLE");
 const [publicDoc,staffDoc,bookingDoc]=docs;
 if(publicDoc.get("businessId")!==ownerId||publicDoc.get("published")!==true
  ||publicDoc.get("acceptingBookings")!==false)return result("RESERVATION_SNAPSHOT_UNAVAILABLE");
 const services=publicDoc.get("services"),staff=publicDoc.get("staff");
 if(!Array.isArray(services)||!Array.isArray(staff))return result("RESERVATION_SNAPSHOT_UNAVAILABLE");
 const schedules=parseDocument(staffDoc),legacy=parseDocument(bookingDoc);
 if(!schedules||!legacy)return result("RESERVATION_SNAPSHOT_UNAVAILABLE");
 const normalized=normalizeBookings(legacy);
 if(!normalized)return result("RESERVATION_SNAPSHOT_UNAVAILABLE");
 const checked=checkExclusions(intent,{services,staff},schedules,normalized);
 return result(checked.status==="NO_KNOWN_CONFLICTS_ONLY"
  ?"ATOMIC_RESERVATION_PREPARED_ONLY":checked.status);
}
function createDisabledAtomicReservation(db,{clock=()=>Date.now(),maxAgeMs=MAX_AGE_MS}={}){
 if(!db||typeof db.collection!=="function"||typeof db.runTransaction!=="function")throw new TypeError("Firestore transactions required");
 if(!Number.isSafeInteger(maxAgeMs)||maxAgeMs<1||maxAgeMs>MAX_AGE_MS)throw new TypeError("Invalid freshness window");
 // Public entry point is intentionally hard-disabled, regardless of flags,
 // input, credentials or caller-provided options. Do not add a bypass here.
 async function reserve(){return {...DISABLED};}
 // Separate server-side diagnostic: read-only transaction with all inputs
 // checked in one snapshot. Not exported as a Firebase function.
 async function inspect(ownerId,intent){
  if(typeof ownerId!=="string"||!UID.test(ownerId))
   return {status:"RESERVATION_SNAPSHOT_UNAVAILABLE",acceptingBookings:false,reservationCreated:false};
  try{
   const owner=db.collection("users").doc(ownerId);
   const refs=[db.collection("publicBusinesses").doc(ownerId),
    owner.collection("liveData").doc("staff"),owner.collection("liveData").doc("bookings")];
   return await db.runTransaction(async tx=>{
    const docs=await Promise.all(refs.map(ref=>tx.get(ref)));
    return assessAtomicReservationSnapshot(ownerId,intent,docs,clock(),maxAgeMs);
   },{maxAttempts:3,readOnly:true});
  }catch{return {status:"RESERVATION_SNAPSHOT_UNAVAILABLE",acceptingBookings:false,reservationCreated:false};}
 }
 return Object.freeze({reserve,inspect});
}
module.exports=Object.freeze({DISABLED,assessAtomicReservationSnapshot,createDisabledAtomicReservation});
