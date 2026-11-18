"use strict";
const assert=require("node:assert/strict");
const {applyPublicListingCommand}=require("../functions/phase17PublicDatabaseWriter");
class Db{
 constructor(){this.docs=new Map();this.queue=Promise.resolve();}
 collection(c){return {doc:id=>({key:c+"/"+id})};}
 snap(k){const v=this.docs.get(k);return {exists:v!==undefined,data:()=>structuredClone(v),get:f=>v?.[f]};}
 runTransaction(fn){const job=this.queue.then(async()=>{const writes=[];const tx={get:async r=>this.snap(r.key),set:(r,v)=>writes.push(["set",r.key,structuredClone(v)]),delete:r=>writes.push(["delete",r.key])};const result=await fn(tx);for(const [op,k,v] of writes){if(op==="delete")this.docs.delete(k);else this.docs.set(k,v);}return result;});this.queue=job.catch(()=>{});return job;}
}
(async()=>{
 const db=new Db(),uid="owner_1",key=uid+":publish:1";
 const command={uid,operation:"publish",version:1,profile:{businessId:uid,name:"Demo Salon",slug:"demo-salon",category:"Hair",phone:"",address:"",description:"",acceptingBookings:false}};
 let now=10000;
 const opts=(worker,generation)=>({requireFence:true,requireAuthoritativeClaim:true,nowMs:()=>now,fence:{key,worker,generation}});
 await assert.rejects(()=>applyPublicListingCommand(db,command,{requireAuthoritativeClaim:true}),/AUTHORITATIVE_CLAIM_REQUIRED/);
 assert.equal((await applyPublicListingCommand(db,command,opts("a",1))).status,"FENCED");
 db.docs.set("publicationRecoveryClaims/"+key,{key,worker:"a",generation:1,state:"HELD",expiresAt:11000});
 now=11000;
 assert.equal((await applyPublicListingCommand(db,command,opts("a",1))).status,"FENCED");
 assert.equal(db.docs.has("publicBusinesses/"+uid),false);
 db.docs.set("publicationRecoveryClaims/"+key,{key,worker:"b",generation:2,state:"HELD",expiresAt:13000});
 assert.equal((await applyPublicListingCommand(db,command,opts("a",1))).status,"FENCED");
 assert.equal(db.docs.has("publicBusinesses/"+uid),false);
 assert.equal((await applyPublicListingCommand(db,command,opts("b",2))).status,"PUBLISHED");
 assert.equal(db.docs.get("publicBusinesses/"+uid).acceptingBookings,false);
 assert.equal((await applyPublicListingCommand(db,command,opts("a",1))).status,"FENCED");
 db.docs.set("publicationRecoveryClaims/"+key,{key,worker:"b",generation:2,state:"CONFIRMED",expiresAt:now});
 assert.equal((await applyPublicListingCommand(db,command,opts("b",2))).status,"FENCED");
 console.log("PASS PHASE17_AUTHORITATIVE_DESTINATION: expiry and takeover checked in same destination transaction; stale workers fenced");
 console.log("OFFLINE_ONLY_COLOCATED_CLAIM_SIMULATION_NOT_A_CROSS_DATABASE_SOLUTION");
})().catch(e=>{console.error(e);process.exitCode=1;});
