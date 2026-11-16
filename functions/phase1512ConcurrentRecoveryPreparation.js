"use strict";
// Phase 15.12: parallel read-only recovery inspections against consistent mock snapshots.
// No lock or reservation write is attempted; this is NOT production Firestore concurrency proof.
const {createRecoveryOwnershipIsolation}=require("./phase1511RecoveryOwnershipIsolation");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const deny=status=>({status,acceptingBookings:false,reservationCreated:false});
function createConcurrentRecoveryPreparation(store,options={}){
 const ownerRecovery=createRecoveryOwnershipIsolation(store,options);
 async function inspectBatch(requests,{limit=100}={}){
  if(!Array.isArray(requests)||requests.length<1||requests.length>100
   ||!Number.isInteger(limit)||limit<1||limit>100)return deny("CONCURRENCY_INVALID");
  // Each independent inspection enforces its own trusted principal and snapshot.
  const outcomes=await Promise.all(requests.map(async ({input,context}={})=>{
   try{return await ownerRecovery.inspect(input,context);}
   catch{return deny("CONCURRENCY_UNCERTAIN");}
  }));
  return Object.freeze({status:"CONCURRENCY_INSPECTIONS_COMPLETE",acceptingBookings:false,
   reservationCreated:false,outcomes});
 }
 return Object.freeze({inspect:ownerRecovery.inspect,inspectBatch,
  reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createConcurrentRecoveryPreparation});
