"use strict";
// Phase 36.4 isolated dashboard presentation adapter; no UI SDK, persistence or writes.
const {createAuthListenerController}=require("./auth-listener-controller-36-3");
const EMPTY=Object.freeze({view:"SIGNED_OUT",message:"Sign in to view your business.",business:null,services:[],staff:[],canBook:false,canEdit:false,canMessage:false,canPay:false});
const reasons=Object.freeze({
 signed_out:["SIGNED_OUT","Sign in to view your business."],
 not_started:["SIGNED_OUT","Sign in to view your business."],
 stopped:["SIGNED_OUT","Sign in to view your business."],
 awaiting_auth:["LOADING","Checking your sign-in."],
 auth_refreshing:["LOADING","Verifying your business account."],
 loading:["LOADING","Loading your business dashboard."],
 network_unavailable:["RECOVERY","Connection lost. Reconnect and retry."],
 token_refresh_failed:["RECOVERY","Session verification failed. Retry securely."],
 atomic_read_failed:["RECOVERY","Business information is unavailable. Retry securely."],
 auth_refresh_failed:["RECOVERY","Business information is unavailable. Retry securely."],
 auth_listener_error:["RECOVERY","Sign-in connection failed. Retry securely."]
});
function project(state){
 if(state?.status==="READ_ONLY_READY"&&state?.data&&state.bookingEnabled===false&&state.editingEnabled===false){
  const d=state.data;
  if(d.business&&Array.isArray(d.services)&&Array.isArray(d.staff)){
   return Object.freeze({view:"READY",message:"Read-only business overview",business:d.business,services:d.services,staff:d.staff,canBook:false,canEdit:false,canMessage:false,canPay:false});
  }
 }
 const [view,message]=reasons[state?.reason]||["UNAVAILABLE","Business dashboard unavailable. Please sign in again."];
 return Object.freeze({...EMPTY,view,message});
}
function createSecureDashboardSession(dependencies){
 const controller=createAuthListenerController(dependencies);
 const snapshot=()=>project(controller.snapshot());
 return Object.freeze({
  start:()=>{controller.start();return snapshot()},
  stop:()=>{controller.stop();return snapshot()},
  networkUnavailable:()=>{controller.networkUnavailable();return snapshot()},
  networkRestored:async()=>{await controller.networkRestored();return snapshot()},
  retry:async()=>{await controller.refresh();return snapshot()},
  snapshot,
  subscribe:listener=>controller.subscribe(state=>listener(project(state)))
 });
}
module.exports=Object.freeze({createSecureDashboardSession,project});
