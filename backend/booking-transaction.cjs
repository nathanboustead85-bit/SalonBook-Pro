"use strict";
const {plan,requestKey}=require("./booking-lock-contract.cjs");
// Internal adapter contract: all reads and writes must use one serializable transaction.
// prepare must derive authorization, revisions, availability and lock sets from trusted transaction reads.
async function executeBooking({store,businessId,actorId,key,fingerprint,prepare}){
 if(typeof fingerprint!=="string"||!/^[a-f0-9]{64}$/.test(fingerprint))throw Error("Invalid request fingerprint");
 const scope=requestKey(businessId,actorId,key);
 return store.runTransaction(async tx=>{
 const previous=await tx.readRequest(businessId,scope);
 const command=await prepare(tx,{businessId,actorId,previous});
 if(!command||command.authorized!==true)throw Error("Denied");
 if(previous){if(previous.fingerprint!==fingerprint)throw Error("Request key reused");return previous.result;}
 if(command.available!==true||command.revisionValid!==true)throw Error("Unavailable or stale");
 const {appointmentId,oldLocks,newLocks,record}=command;
 const occupancy=new Map();
 for(const lock of new Set([...oldLocks,...newLocks]))occupancy.set(lock,await tx.readLock(businessId,lock));
 const changes=plan({appointmentId,oldLocks,newLocks,occupancy});
 for(const lock of changes.release)tx.releaseLock(businessId,lock);
 for(const lock of changes.acquire)tx.acquireLock(businessId,lock,appointmentId);
 tx.writeAppointment(businessId,appointmentId,record);
 const result={appointmentId,accepted:true};
 tx.writeRequest(businessId,scope,{fingerprint,result});
 return result;
 });
}
module.exports={executeBooking};
