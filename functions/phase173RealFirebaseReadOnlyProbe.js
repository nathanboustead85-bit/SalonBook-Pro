"use strict";
// Phase 17.3: opt-in real Firebase read-only connectivity probe.
// Requires explicit operator approval and an allowlisted project.
// Reads only document metadata, never customer fields or appointment contents.
// Does not deploy a Cloud Function or change booking state.
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const ID=/^[A-Za-z0-9_-]{1,128}$/;
// Only fixed diagnostic labels; never expose raw Firebase error messages or document data.
function safeFailureCode(error){
 const code=error&&error.code;
 if(code===7||code==="7"||code==="permission-denied")return "PERMISSION_DENIED";
 if(code===16||code==="16"||code==="unauthenticated")return "UNAUTHENTICATED";
 if(code===5||code==="5"||code==="not-found")return "NOT_FOUND";
 if(code===14||code==="14"||code==="unavailable")return "SERVICE_UNAVAILABLE";
 if(code===4||code==="4"||code==="deadline-exceeded")return "DEADLINE_EXCEEDED";
 if(code===9||code==="9"||code==="failed-precondition")return "FAILED_PRECONDITION";
 return "UNKNOWN";
}
function createRealFirebaseReadOnlyProbe({db,projectId,allowedProjectId,enabled=false}={}){
 async function verify(ownerId){
  const deny=status=>Object.freeze({status,connected:false,acceptingBookings:false,reservationCreated:false,productionReady:false});
  if(enabled!==true||typeof projectId!=="string"||!projectId||
     projectId!==allowedProjectId)return deny("REAL_FIREBASE_PROBE_DISABLED");
  if(typeof ownerId!=="string"||!ID.test(ownerId))return deny("REAL_FIREBASE_PROBE_INVALID");
  if(!db||typeof db.collection!=="function"||typeof db.runTransaction!=="function")
   return deny("REAL_FIREBASE_PROBE_INVALID");
  try{
   const owner=db.collection("users").doc(ownerId);
   const refs=[db.collection("publicBusinesses").doc(ownerId),
    owner.collection("liveData").doc("staff"),owner.collection("liveData").doc("bookings")];
   const result=await db.runTransaction(async tx=>{
    const snapshots=await Promise.all(refs.map(ref=>tx.get(ref)));
    // Only metadata; no .data() or .get(field) calls.
    return snapshots.map(s=>s&&s.exists===true);
   },{readOnly:true,maxAttempts:1});
   if(!Array.isArray(result)||result.length!==3||result.some(v=>typeof v!=="boolean"))
    return deny("REAL_FIREBASE_PROBE_REVIEW_REQUIRED");
   return Object.freeze({
    status:result.every(Boolean)?"REAL_FIREBASE_METADATA_READ_VERIFIED":"REAL_FIREBASE_DOCUMENTS_MISSING",
    connected:true,documentsPresent:result.filter(Boolean).length,
    acceptingBookings:false,reservationCreated:false,productionReady:false
   });
  }catch(error){return Object.freeze({...deny("REAL_FIREBASE_PROBE_REVIEW_REQUIRED"),failureCode:safeFailureCode(error)});}
 }
 return Object.freeze({verify,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createRealFirebaseReadOnlyProbe});
