'use strict';
// Pure, synthetic-data reference policy. NOT used by the installed Android app.
const KEYS=['bookings','services','staff'];
function validateBackup({snapshot, requestedUid, currentUid, verified, local}) {
  if (!requestedUid || requestedUid !== currentUid || verified !== true)
    return {allowed:false,reason:'ACCOUNT_NOT_VERIFIED_OR_CHANGED'};
  if (!snapshot || snapshot.schemaVersion !== 1)
    return {allowed:false,reason:'SCHEMA_UNSUPPORTED'};
  if (!local || typeof local !== 'object')
    return {allowed:false,reason:'LOCAL_DATA_UNAVAILABLE'};
  const proposed={};
  for(const key of KEYS){
    const payload=snapshot[key];
    if(typeof payload!=='string'||Buffer.byteLength(payload,'utf8')>1000000)
      return {allowed:false,reason:'INVALID_'+key.toUpperCase()};
    try{proposed[key]=JSON.parse(payload)}catch{return {allowed:false,reason:'INVALID_'+key.toUpperCase()}}
    if(!Array.isArray(proposed[key]))return {allowed:false,reason:'INVALID_'+key.toUpperCase()};
  }
  const counts=KEYS.map(key=>({key,local:Array.isArray(local[key])?local[key].length:0,cloud:proposed[key].length}));
  return {allowed:true,mode:'PREVIEW_ONLY',counts};
}
function requireExplicitWriteAuthorization({requestedUid,currentUid,verified,confirmed,sourceVersion}) {
  if(!requestedUid||requestedUid!==currentUid||verified!==true)return {allowed:false,reason:'ACCOUNT_CHANGED'};
  if(confirmed!==true)return {allowed:false,reason:'CONFIRMATION_REQUIRED'};
  if(sourceVersion!==1)return {allowed:false,reason:'SCHEMA_UNSUPPORTED'};
  // No authorization is issued by this reference model; backend and rollback gates remain unresolved.
  return {allowed:false,reason:'BACKEND_AND_ROLLBACK_APPROVAL_REQUIRED'};
}
module.exports={validateBackup,requireExplicitWriteAuthorization};
