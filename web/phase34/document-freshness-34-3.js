"use strict";
// Phase 34.3: offline Firestore Timestamp validation and conservative consistency policy.
// Timestamp format: {seconds, nanoseconds}; independent document timestamps, NO shared revision.
const {mapActualAndroidDocuments,paths}=require("./android-firestore-map-34-2");
const id=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
const obj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const fail=reason=>Object.freeze({status:"UNAVAILABLE",reason,bookingEnabled:false,editingEnabled:false,data:null});
const MAX_AGE_MS=24*60*60*1000,MAX_SKEW_MS=5*60*1000;
function timestampMillis(t){
 if(!obj(t)||!Number.isSafeInteger(t.seconds)||!Number.isInteger(t.nanoseconds)||t.nanoseconds<0||t.nanoseconds>=1000000000||
    t.seconds<0||t.seconds>8640000000000)return null;
 const ms=t.seconds*1000+Math.floor(t.nanoseconds/1000000);
 return Number.isSafeInteger(ms)?ms:null;
}
function validateDocumentFreshness(auth,documents,now,options={}){
 if(!auth||!id(auth.uid)||auth.emailVerified!==true||!Number.isSafeInteger(auth.expiresAt)||!Number.isSafeInteger(now)||now<0||auth.expiresAt<=now)return fail("unauthorized_or_expired");
 if(!obj(documents)||!obj(options)||Object.keys(options).some(k=>k!=="consistentRead"))return fail("invalid_context");
 // An actual consistent snapshot cannot be inferred from timestamps; caller must attest
 // that all documents were fetched by one verified consistent-read operation.
 if(options.consistentRead!==true)return fail("consistent_read_not_verified");
 const p=paths(auth.uid),expected=Object.values(p);
 if(Object.keys(documents).length!==3||Object.keys(documents).some(k=>!expected.includes(k)))return fail("unexpected_paths");
 const times=[];
 for(const path of expected){
  const doc=documents[path];
  if(!obj(doc))return fail("missing_document");
  const ms=timestampMillis(doc.updatedAt);
  if(ms===null)return fail("invalid_timestamp");
  if(ms>now)return fail("future_timestamp");
  if(now-ms>MAX_AGE_MS)return fail("stale_document");
  times.push(ms);
 }
 if(Math.max(...times)-Math.min(...times)>MAX_SKEW_MS)return fail("inconsistent_document_freshness");
 const mapped=mapActualAndroidDocuments(auth,documents);
 if(mapped.status!=="MAPPED_ANDROID_READ_ONLY")return fail("invalid_android_schema");
 return Object.freeze({status:"FRESH_ANDROID_READ_ONLY",reason:null,bookingEnabled:false,editingEnabled:false,
  data:mapped,sourceTimestampMs:Object.freeze(times),consistency:"CALLER_ATTESTED_SINGLE_READ",
  openingHoursStatus:"NOT_VERIFIED_IN_ANDROID_SCHEMA"});
}
module.exports=Object.freeze({timestampMillis,validateDocumentFreshness,MAX_AGE_MS,MAX_SKEW_MS});
