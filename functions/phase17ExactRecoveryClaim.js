"use strict";
/** Offline-only exact-revision worker claims. Not a destination-side fence. */
const {compareRevisions}=require("./phase17FullPrecisionRevision");
const COLLECTION="publicationExactRecoveryClaims";
const KEY=/^[A-Za-z0-9_-]{1,128}:(?:publish|unpublish):\d{16}:\d{9}$/;
const WORKER=/^[A-Za-z0-9_-]{1,128}$/;
const FINAL=new Set(["CONFIRMED","BLOCKED"]);
function createExactClaimCoordinator({db,nowMs}){
 if(!db||typeof db.collection!=="function"||typeof db.runTransaction!=="function"||typeof nowMs!=="function")
  throw Error("EXACT_CLAIM_ADAPTER_REQUIRED");
 const col=db.collection(COLLECTION);
 function refFor(identity){
  if(!identity||typeof identity.key!=="string"||!KEY.test(identity.key)||
     typeof identity.digest!=="string"||!/^[a-f0-9]{64}$/.test(identity.digest)||
     identity.key!==identity.uid+":"+identity.operation+":"+identity.revision)
   throw Error("INVALID_EXACT_CLAIM_IDENTITY");
  compareRevisions(identity.revision,identity.revision);
  return col.doc(identity.key);
 }
 function clock(){const n=nowMs();if(!Number.isSafeInteger(n)||n<1)throw Error("INVALID_TRUSTED_CLOCK");return n;}
 function checkWorker(worker){if(typeof worker!=="string"||!WORKER.test(worker))throw Error("INVALID_WORKER_ID");}
 async function acquire({identity,worker,leaseMs=30000}){
  const ref=refFor(identity);checkWorker(worker);
  if(!Number.isSafeInteger(leaseMs)||leaseMs<1000||leaseMs>300000)throw Error("INVALID_LEASE_DURATION");
  const now=clock();
  return db.runTransaction(async tx=>{
   const snap=await tx.get(ref),old=snap.exists?snap.data():null;
   if(old&&old.digest!==identity.digest)throw Error("EXACT_CLAIM_DIGEST_CONFLICT");
   if(old&&FINAL.has(old.state))return {status:"TERMINAL",state:old.state};
   if(old&&old.state==="HELD"&&old.expiresAt>now)return {status:"BUSY"};
   const generation=old?old.generation+1:1,expiresAt=now+leaseMs;
   if(!Number.isSafeInteger(generation)||!Number.isSafeInteger(expiresAt))throw Error("EXACT_CLAIM_OVERFLOW");
   const claim={key:identity.key,digest:identity.digest,worker,generation,expiresAt,state:"HELD"};
   if(old)tx.update(ref,claim);else tx.create(ref,claim);
   return {status:"ACQUIRED",...claim};
  });
 }
 async function verify({identity,worker,generation}){
  const ref=refFor(identity);checkWorker(worker);
  if(!Number.isSafeInteger(generation)||generation<1)throw Error("INVALID_CLAIM_GENERATION");
  const now=clock();
  return db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   if(!snap.exists)return false;
   const c=snap.data();
   if(c.digest!==identity.digest)throw Error("EXACT_CLAIM_DIGEST_CONFLICT");
   return c.state==="HELD"&&c.worker===worker&&c.generation===generation&&c.expiresAt>now;
  });
 }
 async function complete({identity,worker,generation,outcome}){
  const ref=refFor(identity);checkWorker(worker);
  if(!Number.isSafeInteger(generation)||generation<1||!FINAL.has(outcome))throw Error("INVALID_CLAIM_COMPLETION");
  const now=clock();
  return db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   if(!snap.exists)return {status:"FENCED"};
   const c=snap.data();
   if(c.digest!==identity.digest)throw Error("EXACT_CLAIM_DIGEST_CONFLICT");
   if(c.state!=="HELD"||c.worker!==worker||c.generation!==generation||c.expiresAt<=now)return {status:"FENCED"};
   tx.update(ref,{...c,state:outcome,expiresAt:now});
   return {status:"COMPLETED",state:outcome};
  });
 }
 return Object.freeze({acquire,verify,complete});
}
module.exports=Object.freeze({createExactClaimCoordinator,COLLECTION});
