"use strict";
const assert=require("node:assert/strict");
const {createRecoveryStore}=require("../functions/phase17RecoveryFirestoreStore");
const {createClaimCoordinator}=require("../functions/phase17RecoveryClaim");
const {prepareStrict}=require("../functions/phase17StrictRecovery");
const {reconcileStrictWithClaim}=require("../functions/phase17StrictClaimedRecovery");
const {fingerprint}=require("../functions/phase17DurableRecovery");
class Db{
 constructor(){this.docs=new Map();this.queue=Promise.resolve();}
 collection(c){return {doc:id=>({key:c+"/"+id,get:async()=>this.snap(c+"/"+id)})};}
 snap(k){const v=this.docs.get(k);return {exists:v!==undefined,data:()=>structuredClone(v)};}
 runTransaction(fn){
  const job=this.queue.then(async()=>{
   const writes=[];const tx={get:async r=>this.snap(r.key),create:(r,v)=>writes.push([r.key,structuredClone(v)]),update:(r,v)=>writes.push([r.key,structuredClone(v)]),set:(r,v)=>writes.push([r.key,structuredClone(v)])};
   const result=await fn(tx);for(const [k,v] of writes)this.docs.set(k,v);return result;
  });this.queue=job.catch(()=>{});return job;
 }
}
(async()=>{
 let now=10000;
 const store=createRecoveryStore({db:new Db(),strict:true});
 const claims=createClaimCoordinator({db:new Db(),nowMs:()=>now});
 const uid="owner_1",profile={businessId:uid,name:"Demo Salon",slug:"demo-salon",category:"Hair",phone:"",address:"",description:"",acceptingBookings:false};
 const entry=await prepareStrict({store,command:{uid,version:90,operation:"publish",profile}});
 const current=async()=>({version:90,operation:"publish",fingerprint:fingerprint(entry.command)});
 let sends=0,seenFence;
 const first=await reconcileStrictWithClaim({store,claims,key:entry.key,worker:"worker_a",leaseMs:1000,readCurrent:current,send:async(_c,fence)=>{
  sends++;seenFence=fence;throw Error("LOST_REPLY");
 }});
 assert.equal(first.status,"UNKNOWN");
 assert.equal(seenFence.requiresDestinationFence,true);
 assert.equal(seenFence.generation,1);
 assert.equal((await store.get(entry.key)).state,"UNKNOWN");
 const busy=await reconcileStrictWithClaim({store,claims,key:entry.key,worker:"worker_b",leaseMs:1000,readCurrent:current,send:async()=>{sends++;}});
 assert.equal(busy.status,"BUSY");assert.equal(sends,1);
 now=11000;
 const recovered=await reconcileStrictWithClaim({store,claims,key:entry.key,worker:"worker_b",leaseMs:1000,readCurrent:current,send:async(_c,fence)=>{
  sends++;assert.equal(fence.generation,2);return {status:"ALREADY_APPLIED"};
 }});
 assert.equal(recovered.status,"CONFIRMED");assert.equal(sends,2);
 assert.equal((await claims.verify({key:entry.key,worker:"worker_a",generation:1})),false);
 assert.equal((await store.get(entry.key)).state,"CONFIRMED");
 const terminal=await reconcileStrictWithClaim({store,claims,key:entry.key,worker:"worker_c",readCurrent:current,send:async()=>{sends++;}});
 assert.equal(terminal.status,"TERMINAL");assert.equal(sends,2);
 const stale=await prepareStrict({store,command:{uid,version:91,operation:"publish",profile}});
 const blocked=await reconcileStrictWithClaim({store,claims,key:stale.key,worker:"worker_a",readCurrent:async()=>null,send:async()=>{sends++;}});
 assert.equal(blocked.status,"BLOCKED");assert.equal(sends,2);
 console.log("PASS PHASE17_STRICT_CLAIMED_RECOVERY: lost response, lease takeover, CAS journal, destination fence handoff, terminal and stale-source protection");
 console.log("OFFLINE_FAKE_DATABASES_NO_FIREBASE_NO_DEPLOYMENT_CROSS_DB_RACE_NOT_PROVEN_SAFE");
})().catch(e=>{console.error(e);process.exitCode=1;});
