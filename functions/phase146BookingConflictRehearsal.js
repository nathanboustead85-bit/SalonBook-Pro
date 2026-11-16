"use strict";
// Phase 14.6: transaction-conflict safety rehearsal only.
// Deliberately NO booking writes, no endpoint, no booking enablement.
// A future live booking operation must recheck AND write atomically, and must
// reconcile legacy Android sync with the same authoritative booking store.
const {parseDocument}=require("./phase1320OwnerCataloguePublish");
const {normalizeBookings}=require("./phase144PrivateAvailability");
const {checkExclusions}=require("./phase143BookingExclusions");
const {fresh,MAX_AGE_MS}=require("./phase145ConsistentAvailability");
const UID=/^[A-Za-z0-9_-]{1,128}$/;
function createBookingConflictRehearsal(db,{clock=()=>Date.now(),maxAgeMs=MAX_AGE_MS}={}){
 if(!db||typeof db.collection!=="function"||typeof db.runTransaction!=="function")throw new TypeError("Firestore transactions required");
 if(!Number.isSafeInteger(maxAgeMs)||maxAgeMs<1||maxAgeMs>MAX_AGE_MS)throw new TypeError("Invalid freshness window");
 return async function(ownerId,intent){
  const deny=status=>({status,acceptingBookings:false,reservationCreated:false});
  if(typeof ownerId!=="string"||!UID.test(ownerId))return deny("BOOKING_REHEARSAL_UNAVAILABLE");
  try{
   const owner=db.collection("users").doc(ownerId);
   const refs=[db.collection("publicBusinesses").doc(ownerId),
    owner.collection("liveData").doc("staff"),
    owner.collection("liveData").doc("bookings")];
   const result=await db.runTransaction(async tx=>{
    // Read all conflict inputs in one transaction. Firestore retries if a
    // document changes during a transaction; each retry rechecks bookings.
    const docs=await Promise.all(refs.map(ref=>tx.get(ref)));
    const now=clock();
    if(!Number.isSafeInteger(now)||docs.some(doc=>!fresh(doc,now,maxAgeMs)))
     return deny("BOOKING_REHEARSAL_STALE");
    const [profile,staffDoc,bookingDoc]=docs;
    if(profile.get("businessId")!==ownerId||profile.get("published")!==true
     ||profile.get("acceptingBookings")!==false)return deny("BOOKING_REHEARSAL_UNAVAILABLE");
    const services=profile.get("services"),staff=profile.get("staff");
    if(!Array.isArray(services)||!Array.isArray(staff))return deny("BOOKING_REHEARSAL_UNAVAILABLE");
    const schedules=parseDocument(staffDoc),legacy=parseDocument(bookingDoc);
    if(!schedules||!legacy)return deny("BOOKING_REHEARSAL_UNAVAILABLE");
    const bookings=normalizeBookings(legacy);
    if(!bookings)return deny("BOOKING_REHEARSAL_UNAVAILABLE");
    const check=checkExclusions(intent,{services,staff},schedules,bookings);
    // A clear preflight is NOT a reservation, even inside a read transaction.
    return deny(check.status==="NO_KNOWN_CONFLICTS_ONLY"
     ?"REHEARSAL_NO_KNOWN_CONFLICTS_ONLY":check.status);
   },{maxAttempts:3,readOnly:true});
   return result&&result.acceptingBookings===false&&result.reservationCreated===false
    ?result:deny("BOOKING_REHEARSAL_UNAVAILABLE");
  }catch{return deny("BOOKING_REHEARSAL_UNAVAILABLE");}
 };
}
module.exports=Object.freeze({createBookingConflictRehearsal});
