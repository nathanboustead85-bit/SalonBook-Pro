"use strict";
// Per-device synthetic read-only coordinator. No shared mutable cache or network wiring.
const {createDashboardDataCoordinator}=require("./dashboard-data-41-3");
const {unavailable}=require("../phase39/dashboard-view-model-39-3");
function createMultiDeviceRecovery({readAtomic,now=Date.now}){
 const base=createDashboardDataCoordinator({readAtomic,now});
 let active=true,online=true,epoch=0,owner=null,state=unavailable("signed_out");
 const listeners=new Set();
 const emit=x=>{state=x;for(const fn of [...listeners]){try{fn(x)}catch{}}return x};
 const clear=reason=>{epoch++;return emit(unavailable(reason))};
 async function refresh(auth){
  if(!active||!online)return state;
  if(!auth||typeof auth.uid!=="string"||auth.emailVerified!==true){owner=null;base.signOut();return clear("unverified_or_signed_out")}
  if(owner!==auth.uid){owner=auth.uid;base.accountChanged(owner);clear("account_changed")}
  const seq=++epoch,uid=owner;
  emit(unavailable("refreshing"));
  const result=await base.refresh(auth);
  if(!active||!online||seq!==epoch||owner!==uid)return state;
  return emit(result?.state==="READY"?result:unavailable(result?.reason||"read_unavailable"));
 }
 return Object.freeze({
  snapshot:()=>state,refresh,
  subscribe(fn){if(typeof fn!=="function")throw TypeError("listener_required");listeners.add(fn);fn(state);return()=>listeners.delete(fn)},
  accountChanged(uid){owner=typeof uid==="string"?uid:null;base.accountChanged(owner);return clear("account_changed")},
  signOut(){owner=null;base.signOut();return clear("signed_out")},
  offline(){online=false;base.networkUnavailable();return clear("network_unavailable")},
  async reconnect(auth){if(!active)return state;online=true;base.networkUnavailable();clear("reconnecting");return refresh(auth)},
  stop(){if(!active)return state;active=false;owner=null;base.stop();clear("stopped");listeners.clear();return state},
  canBook:false,canPay:false,canMessage:false,canDeploy:false
 });
}
module.exports=Object.freeze({createMultiDeviceRecovery});
