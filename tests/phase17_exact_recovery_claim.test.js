"use strict";
const assert=require("node:assert/strict");
const {createExactClaimCoordinator}=require("../functions/phase17ExactRecoveryClaim");
const {exactPublicationIdentity}=require("../functions/phase17ExactPublicationIdentity");
class Db{
 constructor(){this.docs=new Map();this.queue=Promise.resolve();}
 collection(c){return {doc:id=>({key:c+"/"+id})};}
 runTransaction(fn){const job=this.queue.then(async()=>{const writes=[],tx={get:async r=>{const v=this.docs.get(r.key);return {exists:v!==undefined,data:()=>structuredClone(v)};},create:(r,v)=>writes.push([r.key,structuredClone(v)]),update:(r,v)=>writes.push([r.key,structuredClone(v)])};const result=await fn(tx);for(const [k,v]of writes)this.docs.set(k,v);return result;});this.queue=job.catch(()=>{});return job;}
}
(async()=>{
 let now=100000;const db=new Db(),claims=createExactClaimCoordinator({db,nowMs:()=>now});
 const uid="owner_1",snap=n=>({exists:true,updateTime:{seconds:1763450000,nanoseconds:n}});
 const a=exactPublicationIdentity({uid,operation:"unpublish",snapshot:snap(123456001)});
 const b=exactPublicationIdentity({uid,operation:"unpublish",snapshot:snap(123456002)});
 const [first,second]=await Promise.all([claims.acquire({identity:a,worker:"w1",leaseMs:1000}),claims.acquire({identity:a,worker:"w2",leaseMs:1000})]);
 assert.equal([first.status,second.status].sort().join(","),"ACQUIRED,BUSY");
 assert.equal((await claims.acquire({identity:b,worker:"w2"})).status,"ACQUIRED");
 assert.equal(await claims.verify({identity:a,worker:"w1",generation:1}),true);
 const fake={...a,digest:"0".repeat(64)};
 await assert.rejects(()=>claims.verify({identity:fake,worker:"w1",generation:1}),/DIGEST_CONFLICT/);
 now=101001;
 const next=await claims.acquire({identity:a,worker:"w2",leaseMs:1000});
 assert.equal(next.generation,2);
 assert.equal((await claims.complete({identity:a,worker:"w1",generation:1,outcome:"CONFIRMED"})).status,"FENCED");
 assert.equal(await claims.verify({identity:a,worker:"w2",generation:2}),true);
 assert.equal((await claims.complete({identity:a,worker:"w2",generation:2,outcome:"CONFIRMED"})).status,"COMPLETED");
 assert.equal((await claims.acquire({identity:a,worker:"w3"})).status,"TERMINAL");
 console.log("PASS PHASE17_EXACT_CLAIMS: nanosecond isolation, digest binding, competing workers, expired leases and fencing");
 console.log("OFFLINE_ONLY_CLAIMS_ARE_NOT_ATOMIC_WITH_REMOTE_DESTINATION");
})().catch(e=>{console.error(e);process.exitCode=1;});
