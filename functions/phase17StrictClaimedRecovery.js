"use strict";
/**
 * Offline integration of strict CAS journal recovery with trusted claim leases.
 * A remote send is not atomic with lease verification. Production needs
 * authoritative destination fencing, trusted source reads and staging tests.
 */
const {reconcileStrict}=require("./phase17StrictRecovery");
async function reconcileStrictWithClaim({store,claims,key,worker,readCurrent,send,leaseMs=30000}){
 if(!claims||["acquire","verify","complete"].some(k=>typeof claims[k]!=="function"))
  throw Error("STRICT_CLAIM_COORDINATOR_REQUIRED");
 if(typeof send!=="function"||typeof readCurrent!=="function")throw Error("STRICT_CLAIM_ADAPTER_REQUIRED");
 const claim=await claims.acquire({key,worker,leaseMs});
 if(claim.status!=="ACQUIRED")return {status:claim.status};
 const fence=Object.freeze({key,worker,generation:claim.generation});
 const valid=()=>claims.verify(fence);
 if(!await valid())return {status:"FENCED"};
 let result;
 try{
  result=await reconcileStrict({store,key,readCurrent:async uid=>{
   if(!await valid())throw Error("RECOVERY_CLAIM_EXPIRED");
   return readCurrent(uid);
  },send:async command=>{
   if(!await valid())throw Error("RECOVERY_CLAIM_EXPIRED");
   return send(command,{...fence,requiresDestinationFence:true});
  }});
 }catch(e){
  if(e.message==="RECOVERY_CLAIM_EXPIRED"||e.message==="RECOVERY_REVISION_CONFLICT")
   return {status:"FENCED_OR_CONFLICT_REQUIRES_RECONCILIATION"};
  throw e;
 }
 if(!await valid())return {status:"FENCED"};
 if(result.status==="JOURNAL_CONFLICT_REQUIRES_RECONCILIATION")
  return {status:result.status};
 if(result.state==="CONFIRMED"||result.state==="BLOCKED"){
  const done=await claims.complete({...fence,outcome:result.state});
  if(done.status!=="COMPLETED")return {status:"FENCED"};
 }
 return {status:result.state,result};
}
module.exports=Object.freeze({reconcileStrictWithClaim});
