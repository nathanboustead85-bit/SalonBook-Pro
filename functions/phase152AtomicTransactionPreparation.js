"use strict";
// Phase 15.2: read-only Firestore transaction preparation. NO write or customer endpoint.
// A transaction read is NOT a booking lock and does not prove a free slot.
const {prepareBookingStoragePlan}=require("./phase151BookingInfrastructurePreparation");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const UID=/^[A-Za-z0-9_-]{1,128}$/;
function createAtomicTransactionPreparation(db){
 if(!db||typeof db.collection!=="function"||typeof db.runTransaction!=="function")
  throw new TypeError("Firestore transaction interface required");
 async function inspect(input){
  const deny=status=>({status,acceptingBookings:false,reservationCreated:false});
  const plan=prepareBookingStoragePlan(input);
  if(plan.status!=="BOOKING_STORAGE_PLAN_ONLY")return deny("ATOMIC_PREPARATION_INVALID");
  try{
   const owner=db.collection("users").doc(plan.ownerId);
   const refs=[
    db.collection("publicBusinesses").doc(plan.ownerId),
    owner.collection("liveData").doc("staff"),
    owner.collection("liveData").doc("bookings"),
    owner.collection("customerBookingRequests").doc(plan.requestId)
   ];
   // All reads happen in one read-only transaction; no writes are permitted.
   const result=await db.runTransaction(async tx=>{
    const docs=[];
    // Sequential reads support Firestore SDK transaction constraints.
    for(const ref of refs)docs.push(await tx.get(ref));
    if(docs.some(d=>!d||typeof d.exists!=="boolean"))return deny("ATOMIC_PREPARATION_UNAVAILABLE");
    const [catalogue,staff,bookings,request]=docs;
    if(!catalogue.exists||!staff.exists||!bookings.exists)
     return deny("ATOMIC_PREPARATION_UNAVAILABLE");
    if(catalogue.get("businessId")!==plan.ownerId||catalogue.get("published")!==true
     ||catalogue.get("acceptingBookings")!==false)
     return deny("ATOMIC_PREPARATION_UNAVAILABLE");
    if(request.exists)return deny("ATOMIC_PREPARATION_EXISTING_REQUEST_REQUIRES_RECOVERY");
    return deny("ATOMIC_PREPARATION_READ_ONLY");
   },{maxAttempts:3,readOnly:true});
   return result&&result.acceptingBookings===false&&result.reservationCreated===false
    ?result:deny("ATOMIC_PREPARATION_UNAVAILABLE");
  }catch{return deny("ATOMIC_PREPARATION_UNAVAILABLE");}
 }
 return Object.freeze({inspect,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createAtomicTransactionPreparation});
