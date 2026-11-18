"use strict";
const assert=require("node:assert/strict");
const {createRecoveryStore}=require("../functions/phase17RecoveryFirestoreStore");
const {createClaimCoordinator}=require("../functions/phase17RecoveryClaim");
const {prepare,reconcile,fingerprint}=require("../functions/phase17DurableRecovery");
const {applyPublicListingCommand}=require("../functions/phase17PublicDatabaseWriter");
// Serialized transactional fake: all journal, claim and public writes commit atomically.
// This is not an emulator or a substitute for real cross-process integration testing.
class FakeDb {
 constructor(){this.docs=new Map();this.queue=Promise.resolve();}
 collection(name){return {doc:id=>({key:name+"/"+id,id,get:async()=>this.snapshot(name+"/"+id)})};}
 snapshot(key){const value=this.docs.get(key);return {exists:value!==undefined,data:()=>structuredClone(value),get:k=>value?.[k]};}
 runTransaction(fn){
  const task=this.queue.then(async()=>{
   const writes=[];
   const tx={
    get:async ref=>this.snapshot(ref.key),
    create:(ref,data)=>writes.push(["set",ref.key,structuredClone(data)]),
    update:(ref,data)=>writes.push(["set",ref.key,structuredClone(data)]),
    set:(ref,data)=>writes.push(["set",ref.key,structuredClone(data)]),
    delete:ref=>writes.push(["delete",ref.key])
   };
   const result=await fn(tx);
   for(const [op,key,value] of writes){if(op==="delete")this.docs.delete(key);else this.docs.set(key,value);}
   return result;
  });
  this.queue=task.catch(()=>{});return task;
 }
}
const uid="owner_1";
const profile={businessId:uid,name:"Demo Salon",slug:"demo-salon",category:"Hair",phone:"",address:"",description:"",privateNotes:"PRIVATE",appointments:[{id:"ORIGINAL_APPOINTMENT"}]};
const command={uid,version:101,operation:"publish",profile:{...profile,acceptingBookings:false}};
(async()=>{
 const journalDb=new FakeDb(),claimsDb=new FakeDb(),publicDb=new FakeDb();
 const store=createRecoveryStore({db:journalDb});
 let now=10000;
 const claims=createClaimCoordinator({db:claimsDb,nowMs:()=>now});
 const pending=await prepare({store,command});
 assert.equal(pending.state,"PENDING");
 const [a,b]=await Promise.all([claims.acquire({key:pending.key,worker:"worker_a",leaseMs:1000}),claims.acquire({key:pending.key,worker:"worker_b",leaseMs:1000})]);
 assert.equal(a.status,"ACQUIRED");assert.equal(b.status,"BUSY");
 let writes=0;
 const lost=await reconcile({store,key:pending.key,readCurrent:async()=>({version:101,operation:"publish",fingerprint:fingerprint(command)}),send:async c=>{
  writes++;assert.equal((await applyPublicListingCommand(publicDb,c)).status,"PUBLISHED");
  throw Error("RESPONSE_LOST_AFTER_COMMIT");
 }});
 assert.equal(lost.state,"UNKNOWN");
 assert.equal((await store.get(pending.key)).state,"UNKNOWN");
 assert.equal(publicDb.docs.get("publicBusinesses/"+uid).acceptingBookings,false);
 assert.equal(JSON.stringify([...publicDb.docs]).includes("PRIVATE"),false);
 assert.equal(JSON.stringify([...publicDb.docs]).includes("ORIGINAL_APPOINTMENT"),false);
 now+=1001;
 const takeover=await claims.acquire({key:pending.key,worker:"worker_b",leaseMs:1000});
 assert.equal(takeover.status,"ACQUIRED");
 assert.equal((await claims.complete({key:pending.key,worker:"worker_a",generation:a.generation,outcome:"CONFIRMED"})).status,"FENCED");
 // Simulate process restart: reload recovery module and reuse persisted journal.
 delete require.cache[require.resolve("../functions/phase17DurableRecovery")];
 const restart=require("../functions/phase17DurableRecovery");
 const result=await restart.reconcile({store,key:pending.key,readCurrent:async()=>({version:101,operation:"publish",fingerprint:fingerprint(command)}),send:async c=>{
  writes++;return applyPublicListingCommand(publicDb,c);
 }});
 assert.equal(result.state,"CONFIRMED");assert.equal(result.result,"ALREADY_APPLIED");
 assert.equal(writes,2);
 assert.equal((await claims.complete({key:pending.key,worker:"worker_b",generation:takeover.generation,outcome:"CONFIRMED"})).status,"COMPLETED");
 assert.equal((await claims.acquire({key:pending.key,worker:"worker_c"})).status,"TERMINAL");
 const newCommand={...command,version:102,profile:{...command.profile,name:"Updated Salon"}};
 const fresh=await restart.prepare({store,command:newCommand});
 let staleWrites=0;
 const blocked=await restart.reconcile({store,key:fresh.key,readCurrent:async()=>({version:103,operation:"publish",fingerprint:"changed"}),send:async()=>{staleWrites++;}});
 assert.equal(blocked.state,"BLOCKED");assert.equal(staleWrites,0);
 assert.equal(publicDb.docs.get("publicBusinesses/"+uid).name,"Demo Salon");
 console.log("PASS PHASE17_END_TO_END_RECOVERY: publish, lost response, restart, one worker, fencing, replay, stale source, privacy");
 console.log("OFFLINE_ONLY_FAKE_DATABASES_NO_FIRESTORE_CONNECTION_NO_DEPLOYMENT_NO_REAL_BOOKINGS");
})().catch(error=>{console.error(error);process.exitCode=1;});
