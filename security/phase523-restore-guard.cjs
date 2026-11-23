'use strict';
// Offline reference guard for proposed future Android restore hardening.
// Does NOT run inside the Android app and cannot restore user data.
function validateSnapshot(snapshot, expectedUid, activeUid) {
  if (!expectedUid || !activeUid || expectedUid !== activeUid)
    return {ok:false,reason:'ACCOUNT_CHANGED'};
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot))
    return {ok:false,reason:'INVALID_SNAPSHOT'};
  if (snapshot.schemaVersion !== 1)
    return {ok:false,reason:'SCHEMA_MISMATCH'};
  const parsed={};
  for (const key of ['bookings','services','staff']) {
    if (typeof snapshot[key] !== 'string' || snapshot[key].length > 1000000)
      return {ok:false,reason:'INVALID_'+key.toUpperCase()};
    try {
      parsed[key]=JSON.parse(snapshot[key]);
    } catch {
      return {ok:false,reason:'INVALID_'+key.toUpperCase()};
    }
    if (!Array.isArray(parsed[key]))
      return {ok:false,reason:'INVALID_'+key.toUpperCase()};
  }
  return {ok:true,parsed};
}
function previewRestore(snapshot,expectedUid,activeUid,localData) {
  const result=validateSnapshot(snapshot,expectedUid,activeUid);
  if (!result.ok) return {allowed:false,reason:result.reason,changes:[]};
  return {allowed:true,changes:['bookings','services','staff'].map(key=>({
    key,previousCount:Array.isArray(localData[key])?localData[key].length:0,
    proposedCount:result.parsed[key].length
  }))};
}
module.exports={validateSnapshot,previewRestore};
