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
 const db=new Db(),uid="owner_1",profile={businessId:uid,name:"Demo Salon",slug:"demo-salon",category:"Hair",phone:"",address:"",description:"",acceptingBookings:false};
 const command={uid,operation:"publish",version:1,profile};
 const key=uid+":publish:1",fence=(worker,generation)=>({fence:{key,worker,generation},requireFence:true});
 await assert.rejects(()=>applyPublicListingCommand(db,command,{requireFence:true}),/DESTINATION_FENCE_REQUIRED/);
 assert.equal((await applyPublicListingCommand(db,command,fence("worker_a",1))).status,"PUBLISHED");
 assert.equal((await applyPublicListingCommand(db,command,fence("worker_b",2))).status,"ALREADY_APPLIED");
 assert.equal((await applyPublicListingCommand(db,command,fence("worker_a",1))).status,"FENCED");
 assert.equal((await applyPublicListingCommand(db,command,fence("worker_c",2))).status,"FENCED");
 assert.equal((await applyPublicListingCommand(db,command,fence("worker_b",2))).status,"ALREADY_APPLIED");
 assert.equal(db.docs.get("publicationDestinationFences/"+key).generation,2);
 const conflict={...command,profile:{...command.profile,name:"Conflicting Salon"}};
 assert.equal((await applyPublicListingCommand(db,conflict,fence("attacker",3))).status,"VERSION_CONFLICT");
 assert.equal(db.docs.get("publicationDestinationFences/"+key).generation,2);
 assert.equal((await applyPublicListingCommand(db,command,fence("worker_b",2))).status,"ALREADY_APPLIED");
 const unknown={uid:"missing_owner",operation:"unpublish",version:3};
 const unknownFence={key:"missing_owner:unpublish:3",worker:"worker_c",generation:1};
 assert.equal((await applyPublicListingCommand(db,unknown,{requireFence:true,fence:unknownFence})).status,"NOT_FOUND");
 assert.equal(db.docs.has("publicationDestinationFences/"+unknownFence.key),false);
 assert.equal(db.docs.get("publicBusinesses/"+uid).acceptingBookings,false);
 console.log("PASS PHASE17_DESTINATION_FENCE: newer generation persisted; stale worker blocked; rejected requests cannot advance fence");
 console.log("OFFLINE_ONLY_FAKE_DATABASE_NO_FIRESTORE_NO_DEPLOYMENT");
})().catch(e=>{console.error(e);process.exitCode=1;});
