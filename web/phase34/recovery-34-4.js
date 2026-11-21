"use strict";
// Phase 34.4: pure, offline read-only retry state machine. No Firebase SDK or I/O.
const {validateDocumentFreshness}=require("./document-freshness-34-3");
const id=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
const clock=x=>Number.isSafeInteger(x)&&x>=0;
const empty=Object.freeze({status:"UNAVAILABLE",reason:"not_loaded",ownerId:null,epoch:0,requestId:null,attempt:0,nextRetryAt:null,data:null,bookingEnabled:false,editingEnabled:false});
const state=(s,reason,ownerId,epoch,requestId,attempt,nextRetryAt,data=null)=>Object.freeze({status:s,reason,ownerId,epoch,requestId,attempt,nextRetryAt,data,bookingEnabled:false,editingEnabled:false});
const RETRY_DELAY_MS=Object.freeze([1000,3000,10000]);
const retryable=new Set(["unavailable","deadline-exceeded","resource-exhausted","aborted"]);
const forbidden=new Set(["permission-denied","unauthenticated","invalid-argument","failed-precondition"]);
function begin(previous,auth,requestId,now){
 const epoch=clock(previous?.epoch)&&previous.epoch<Number.MAX_SAFE_INTEGER?previous.epoch+1:1;
 if(!auth||!id(auth.uid)||auth.emailVerified!==true||!clock(auth.expiresAt)||!clock(now)||auth.expiresAt<=now||!id(requestId))
  return state("SIGNED_OUT","invalid_session",null,epoch,null,0,null);
 return state("LOADING",null,auth.uid,epoch,requestId,1,null);
}
function fail(previous,requestId,epoch,code,now){
 if(!clock(now)||!previous||previous.status!=="LOADING"||previous.requestId!==requestId||previous.epoch!==epoch)return state("UNAVAILABLE","stale_callback",null,clock(previous?.epoch)?previous.epoch+1:1,null,0,null);
 const denied=forbidden.has(code);
 const canRetry=retryable.has(code)&&previous.attempt<RETRY_DELAY_MS.length;
 const delay=canRetry?RETRY_DELAY_MS[previous.attempt-1]:null;
 return state(canRetry?"RETRY_WAIT":"UNAVAILABLE",denied?"access_denied":canRetry?"temporary_failure":"read_failed",previous.ownerId,previous.epoch,null,previous.attempt,delay===null?null:now+delay);
}
function retry(previous,auth,requestId,now){
 if(!previous||previous.status!=="RETRY_WAIT"||!clock(now)||!clock(previous.nextRetryAt)||now<previous.nextRetryAt||
    !auth||auth.uid!==previous.ownerId||auth.emailVerified!==true||!clock(auth.expiresAt)||auth.expiresAt<=now||!id(requestId))
  return state("UNAVAILABLE","retry_not_authorized",null,clock(previous?.epoch)?previous.epoch+1:1,null,0,null);
 return state("LOADING",null,previous.ownerId,previous.epoch+1,requestId,previous.attempt+1,null);
}
function receive(previous,auth,requestId,epoch,documents,now,options){
 if(!previous||previous.status!=="LOADING"||previous.requestId!==requestId||previous.epoch!==epoch||
    !auth||auth.uid!==previous.ownerId)return state("UNAVAILABLE","stale_or_cross_owner_response",null,clock(previous?.epoch)?previous.epoch+1:1,null,0,null);
 const result=validateDocumentFreshness(auth,documents,now,options);
 if(result.status!=="FRESH_ANDROID_READ_ONLY")return state("UNAVAILABLE","invalid_or_stale_data",previous.ownerId,previous.epoch,null,previous.attempt,null);
 return state("READ_ONLY_READY",null,previous.ownerId,previous.epoch,null,previous.attempt,null,result.data);
}
function reset(previous){return state("SIGNED_OUT","signed_out",null,clock(previous?.epoch)?previous.epoch+1:1,null,0,null)}
module.exports=Object.freeze({initial:()=>empty,begin,fail,retry,receive,reset,RETRY_DELAY_MS});
