"use strict";
/**
 * Offline-only guarded coordinator. Does not deploy or invoke Firebase.
 * Important: checking a lease before an external send is NOT atomic with
 * the remote write. A production writer must also enforce idempotency and
 * a durable fencing token at its own transaction boundary.
 */
const {reconcile}=require("./phase17DurableRecovery");
async function reconcileWithClaim({store,claims,key,worker,readCurrent,send,leaseMs=30000}){
 if(!claims||typeof claims.acquire!=="function"||typeof claims.verify!=="function"||typeof claims.complete!=="function")
  throw Error("CLAIM_COORDINATOR_REQUIRED");
 if(typeof send!=="function")throw Error("RECOVERY_SEND_REQUIRED");
 const claim=await claims.acquire({key,worker,leaseMs});
 if(claim.status!=="ACQUIRED")return {status:claim.status};
 const allowed=async()=>claims.verify({key,worker,generation:claim.generation});
 if(!await allowed())return {status:"FENCED"};
 const result=await reconcile({store,key,readCurrent,send:async command=>{
  if(!await allowed())throw Error("RECOVERY_CLAIM_EXPIRED");
  return send(command,{key,worker,generation:claim.generation});
 }});
 if(!await allowed())return {status:"FENCED"};
 if(result.state==="CONFIRMED"||result.state==="BLOCKED"){
  const completion=await claims.complete({key,worker,generation:claim.generation,outcome:result.state});
  if(completion.status!=="COMPLETED")return {status:"FENCED"};
 }
 return {status:result.state,result};
}
module.exports=Object.freeze({reconcileWithClaim});
