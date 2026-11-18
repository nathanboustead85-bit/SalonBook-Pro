"use strict";
const assert=require("node:assert/strict");
const {applyExactUnpublish}=require("../functions/phase17ExactUnpublishWriter");
const {exactPublicationIdentity}=require("../functions/phase17ExactPublicationIdentity");
class Db{
 constructor(){this.docs=new Map();this.queue=Promise.resolve();}
 collection(c){return {doc:id=>({key:c+"/"+id})};}
 runTransaction(fn){const job=this.queue.then(async()=>{const writes=[],tx={get:async r=>{const v=this.docs.get(r.key);return {exists:v!==undefined,data:()=>structuredClone(v),get:k=>v?.[k]};},set:(r,v)=>writes.push(["set",r.key,structuredClone(v)])};const result=await fn(tx);for(const [op,k,v]of writes)if(op==="set")this.docs.set(k,v);return result;});this.queue=job.catch(()=>{});return job;}
}
(async()=>{
 const uid="owner_1",db=new Db(),snap=n=>({exists:true,updateTime:{seconds:1763450000,nanoseconds:n}});
 const prior=exactPublicationIdentity({uid,operation:"unpublish",snapshot:snap(123456001)});
 const current=exactPublicationIdentity({uid,operation:"unpublish",snapshot:snap(123456002)});
 const later=exactPublicationIdentity({uid,operation:"unpublish",snapshot:snap(123456003)});
 const claim=id=>db.docs.set("publicationExactRecoveryClaims/"+id.key,{key:id.key,digest:id.digest,worker:"w1",generation:1,state:"HELD",expiresAt:5000});
 const run=(id,n,extra={})=>applyExactUnpublish({db,identity:id,sourceSnapshot:snap(n),nowMs:()=>1000,claimPlacement:"destination-transaction",...extra});
 const key="publicBusinesses/"+uid;
 db.docs.set(key,{businessId:uid,slug:"demo-salon",published:true,acceptingBookings:false,fullPrecisionRevision:prior.revision,exactPublicationDigest:prior.digest});
 db.docs.set("businessSlugs/demo-salon",{businessId:uid});
 db.docs.set("publicSlugMappings/demo-salon",{businessId:uid,published:true});
 assert.equal((await run(current,123456002)).status,"FENCED");
 claim(current);
 assert.equal((await run(current,123456002)).status,"UNPUBLISHED");
 assert.equal((await run(current,123456002)).status,"ALREADY_APPLIED");
 assert.equal(db.docs.get(key).published,false);
 assert.equal(db.docs.get("publicSlugMappings/demo-salon").published,false);
 assert.equal(db.docs.get("businessSlugs/demo-salon").businessId,uid);
 claim(prior);
 assert.equal((await run(prior,123456001)).status,"STALE");
 await assert.rejects(()=>run(current,123456001),/SOURCE_MISMATCH/);
 await assert.rejects(()=>run(current,123456002,{claimPlacement:"private-database"}),/CROSS_DATABASE_CLAIM_NOT_ATOMIC/);
 claim(later);
 db.docs.delete("publicSlugMappings/demo-salon");
 assert.equal((await run(later,123456003)).status,"INCONSISTENT_RESERVATION");
 assert.equal(db.docs.get(key).fullPrecisionRevision,current.revision);
 const legacy=new Db();
 legacy.docs.set(key,{businessId:uid,slug:"demo-salon",publicationVersion:prior.legacyVersion});
 legacy.docs.set("publicationExactRecoveryClaims/"+current.key,db.docs.get("publicationExactRecoveryClaims/"+current.key));
 await assert.rejects(()=>applyExactUnpublish({db:legacy,identity:current,sourceSnapshot:snap(123456002),nowMs:()=>1000,claimPlacement:"destination-transaction"}),/MIGRATION_REQUIRED/);
 console.log("PASS PHASE17_EXACT_UNPUBLISH: destination claim, monotonic revisions, idempotency, reservation integrity, legacy rejection");
 console.log("OFFLINE_ONLY_NO_LIVE_FIREBASE_NO_CROSS_DATABASE_ATOMICITY");
})().catch(e=>{console.error(e);process.exitCode=1;});
