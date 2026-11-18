"use strict";
const assert=require("node:assert/strict");
const {createClaimCoordinator,COLLECTION}=require("../functions/phase17RecoveryClaim");
const rows=new Map();let now=10000,lock=Promise.resolve();
const db={
 collection(name){assert.equal(name,COLLECTION);return {doc:id=>({id})};},
 runTransaction(fn){
  const work=lock.then(async()=>{
   const writes=[];
   const tx={
    get:async ref=>({exists:rows.has(ref.id),data:()=>structuredClone(rows.get(ref.id))}),
    create:(ref,data)=>writes.push([ref.id,structuredClone(data)]),
    update:(ref,data)=>writes.push([ref.id,structuredClone(data)])
   };
   const result=await fn(tx);
   for(const [key,data] of writes)rows.set(key,data);
   return result;
  });
  lock=work.catch(()=>{});return work;
 }
};
(async()=>{
 const coordinator=createClaimCoordinator({db,nowMs:()=>now});
 const key="owner_1:publish:99";
 const [a,b]=await Promise.all([
  coordinator.acquire({key,worker:"worker_a"}),
  coordinator.acquire({key,worker:"worker_b"})
 ]);
 assert.equal([a.status,b.status].filter(s=>s==="ACQUIRED").length,1);
 assert.equal([a.status,b.status].filter(s=>s==="BUSY").length,1);
 const winner=a.status==="ACQUIRED"?a:b;
 const winnerId=winner.worker;
 assert.equal((await coordinator.acquire({key,worker:"worker_c"})).status,"BUSY");
 assert.equal((await coordinator.complete({key,worker:"imposter",generation:winner.generation,outcome:"CONFIRMED"})).status,"FENCED");
 now+=30001;
 const replacement=await coordinator.acquire({key,worker:"worker_c"});
 assert.equal(replacement.status,"ACQUIRED");
 assert.equal(replacement.generation,winner.generation+1);
 assert.equal((await coordinator.complete({key,worker:winnerId,generation:winner.generation,outcome:"CONFIRMED"})).status,"FENCED");
 assert.equal((await coordinator.complete({key,worker:"worker_c",generation:replacement.generation,outcome:"CONFIRMED"})).status,"COMPLETED");
 assert.equal((await coordinator.acquire({key,worker:"worker_d"})).status,"TERMINAL");
 await assert.rejects(()=>coordinator.acquire({key:"bad/key",worker:"worker_a"}),/INVALID_CLAIM_KEY/);
 await assert.rejects(()=>coordinator.acquire({key:"valid",worker:"worker_a",leaseMs:0}),/INVALID_LEASE_DURATION/);
 await assert.rejects(()=>coordinator.complete({key,worker:"worker_a",generation:0,outcome:"CONFIRMED"}),/INVALID_CLAIM_COMPLETION/);
 console.log("PASS PHASE17_RECOVERY_CLAIMS: one winner, lease expiry, fencing generation, terminal protection");
 console.log("OFFLINE_SERIALIZED_FAKE_TRANSACTIONS_NO_LIVE_FIRESTORE_NO_DEPLOYMENT");
})().catch(e=>{console.error(e);process.exitCode=1;});
