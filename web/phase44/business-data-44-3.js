"use strict";
// Synthetic, owner-scoped, read-only projection. Never initializes Firebase or writes.
const {createOwnerSession}=require("./owner-session-44-2");
const {mapActualAndroidDocuments,paths}=require("../phase34/android-firestore-map-34-2");
const unavailable=reason=>Object.freeze({status:"UNAVAILABLE",reason,business:null,services:Object.freeze([]),staff:Object.freeze([]),canBook:false,canPay:false,canMessage:false,canDeploy:false,stagingApproved:false});
function createBusinessDataIntegration({readDocuments,now=Date.now,maxAgeMs=300000,...options}={}){
 if(typeof readDocuments!=="function"||typeof now!=="function"||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<1000||maxAgeMs>3600000)throw TypeError("isolated_business_data_dependencies_required");
 const session=createOwnerSession({...options,now,readOwner:async uid=>{
  const documents=await readDocuments(uid,paths(uid));
  return {ownerId:uid,readOnly:true,data:documents};
 }});
 let active=true,epoch=0,state=unavailable("signed_out");
 const listeners=new Set();
 const emit=x=>{state=x;for(const fn of [...listeners]){try{fn(x)}catch{}}return state};
 const clear=reason=>{epoch++;return emit(unavailable(reason))};
 const timestamp=x=>{if(x&&typeof x.toMillis==="function")return x.toMillis();if(x instanceof Date)return x.getTime();return typeof x==="number"?x:NaN};
 function validate(uid,documents){
  if(!documents||typeof documents!=="object")return unavailable("missing_documents");
  const p=paths(uid),t=now();
  for(const key of Object.values(p)){
   const doc=documents[key],ms=timestamp(doc?.updatedAt);
   if(!Number.isFinite(ms)||ms>t+30000||t-ms>maxAgeMs)return unavailable("stale_or_invalid_document");
  }
  const mapped=mapActualAndroidDocuments({uid,emailVerified:true},documents);
  if(mapped.status!=="MAPPED_ANDROID_READ_ONLY")return unavailable(mapped.reason||"invalid_business_data");
  return Object.freeze({status:"ISOLATED_BUSINESS_READ_ONLY",business:mapped.business,services:mapped.services,staff:mapped.staff,openingHoursStatus:mapped.openingHoursStatus,revisionStatus:mapped.revisionStatus,canBook:false,canPay:false,canMessage:false,canDeploy:false,stagingApproved:false});
 }
 async function refresh(uid,reconnect=false){
  if(!active)return state;
  const seq=++epoch;emit(unavailable("revalidating"));
  try{
   const result=await (reconnect?session.reconnect(uid):session.refresh(uid));
   if(!active||seq!==epoch)return state;
   if(result.status!=="ISOLATED_READ_ONLY"||result.ownerId!==uid)return emit(unavailable(result.reason||"authorization_unavailable"));
   return emit(validate(uid,result.data));
  }catch{return active&&seq===epoch?emit(unavailable("read_unavailable")):state}
 }
 return Object.freeze({refresh:uid=>refresh(uid),reconnect:uid=>{clear("reconnecting");return refresh(uid,true)},snapshot:()=>state,offline(){session.offline();return clear("offline")},accountChanged(uid){session.accountChanged(uid);return clear("account_changed")},signOut(){session.signOut();return clear("signed_out")},stop(){active=false;session.stop();listeners.clear();return clear("stopped")},subscribe(fn){if(typeof fn!=="function")throw TypeError("listener_required");listeners.add(fn);fn(state);return()=>listeners.delete(fn)},canBook:false,canPay:false,canMessage:false,canDeploy:false,stagingApproved:false});
}
module.exports=Object.freeze({createBusinessDataIntegration});
