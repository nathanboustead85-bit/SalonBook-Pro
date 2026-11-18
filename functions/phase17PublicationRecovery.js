"use strict";
/**
 * Phase 17 offline publication retry coordinator.
 * Only retry transient infrastructure failures. Semantic results such as
 * STALE, SLUG_TAKEN and INCONSISTENT_RESERVATION require intervention.
 * The SAME immutable command/version must be reused for every attempt.
 * A production caller must persist its pending command durably before
 * sending it, and verify source freshness on recovery. Not a queue.
 */
const TRANSIENT=new Set(["unavailable","deadline-exceeded","aborted","resource-exhausted","UNAVAILABLE","DEADLINE_EXCEEDED","ABORTED","RESOURCE_EXHAUSTED",4,8,10,14]);
const FINAL=new Set(["PUBLISHED","UNPUBLISHED","ALREADY_APPLIED","STALE","SLUG_TAKEN","INCONSISTENT_RESERVATION","NOT_FOUND"]);
function transient(error){
 if(!error||typeof error!=="object")return false;
 return TRANSIENT.has(error.code);
}
function safeCommand(command){
 if(!command||!["publish","unpublish"].includes(command.operation)||
  typeof command.uid!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(command.uid)||
  !Number.isSafeInteger(command.version)||command.version<1)
  throw Error("INVALID_RECOVERY_COMMAND");
 const copy=JSON.parse(JSON.stringify(command));
 if(command.operation==="publish"&&(!copy.profile||copy.profile.businessId!==copy.uid||copy.profile.acceptingBookings!==false))
  throw Error("UNSAFE_RECOVERY_COMMAND");
 return Object.freeze(copy);
}
async function executeWithRecovery({send,command,maxAttempts=3,onRetry}){
 if(typeof send!=="function"||!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>5)
  throw Error("INVALID_RECOVERY_ADAPTER");
 const frozen=safeCommand(command);
 for(let attempt=1;attempt<=maxAttempts;attempt++){
  try{
   const result=await send(frozen);
   if(!result||!FINAL.has(result.status))
    return {status:"UNKNOWN_RESULT_REQUIRES_RECONCILIATION",attempts:attempt};
   return {...result,attempts:attempt};
  }catch(error){
   if(!transient(error))
    return {status:"PERMANENT_FAILURE",attempts:attempt};
   if(attempt===maxAttempts)
    return {status:"RETRY_EXHAUSTED_REQUIRES_RECONCILIATION",attempts:attempt};
   if(typeof onRetry==="function")await onRetry(attempt);
  }
 }
}
module.exports=Object.freeze({executeWithRecovery,transient,safeCommand});
