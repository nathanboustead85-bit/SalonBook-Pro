"use strict";
// Phase 36.1: production-schema-compatible, dependency-injected read-only Firestore adapter.
// This module does not initialize Firebase, access production or perform writes.
const {paths}=require("../phase34/android-firestore-map-34-2");
const {createRefreshCoordinator}=require("../phase35/refresh-coordinator-35-2");
const id=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
const timestamp=t=>{
 if(t&&typeof t==="object"&&Number.isSafeInteger(t.seconds)&&Number.isInteger(t.nanoseconds))return {seconds:t.seconds,nanoseconds:t.nanoseconds};
 if(t&&typeof t.toMillis==="function"){const ms=t.toMillis();if(Number.isSafeInteger(ms)&&ms>=0)return {seconds:Math.floor(ms/1000),nanoseconds:(ms%1000)*1000000}}
 throw Error("invalid_firestore_timestamp");
};
function createAndroidBusinessReader({db,doc,runTransaction}){
 if(!db||typeof doc!=="function"||typeof runTransaction!=="function")throw TypeError("injected_firestore_sdk_required");
 return async function readAtomic(requested,uid){
  if(!id(uid))throw Error("invalid_owner");
  const expected=paths(uid);
  if(!requested||Object.keys(requested).length!==3||Object.keys(expected).some(k=>requested[k]!==expected[k]))throw Error("unexpected_business_paths");
  const documents=await runTransaction(db,async transaction=>{
   const out={};
   // All reads occur before any other transaction operation; never write.
   for(const key of ["profile","services","staff"]){
    const p=expected[key],snap=await transaction.get(doc(db,p));
    if(!snap.exists())throw Error("missing_business_document");
    const data=snap.data();
    if(!data||typeof data!=="object"||Array.isArray(data))throw Error("invalid_business_document");
    out[p]={...data,updatedAt:timestamp(data.updatedAt)};
   }
   return out;
  },{maxAttempts:3});
  return {atomic:true,documents};
 };
}
function createAndroidDashboardAdapter(sdk){
 const reader=createAndroidBusinessReader(sdk),coordinator=createRefreshCoordinator(reader);
 return Object.freeze({refresh:(auth,now)=>coordinator.refresh(auth,now),snapshot:()=>coordinator.snapshot(),signOut:()=>coordinator.signOut()});
}
module.exports=Object.freeze({createAndroidBusinessReader,createAndroidDashboardAdapter});
