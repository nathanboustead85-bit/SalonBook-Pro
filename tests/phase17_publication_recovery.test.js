"use strict";
const assert=require("node:assert/strict");
const {executeWithRecovery}=require("../functions/phase17PublicationRecovery");
const command={uid:"owner_1",operation:"publish",version:123,profile:{businessId:"owner_1",acceptingBookings:false,name:"Demo Salon"}};
(async()=>{
 let calls=0;const versions=[];
 const result=await executeWithRecovery({command,send:async c=>{
  calls++;versions.push(c.version);assert.equal(Object.isFrozen(c),true);
  if(calls<3)throw Object.assign(Error("timeout"),{code:"unavailable"});
  return {status:"PUBLISHED",slug:"demo-salon"};
 }});
 assert.deepEqual(result,{status:"PUBLISHED",slug:"demo-salon",attempts:3});
 assert.deepEqual(versions,[123,123,123]);
 let nonRetry=0;
 const permanent=await executeWithRecovery({command,send:async()=>{nonRetry++;throw Object.assign(Error("denied"),{code:"permission-denied"});}});
 assert.equal(permanent.status,"PERMANENT_FAILURE");assert.equal(nonRetry,1);
 for(const status of ["STALE","SLUG_TAKEN","INCONSISTENT_RESERVATION","ALREADY_APPLIED"]){
  let count=0;
  const r=await executeWithRecovery({command,send:async()=>{count++;return {status};}});
  assert.equal(r.status,status);assert.equal(count,1);
 }
 let exhausted=0;
 const e=await executeWithRecovery({command,maxAttempts:2,send:async()=>{exhausted++;throw Object.assign(Error("offline"),{code:14});}});
 assert.equal(e.status,"RETRY_EXHAUSTED_REQUIRES_RECONCILIATION");assert.equal(exhausted,2);
 assert.equal((await executeWithRecovery({command,send:async()=>({status:"UNEXPECTED"})})).status,"UNKNOWN_RESULT_REQUIRES_RECONCILIATION");
 assert.throws(()=>executeWithRecovery({command:{...command,profile:{...command.profile,acceptingBookings:true}},send:async()=>({status:"PUBLISHED"})}),/UNSAFE_RECOVERY_COMMAND/);
 console.log("PASS PHASE17_PUBLICATION_RECOVERY: bounded transient retries, immutable revision, semantic stop, reconciliation required");
 console.log("OFFLINE_ONLY_NO_DURABLE_QUEUE_NO_DEPLOYMENT_NO_LIVE_FIRESTORE_WRITES");
})().catch(e=>{console.error(e);process.exitCode=1;});
