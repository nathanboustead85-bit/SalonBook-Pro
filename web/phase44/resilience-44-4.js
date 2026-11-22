"use strict";
// Emulator-only read-only concurrency boundary. Never initializes Admin, writes or deploys.
const {createBusinessDataIntegration}=require("./business-data-44-3");
const deny=reason=>Object.freeze({status:"UNAVAILABLE",reason,business:null,services:Object.freeze([]),staff:Object.freeze([]),canBook:false,canPay:false,canMessage:false,canDeploy:false,stagingApproved:false});
function createResilientBusinessReader(options={}){
 const inner=createBusinessDataIntegration(options);
 let active=true,online=true,epoch=0,owner=null,state=deny("signed_out");
 const listeners=new Set();
 const emit=next=>{state=next;for(const fn of [...listeners]){try{fn(next)}catch{}}return state};
 const clear=reason=>{epoch++;return emit(deny(reason))};
 async function load(uid,reconnect=false){
  if(!active||!online)return state;
  if(typeof uid!=="string"||!/^[A-Za-z0-9_-]{1,80}$/.test(uid))return clear("invalid_owner");
  if(owner!==uid){owner=uid;inner.accountChanged(uid);clear("account_changed")}
  const seq=++epoch;emit(deny("revalidating"));
  try{
   const result=await(reconnect?inner.reconnect(uid):inner.refresh(uid));
   if(!active||!online||seq!==epoch||owner!==uid)return state;
   if(result.status!=="ISOLATED_BUSINESS_READ_ONLY"||result.business?.businessId!==uid)return emit(deny(result.reason||"authorization_unavailable"));
   return emit(result);
  }catch{return active&&online&&seq===epoch&&owner===uid?emit(deny("read_unavailable")):state}
 }
 return Object.freeze({refresh:uid=>load(uid),reconnect(uid){online=true;inner.offline();clear("reconnecting");return load(uid,true)},snapshot:()=>state,offline(){online=false;inner.offline();return clear("offline")},accountChanged(uid=null){owner=uid;inner.accountChanged(uid);return clear("account_changed")},signOut(){owner=null;inner.signOut();return clear("signed_out")},stop(){if(!active)return state;active=false;owner=null;inner.stop();listeners.clear();return clear("stopped")},subscribe(fn){if(typeof fn!=="function")throw TypeError("listener_required");listeners.add(fn);fn(state);return()=>listeners.delete(fn)},canBook:false,canPay:false,canMessage:false,canDeploy:false,stagingApproved:false});
}
module.exports=Object.freeze({createResilientBusinessReader});
