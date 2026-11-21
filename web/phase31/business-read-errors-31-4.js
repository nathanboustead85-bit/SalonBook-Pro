"use strict";
// Phase 31.4: pure read-only state machine. No network, timers or persistence.
// Caller supplies each read result and clock; retries are instructions, not side effects.
const {validateEnvelope,recoverSnapshot}=require("./business-data-freshness-31-3");
const MAX_ATTEMPTS=3;
const unavailable=(reason,attempts=0)=>Object.freeze({status:"UNAVAILABLE",reason,attempts,bookingEnabled:false,canRetry:false,display:null});
const transient=new Set(["network_unavailable","timeout","temporarily_unavailable"]);
function initialState(){return Object.freeze({status:"IDLE",attempts:0,bookingEnabled:false,canRetry:false,display:null});}
function startRead(state){
 if(!state||!["IDLE","UNAVAILABLE"].includes(state.status)||state.canRetry===true)return unavailable("invalid_transition");
 return Object.freeze({status:"LOADING",attempts:1,bookingEnabled:false,canRetry:false,display:null});
}
function settleRead(state,outcome,{slug,now,lastRevision=0,maxAgeMs=300000}={}){
 if(!state||state.status!=="LOADING"||!Number.isInteger(state.attempts)||state.attempts<1||state.attempts>MAX_ATTEMPTS)return unavailable("invalid_transition");
 if(!outcome||typeof outcome!=="object"||Array.isArray(outcome))return unavailable("invalid_result",state.attempts);
 if(outcome.ok===true){
  // A read must be validated against the expected slug, freshness, and revision.
  const validated=lastRevision===0?validateEnvelope(outcome.snapshot,slug,now,{maxAgeMs}):
   recoverSnapshot(outcome.snapshot,slug,now,lastRevision,{maxAgeMs});
  if(validated.status!=="FRESH_READ_ONLY")return unavailable("invalid_or_stale_data",state.attempts);
  return Object.freeze({status:"READY",attempts:state.attempts,bookingEnabled:false,canRetry:false,display:validated});
 }
 if(outcome.ok!==false||typeof outcome.code!=="string")return unavailable("invalid_result",state.attempts);
 const canRetry=transient.has(outcome.code)&&state.attempts<MAX_ATTEMPTS;
 // Error messages, stack traces and source records must never be echoed.
 return Object.freeze({status:"UNAVAILABLE",reason:canRetry?"temporary_error":"read_unavailable",
  attempts:state.attempts,bookingEnabled:false,canRetry,display:null});
}
function retryRead(state){
 if(!state||state.status!=="UNAVAILABLE"||state.canRetry!==true||
 !Number.isInteger(state.attempts)||state.attempts<1||state.attempts>=MAX_ATTEMPTS)return unavailable("retry_not_permitted");
 return Object.freeze({status:"LOADING",attempts:state.attempts+1,bookingEnabled:false,canRetry:false,display:null});
}
function invalidateRead(state){
 // Revocation or interruption always removes previously visible data.
 return unavailable("refresh_required",state&&Number.isInteger(state.attempts)?state.attempts:0);
}
module.exports=Object.freeze({MAX_ATTEMPTS,initialState,startRead,settleRead,retryRead,invalidateRead});
