'use strict';
// Offline planning reference only. No Firestore calls or Android writes.
const crypto=require('node:crypto');
const TYPES=['bookings','services','staff'];
function inspectRecovery({snapshot,expectedUid,currentUid,emailVerified,localData}) {
 if(!expectedUid||currentUid!==expectedUid||emailVerified!==true)
   return {safe:false,reason:'IDENTITY_NOT_VERIFIED'};
 if(!snapshot||snapshot.schemaVersion!==1||typeof snapshot!=='object')
   return {safe:false,reason:'UNSUPPORTED_SNAPSHOT'};
 if(!localData||typeof localData!=='object')
   return {safe:false,reason:'LOCAL_STATE_UNKNOWN'};
 const preview=[];
 for(const key of TYPES){
   const payload=snapshot[key];
   if(typeof payload!=='string'||Buffer.byteLength(payload,'utf8')>1000000)
     return {safe:false,reason:'INVALID_'+key.toUpperCase()};
   let parsed;
   try{parsed=JSON.parse(payload)}catch{return {safe:false,reason:'INVALID_'+key.toUpperCase()}}
   if(!Array.isArray(parsed))return {safe:false,reason:'INVALID_'+key.toUpperCase()};
   if(!Array.isArray(localData[key]))return {safe:false,reason:'LOCAL_STATE_UNKNOWN'};
   preview.push({type:key,localCount:localData[key].length,cloudCount:parsed.length,
     fingerprint:crypto.createHash('sha256').update(payload).digest('hex')});
 }
 return {safe:true,mode:'PREVIEW_ONLY',preview,writeAuthorized:false};
}
function approveRestore(){return {allowed:false,reason:'ROLLBACK_AND_BACKEND_REVIEW_PENDING'};}
module.exports={inspectRecovery,approveRestore};
