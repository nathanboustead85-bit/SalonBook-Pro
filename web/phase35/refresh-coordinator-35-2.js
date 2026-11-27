"use strict";
// Phase 35.2: injected atomic reader and epoch-gated display; no Firebase SDK or I/O here.
const {validateDocumentFreshness}=require("../phase34/document-freshness-34-3");
const {paths}=require("../phase34/android-firestore-map-34-2");
const valid=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
const safe=x=>Number.isSafeInteger(x)&&x>=0;
const empty=reason=>Object.freeze({status:"UNAVAILABLE",reason,data:null,bookingEnabled:false,editingEnabled:false});
function createRefreshCoordinator(readAtomic){
 if(typeof readAtomic!=="function")throw new TypeError("atomic_reader_required");
 let epoch=0,current=empty("not_loaded"),owner=null;
 const invalidate=reason=>{epoch++;owner=null;current=empty(reason);return current};
 function snapshot(){return current}
 function signOut(){return invalidate("signed_out")}
 async function refresh(auth,now){
  const token=++epoch;
  current=empty("loading");owner=null;
  if(!auth||!valid(auth.uid)||auth.emailVerified!==true||!safe(auth.expiresAt)||!safe(now)||auth.expiresAt<=now)return invalidate("invalid_session");
  owner=auth.uid;
  let result;
  try{result=await readAtomic(paths(auth.uid),auth.uid)}
  catch{if(token!==epoch)return current;return invalidate("atomic_read_failed")}
  // Older requests, sign-out and owner switches can never publish a result.
  if(token!==epoch||owner!==auth.uid)return current;
  if(!result||result.atomic!==true||!result.documents)return invalidate("atomicity_not_proven");
  const checked=validateDocumentFreshness(auth,result.documents,now,{consistentRead:true});
  if(checked.status!=="FRESH_ANDROID_READ_ONLY")return invalidate(checked.reason);
  current=Object.freeze({status:"READ_ONLY_READY",reason:null,data:checked.data,bookingEnabled:false,editingEnabled:false});
  return current;
 }
 return Object.freeze({refresh,snapshot,signOut});
}
module.exports=Object.freeze({createRefreshCoordinator});
