"use strict";
/**
 * Offline recovery sequence adapter. The injected destination writer MUST
 * enforce its own authoritative claim within its destination transaction.
 * This module cannot create cross-database atomicity or authenticate sources.
 */
const {planExactRecovery}=require("./phase17ExactRecoveryPlanner");
const {exactPublicationIdentity}=require("./phase17ExactPublicationIdentity");
async function runExactRecovery({identity,journal,sourceSnapshot,profile,workerClaim,
 claimPlacement,writeDestination,transitionJournal}={}){
 if(typeof writeDestination!=="function"||typeof transitionJournal!=="function")
  throw Error("EXACT_RECOVERY_ADAPTER_REQUIRED");
 const plan=planExactRecovery({identity,journal,sourceSnapshot,workerClaim,claimPlacement});
 if(plan.status!=="READY_FOR_DESTINATION_RECHECK")return {status:plan.status};
 const expected=exactPublicationIdentity({uid:identity.uid,operation:identity.operation,
  snapshot:sourceSnapshot,...(identity.operation==="publish"?{profile}:{})});
 if(expected.key!==identity.key||expected.digest!==identity.digest)
  throw Error("EXACT_RECOVERY_PAYLOAD_MISMATCH");
 let current=journal;
 // PENDING -> UNKNOWN before any uncertain destination side effect.
 if(current.state==="PENDING"){
  current=await transitionJournal({key:identity.key,digest:identity.digest,
   expectedRevision:current.casRevision,state:"UNKNOWN",sourceSnapshot});
  if(current.state!=="UNKNOWN"||current.casRevision!==journal.casRevision+1)
   throw Error("EXACT_RECOVERY_UNKNOWN_NOT_DURABLE");
 }
 let result;
 try{result=await writeDestination({identity,sourceSnapshot,profile,claimPlacement});}
 catch(error){
  return {status:"UNKNOWN",reason:"DESTINATION_OUTCOME_UNCERTAIN"};
 }
 if(!result||typeof result.status!=="string")return {status:"UNKNOWN",reason:"INVALID_DESTINATION_RESPONSE"};
 if(result.status==="PUBLISHED"||result.status==="UNPUBLISHED"||result.status==="ALREADY_APPLIED"){
  // Confirmation requires a writer contract that is authoritative at destination.
  const next=await transitionJournal({key:identity.key,digest:identity.digest,
   expectedRevision:current.casRevision,state:"CONFIRMED",sourceSnapshot});
  if(next.state!=="CONFIRMED")throw Error("EXACT_RECOVERY_CONFIRMATION_FAILED");
  return {status:"CONFIRMED",destinationStatus:result.status};
 }
 if(result.status==="FENCED"||result.status==="STALE"||result.status==="REVISION_CONFLICT"||
    result.status==="INCONSISTENT_RESERVATION"||result.status==="SLUG_TAKEN"||
    result.status==="NOT_FOUND")return {status:"UNKNOWN",destinationStatus:result.status};
 return {status:"UNKNOWN",reason:"UNRECOGNISED_DESTINATION_STATUS"};
}
module.exports=Object.freeze({runExactRecovery});
