"use strict";
// Phase 17.3: opt-in real Firebase read-only connectivity probe.
// Requires explicit operator approval and an allowlisted project.
// Reads only document metadata, never customer fields or appointment contents.
// Does not deploy a Cloud Function or change booking state.
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const ID=/^[A-Za-z0-9_-]{1,128}$/;
// Only fixed diagnostic labels; never expose raw Firebase error messages or document data.
function safeFailureCode(error){
 // Classify only allowlisted categories; never return exception text, stack or IDs.
 const known=new Map([
  ["7","PERMISSION_DENIED"],["permission-denied","PERMISSION_DENIED"],["PERMISSION_DENIED","PERMISSION_DENIED"],
  ["16","UNAUTHENTICATED"],["unauthenticated","UNAUTHENTICATED"],["UNAUTHENTICATED","UNAUTHENTICATED"],
  ["5","NOT_FOUND"],["not-found","NOT_FOUND"],["NOT_FOUND","NOT_FOUND"],
  ["14","SERVICE_UNAVAILABLE"],["unavailable","SERVICE_UNAVAILABLE"],["UNAVAILABLE","SERVICE_UNAVAILABLE"],
  ["4","DEADLINE_EXCEEDED"],["deadline-exceeded","DEADLINE_EXCEEDED"],["DEADLINE_EXCEEDED","DEADLINE_EXCEEDED"],
  ["9","FAILED_PRECONDITION"],["failed-precondition","FAILED_PRECONDITION"],["FAILED_PRECONDITION","FAILED_PRECONDITION"],
  ["3","INVALID_ARGUMENT"],["invalid-argument","INVALID_ARGUMENT"],["INVALID_ARGUMENT","INVALID_ARGUMENT"],
  ["12","UNIMPLEMENTED"],["unimplemented","UNIMPLEMENTED"],["UNIMPLEMENTED","UNIMPLEMENTED"],
  ["8","RESOURCE_EXHAUSTED"],["resource-exhausted","RESOURCE_EXHAUSTED"],["RESOURCE_EXHAUSTED","RESOURCE_EXHAUSTED"]
 ]);
 const seen=new Set();let current=error;
 for(let i=0;i<4&&current&&typeof current==="object"&&!seen.has(current);i++){
  seen.add(current);
  const code=current.code;
  if((typeof code==="number"||typeof code==="string")&&known.has(String(code)))
   return known.get(String(code));
  current=current.cause;
 }
 // Common credential and transport failures can be categorized by fixed phrases,
 // without disclosing the underlying error message or any personal data.
 const message=typeof error?.message==="string"?error.message.slice(0,2048):"";
 if(/iam\.serviceAccounts\.getAccessToken|iamcredentials|generateAccessToken|iam\.serviceAccounts\.getOpenIdToken/i.test(message))
  return "SERVICE_ACCOUNT_IMPERSONATION";
 if(/invalid_grant|invalid_target|invalid_subject_token|invalid_credential/i.test(message))
  return "FEDERATED_CREDENTIAL_REJECTED";
 if(/Could not load the default credentials|application default credentials/i.test(message))
  return "CREDENTIALS_UNAVAILABLE";
 if(/PERMISSION_DENIED|permission denied|403 Forbidden|insufficient permissions/i.test(message))
  return "PERMISSION_DENIED";
 if(/UNAUTHENTICATED|401 Unauthorized/i.test(message))return "UNAUTHENTICATED";
 if(/FAILED_PRECONDITION/i.test(message))return "FAILED_PRECONDITION";
 if(/INVALID_ARGUMENT/i.test(message))return "INVALID_ARGUMENT";
 if(/UNIMPLEMENTED/i.test(message))return "UNIMPLEMENTED";
 if(/RESOURCE_EXHAUSTED/i.test(message))return "RESOURCE_EXHAUSTED";
 if(/DEADLINE_EXCEEDED|deadline exceeded/i.test(message))return "DEADLINE_EXCEEDED";
 if(/UNAVAILABLE|ECONNRESET|ENOTFOUND|ETIMEDOUT/i.test(message))return "SERVICE_UNAVAILABLE";
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
