"use strict";
/**
 * Phase 17 OFFLINE concurrency claim preparation.
 * A claim is a transactionally allocated fencing generation. Only the
 * current generation can be completed or renewed. A claim does NOT by
 * itself prevent a timed-out worker from making an external network call:
 * the downstream writer must enforce idempotency/version checks too.
 * nowMs MUST come from a trusted server clock in production.
 */
const COLLECTION="publicationRecoveryClaims";
const FINAL=new Set(["CONFIRMED","BLOCKED"]);
function createClaimCoordinator({db,nowMs}){
 if(!db||typeof db.collection!=="function"||typeof db.runTransaction!=="function"||typeof nowMs!=="function")
  throw Error("TRUSTED_CLAIM_ADAPTER_REQUIRED");
 const col=db.collection(COLLECTION);
 if(!col||typeof col.doc!=="function")throw Error("INVALID_CLAIM_COLLECTION");
 const refFor=key=>{
  if(typeof key!=="string"||!/^[-_A-Za-z0-9:]{1,300}$/.test(key))throw Error("INVALID_CLAIM_KEY");
  return col.doc(key);
 };
 function clock(){
  const t=nowMs();
  if(!Number.isSafeInteger(t)||t<1)throw Error("INVALID_TRUSTED_CLOCK");
  return t;
 }
 function workerId(worker){
  if(typeof worker!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(worker))throw Error("INVALID_WORKER_ID");
 }
 function duration(ms){
  if(!Number.isSafeInteger(ms)||ms<1000||ms>300000)throw Error("INVALID_LEASE_DURATION");
 }
 async function acquire({key,worker,leaseMs=30000}){
  workerId(worker);duration(leaseMs);const ref=refFor(key),now=clock();
  return db.runTransaction(async tx=>{
   const snap=await tx.get(ref),old=snap.exists?snap.data():null;
   if(old&&FINAL.has(old.state))return {status:"TERMINAL",state:old.state};
   if(old&&old.state==="HELD"&&old.expiresAt>now)return {status:"BUSY"};
   const generation=old?(old.generation+1):1;
   if(!Number.isSafeInteger(generation)||generation<1)throw Error("CLAIM_GENERATION_OVERFLOW");
   const claim={key,worker,generation,expiresAt:now+leaseMs,state:"HELD"};
   if(!Number.isSafeInteger(claim.expiresAt))throw Error("CLAIM_TIME_OVERFLOW");
   if(old)tx.update(ref,claim);else tx.create(ref,claim);
   return {status:"ACQUIRED",...claim};
  });
 }
 async function complete({key,worker,generation,outcome}){
  workerId(worker);if(!Number.isSafeInteger(generation)||generation<1||!FINAL.has(outcome))
   throw Error("INVALID_CLAIM_COMPLETION");
  const ref=refFor(key),now=clock();
  return db.runTransaction(async tx=>{
   const snap=await tx.get(ref),old=snap.exists?snap.data():null;
   if(!old||old.state!=="HELD"||old.worker!==worker||old.generation!==generation||old.expiresAt<=now)
    return {status:"FENCED"};
   tx.update(ref,{...old,state:outcome,expiresAt:now});
   return {status:"COMPLETED",state:outcome};
  });
 }
 async function verify({key,worker,generation}){
  workerId(worker);
  if(!Number.isSafeInteger(generation)||generation<1)throw Error("INVALID_CLAIM_GENERATION");
  const ref=refFor(key),now=clock();
  return db.runTransaction(async tx=>{
   const snap=await tx.get(ref),old=snap.exists?snap.data():null;
   return !!old&&old.state==="HELD"&&old.worker===worker&&old.generation===generation&&old.expiresAt>now;
  });
 }
 return Object.freeze({acquire,complete,verify});
}
module.exports=Object.freeze({createClaimCoordinator,COLLECTION});
