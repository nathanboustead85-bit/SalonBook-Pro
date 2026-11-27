"use strict";
// Internal transaction adapter, not an endpoint. prepare must authorize and derive
// canonical command and lock sets from trusted reads within this transaction.
const {plan,requestKey}=require("./booking-lock-contract.cjs");
const crypto=require("node:crypto");
async function execute({db,businessId,actorId,key,command,prepare}){
 const hash=requestKey(businessId,actorId,key);
 const fingerprint=crypto.createHash("sha256").update(JSON.stringify(command)).digest("hex");
 const root=db.collection("businesses").doc(businessId);
 const receipt=root.collection("bookingRequests").doc(hash);
 return db.runTransaction(async tx=>{
 const p=await prepare(tx,command,{businessId,actorId});
 if(!p||p.authorized!==true)throw Error("Denied");
 const prior=await tx.get(receipt);
 if(prior.exists){const d=prior.data();if(d.fingerprint!==fingerprint)throw Error("Request key reused");return d.result;}
 const {appointmentId,oldLocks,newLocks,appointment,expectedRevision}=p;
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(appointmentId)||typeof appointmentId!=="string")throw Error("Invalid appointment");
 const ref=root.collection("appointments").doc(appointmentId);
 const current=await tx.get(ref);
 if(current.exists?current.data().revision!==expectedRevision:expectedRevision!==0)throw Error("Stale revision");
 if(!current.exists&&oldLocks.length)throw Error("Invalid previous locks");
 const occupancy=new Map(),refs=new Map();
 for(const k of new Set([...oldLocks,...newLocks])){
 if(typeof k!=="string"||!/^[A-Za-z0-9_-]{1,180}$/.test(k))throw Error("Invalid lock");
 const r=root.collection("bookingLocks").doc(k);refs.set(k,r);const s=await tx.get(r);occupancy.set(k,s.exists?s.data().appointmentId:null);
 }
 const changes=plan({appointmentId,oldLocks,newLocks,occupancy});
 const revision=expectedRevision+1;
 if(!Number.isSafeInteger(revision)||revision<1)throw Error("Invalid revision");
 const result={appointmentId,revision};
 tx.set(ref,{...appointment,businessId,revision});
 for(const k of changes.release)tx.delete(refs.get(k));
 for(const k of changes.acquire)tx.create(refs.get(k),{appointmentId,businessId});
 tx.create(receipt,{fingerprint,result});
 return result;
 });
}
module.exports={execute};
