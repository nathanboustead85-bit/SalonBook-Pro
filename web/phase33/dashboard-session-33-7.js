"use strict";
// Phase 33.7: pure, offline session state machine. No Firebase auth or network access.
const {startLoading,finishLoading,resetDashboard}=require("./dashboard-refresh-33-6");
const id=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
const validNow=x=>Number.isSafeInteger(x)&&x>=0;
const clear=(status,reason,epoch)=>Object.freeze({status,reason,epoch,ownerId:null,expiresAt:null,requestId:null,bookingEnabled:false,editingEnabled:false,dashboard:resetDashboard()});
const initialSession=()=>clear("SIGNED_OUT","not_authenticated",0);
function beginSession(previous,auth,now){
 const epoch=(Number.isSafeInteger(previous?.epoch)&&previous.epoch>=0&&previous.epoch<Number.MAX_SAFE_INTEGER)?previous.epoch+1:1;
 if(!validNow(now)||!auth||!id(auth.uid)||auth.emailVerified!==true||!Number.isSafeInteger(auth.expiresAt)||auth.expiresAt<=now)return clear("SIGNED_OUT","invalid_or_expired_session",epoch);
 return Object.freeze({status:"SESSION_READY",reason:null,epoch,ownerId:auth.uid,expiresAt:auth.expiresAt,requestId:null,bookingEnabled:false,editingEnabled:false,dashboard:resetDashboard()});
}
function signOut(previous){
 const epoch=Number.isSafeInteger(previous?.epoch)&&previous.epoch>=0&&previous.epoch<Number.MAX_SAFE_INTEGER?previous.epoch+1:1;
 return clear("SIGNED_OUT","signed_out",epoch);
}
function expireSession(previous,now){
 if(!validNow(now)||!previous||!Number.isSafeInteger(previous.expiresAt)||now>=previous.expiresAt)return signOut(previous);
 return previous;
}
function requestDashboard(previous,requestId,now){
 const current=expireSession(previous,now);
 if(current.status!=="SESSION_READY"&&current.status!=="DASHBOARD_READY")return clear("SIGNED_OUT","session_not_ready",current.epoch);
 if(!id(requestId))return clear("SIGNED_OUT","invalid_request",current.epoch+1);
 return Object.freeze({...current,status:"DASHBOARD_LOADING",reason:null,requestId,bookingEnabled:false,editingEnabled:false,dashboard:startLoading({ownerId:current.ownerId,now},requestId)});
}
function receiveDashboard(previous,requestId,epoch,input,now){
 if(!validNow(now)||!previous||previous.status!=="DASHBOARD_LOADING"||previous.epoch!==epoch||previous.requestId!==requestId||
    !id(previous.ownerId)||!Number.isSafeInteger(previous.expiresAt)||now>=previous.expiresAt)return clear("SIGNED_OUT","stale_or_invalid_session",Number.isSafeInteger(previous?.epoch)?previous.epoch+1:1);
 const result=finishLoading(previous.dashboard,requestId,input,{ownerId:previous.ownerId,now});
 if(result.status!=="ASSEMBLED_READ_ONLY")return Object.freeze({...previous,status:"DASHBOARD_UNAVAILABLE",reason:"invalid_or_failed_refresh",requestId:null,dashboard:resetDashboard()});
 return Object.freeze({...previous,status:"DASHBOARD_READY",reason:null,requestId:null,bookingEnabled:false,editingEnabled:false,dashboard:result});
}
function failDashboard(previous,requestId,epoch,now){
 return receiveDashboard(previous,requestId,epoch,{error:"failed"},now);
}
module.exports=Object.freeze({initialSession,beginSession,signOut,expireSession,requestDashboard,receiveDashboard,failDashboard});
