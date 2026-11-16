"use strict";
// Phase 14.5: transactionally consistent, read-only snapshot checks.
// A read transaction is not a booking lock. Any future booking write MUST
// independently revalidate availability in its own atomic write transaction.
const {parseDocument}=require("./phase1320OwnerCataloguePublish");
const {normalizeBookings}=require("./phase144PrivateAvailability");
const {checkExclusions}=require("./phase143BookingExclusions");
const UID=/^[A-Za-z0-9_-]{1,128}$/;
const MAX_AGE_MS=5*60*1000;
function snapshotMillis(snapshot){
 if(!snapshot||!snapshot.exists||snapshot.metadata?.fromCache===true)return null;
 const t=snapshot.updateTime;
 if(!t||typeof t.toMillis!=="function")return null;
 const n=t.toMillis();
 return Number.isSafeInteger(n)?n:null;
}
function fresh(snapshot,now,maxAgeMs){
 const ms=snapshotMillis(snapshot);
 return ms!==null&&ms<=now&&now-ms<=maxAgeMs;
}
function createConsistentAvailabilityReader(db,{clock=()=>Date.now(),maxAgeMs=MAX_AGE_MS}={}){
 if(!db||typeof db.collection!=="function"||typeof db.runTransaction!=="function")throw new TypeError("Firestore transactions required");
 if(!Number.isSafeInteger(maxAgeMs)||maxAgeMs<1||maxAgeMs>MAX_AGE_MS)throw new TypeError("Invalid freshness window");
 return async function(ownerId,intent){
  const deny=status=>({status,acceptingBookings:false});
  if(typeof ownerId!=="string"||!UID.test(ownerId))return deny("CLOUD_AVAILABILITY_UNAVAILABLE");
  try{
   const owner=db.collection("users").doc(ownerId);
   const refs=[db.collection("publicBusinesses").doc(ownerId),
    owner.collection("liveData").doc("staff"),
    owner.collection("liveData").doc("bookings")];
   // All reads occur in ONE Firestore transaction; no transaction writes.
   const result=await db.runTransaction(async tx=>{
    const docs=await Promise.all(refs.map(ref=>tx.get(ref)));
    const now=clock();
    if(!Number.isSafeInteger(now)||docs.some(doc=>!fresh(doc,now,maxAgeMs)))
     return deny("CLOUD_SNAPSHOT_STALE");
    const [publicDoc,staffDoc,bookingDoc]=docs;
    if(publicDoc.get("businessId")!==ownerId||publicDoc.get("published")!==true
     ||publicDoc.get("acceptingBookings")!==false)return deny("CLOUD_AVAILABILITY_UNAVAILABLE");
    const services=publicDoc.get("services"),staff=publicDoc.get("staff");
    if(!Array.isArray(services)||!Array.isArray(staff))return deny("CLOUD_AVAILABILITY_UNAVAILABLE");
    const schedules=parseDocument(staffDoc),legacy=parseDocument(bookingDoc);
    if(!schedules||!legacy)return deny("CLOUD_AVAILABILITY_UNAVAILABLE");
    const bookings=normalizeBookings(legacy);
    if(!bookings)return deny("CLOUD_AVAILABILITY_UNAVAILABLE");
    const validation=checkExclusions(intent,{services,staff},schedules,bookings);
    return deny(validation.status);
   },{maxAttempts:3});
   return result&&result.acceptingBookings===false?result:deny("CLOUD_AVAILABILITY_UNAVAILABLE");
  }catch{return deny("CLOUD_AVAILABILITY_UNAVAILABLE");}
 };
}
module.exports=Object.freeze({MAX_AGE_MS,snapshotMillis,fresh,createConsistentAvailabilityReader});
