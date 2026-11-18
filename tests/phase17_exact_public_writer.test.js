"use strict";
const assert=require("node:assert/strict");
const {applyExactPublish}=require("../functions/phase17ExactPublicWriter");
const {exactPublicationIdentity}=require("../functions/phase17ExactPublicationIdentity");
class Db{
 constructor(){this.docs=new Map();this.queue=Promise.resolve();}
 collection(c){return {doc:id=>({key:c+"/"+id})};}
 runTransaction(fn){const job=this.queue.then(async()=>{const writes=[],tx={get:async r=>{const v=this.docs.get(r.key);return {exists:v!==undefined,data:()=>structuredClone(v),get:k=>v?.[k]};},set:(r,v)=>writes.push(["set",r.key,structuredClone(v)]),delete:r=>writes.push(["delete",r.key])};const result=await fn(tx);for(const [op,k,v]of writes)op==="set"?this.docs.set(k,v):this.docs.delete(k);return result;});this.queue=job.catch(()=>{});return job;}
}
(async()=>{
 const db=new Db(),uid="owner_1",snap=n=>({exists:true,updateTime:{seconds:1763450000,nanoseconds:n}});
 const profile={businessId:uid,name:"Demo Salon",slug:"demo-salon",category:"Hair",phone:"",address:"",description:""};
 const a=exactPublicationIdentity({uid,operation:"publish",snapshot:snap(123456001),profile});
 const b=exactPublicationIdentity({uid,operation:"publish",snapshot:snap(123456002),profile});
 const putClaim=(id,worker="worker1")=>db.docs.set("publicationExactRecoveryClaims/"+id.key,{key:id.key,digest:id.digest,worker,generation:1,state:"HELD",expiresAt:5000});
 const run=(id,n,extra={})=>applyExactPublish({db,identity:id,profile,sourceSnapshot:snap(n),nowMs:()=>1000,claimPlacement:"destination-transaction",...extra});
 assert.equal((await run(a,123456001)).status,"FENCED");
 putClaim(a);
 assert.equal((await run(a,123456001)).status,"PUBLISHED");
 assert.equal((await run(a,123456001)).status,"ALREADY_APPLIED");
 putClaim(b);
 assert.equal((await run(b,123456002)).status,"PUBLISHED");
 assert.equal((await run(a,123456001)).status,"STALE");
 assert.equal(db.docs.get("publicBusinesses/"+uid).fullPrecisionRevision,b.revision);
 await assert.rejects(()=>run(b,123456001),/SOURCE_MISMATCH/);
 await assert.rejects(()=>run(b,123456002,{claimPlacement:"private-database"}),/CROSS_DATABASE_CLAIM_NOT_ATOMIC/);
 const other=new Db();other.docs.set("publicBusinesses/"+uid,{publicationVersion:a.legacyVersion,slug:"demo-salon"});
 other.docs.set("publicationExactRecoveryClaims/"+b.key,db.docs.get("publicationExactRecoveryClaims/"+b.key));
 await assert.rejects(()=>applyExactPublish({db:other,identity:b,profile,sourceSnapshot:snap(123456002),nowMs:()=>1000,claimPlacement:"destination-transaction"}),/MIGRATION_REQUIRED/);
 assert.equal(other.docs.get("publicBusinesses/"+uid).publicationVersion,a.legacyVersion);
 console.log("PASS PHASE17_EXACT_PUBLIC_WRITER: atomic destination claim, nanosecond stale rejection, idempotency, source mismatch, legacy migration refusal");
 console.log("OFFLINE_ONLY_NO_FIREBASE_NO_DEPLOYMENT_NO_UNPUBLISH");
})().catch(e=>{console.error(e);process.exitCode=1;});
