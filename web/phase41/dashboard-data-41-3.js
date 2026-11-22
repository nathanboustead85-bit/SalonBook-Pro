"use strict";
// Read-only synthetic snapshot integration; never enables bookings or migrates Android v1.
const {paths}=require("../phase34/android-firestore-map-34-2");
const {inspectAndroidCompatibility}=require("../phase39/android-compatibility-39-4");
const {inspectSharedRevision}=require("../phase40/hours-revision-contract-40-3");
const {project,unavailable}=require("../phase39/dashboard-view-model-39-3");
const deny=reason=>Object.freeze({...unavailable(reason),revisionVerified:false,migrationReady:false});
function inspectDashboardSnapshot({auth,documents,now=Date.now(),revisionDocuments,hours}={}){
 if(!auth||typeof auth.uid!=="string"||auth.emailVerified!==true||!Number.isFinite(now))return deny("unverified_owner");
 const p=paths(auth.uid);
 if(!documents||typeof documents!=="object"||Array.isArray(documents)||Object.keys(documents).length!==3||Object.values(p).some(x=>!Object.hasOwn(documents,x)))return deny("invalid_owner_paths");
 const checked=inspectAndroidCompatibility(auth,documents,now);
 if(checked.status!=="COMPATIBLE_READ_ONLY")return deny(checked.reason||"incompatible_android_data");
 // Android v1 has no shared revision: reject claims of verified cross-device consistency.
 if(revisionDocuments!==undefined||hours!==undefined){
  const revision=inspectSharedRevision({ownerUid:auth.uid,documents:revisionDocuments,hours});
  if(revision.status!=="CONTRACT_COMPATIBLE_READ_ONLY")return deny(revision.reason||"invalid_shared_revision");
  // A proposed v2 envelope does not authorize migration of Android v1.
  return deny("v1_v2_consistency_not_proven");
 }
 const view=project(checked);
 if(view.state!=="READY")return deny(view.reason||"invalid_dashboard_projection");
 return Object.freeze({...view,revisionVerified:false,migrationReady:false,consistency:"ATOMIC_V1_READ_ONLY_UNVERIFIED_REVISION",canBook:false,canEdit:false,canPay:false,canMessage:false});
}
function createDashboardDataCoordinator({readAtomic,now=Date.now}){
 if(typeof readAtomic!=="function"||typeof now!=="function")throw TypeError("read_only_reader_required");
 let active=true,epoch=0,owner=null,state=deny("signed_out");
 const listeners=new Set();
 function emit(next){state=next;for(const fn of [...listeners]){try{fn(state)}catch{}}return state}
 function clear(reason){epoch++;return emit(deny(reason))}
 async function refresh(auth){
  if(!active)return state;
  if(!auth||typeof auth.uid!=="string"||auth.emailVerified!==true){owner=null;return clear("unverified_or_signed_out")}
  if(owner!==auth.uid){owner=auth.uid;clear("account_changed")}
  const seq=++epoch,uid=auth.uid;emit(deny("refreshing"));
  try{
   const result=await readAtomic(paths(uid),uid);
   if(!active||seq!==epoch||owner!==uid)return state;
   if(result?.atomic!==true)return emit(deny("non_atomic_read"));
   return emit(inspectDashboardSnapshot({auth,documents:result.documents,now:now()}));
  }catch{if(active&&seq===epoch&&owner===uid)return emit(deny("read_failed"));return state}
 }
 return Object.freeze({
  snapshot:()=>state,refresh,
  subscribe(fn){if(typeof fn!=="function")throw TypeError("listener_required");listeners.add(fn);fn(state);return()=>listeners.delete(fn)},
  accountChanged(uid){owner=typeof uid==="string"?uid:null;return clear("account_changed")},
  signOut(){owner=null;return clear("signed_out")},
  networkUnavailable(){return clear("network_unavailable")},
  stop(){active=false;owner=null;clear("stopped");listeners.clear();return state},
  canBook:false,canPay:false,canMessage:false,canDeploy:false
 });
}
module.exports=Object.freeze({inspectDashboardSnapshot,createDashboardDataCoordinator});
