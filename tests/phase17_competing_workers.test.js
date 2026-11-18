"use strict";
const assert=require("node:assert/strict");
const {createClaimCoordinator}=require("../functions/phase17RecoveryClaim");
const {applyPublicListingCommand}=require("../functions/phase17PublicDatabaseWriter");
// Transaction-serialized fake. No actual network, Firestore emulator or live DB.
class Db{
 constructor(){this.docs=new Map();this.queue=Promise.resolve();}
 collection(c){return {doc:id=>({key:c+"/"+id})};}
 runTransaction(fn){
  const work=this.queue.then(async()=>{
   const writes=[];
   const tx={
    get:async r=>{const v=this.docs.get(r.key);return {exists:v!==undefined,data:()=>structuredClone(v),get:k=>v?.[k]};},
    create:(r,v)=>writes.push(["set",r.key,structuredClone(v)]),
    update:(r,v)=>writes.push(["set",r.key,structuredClone(v)]),
    set:(r,v)=>writes.push(["set",r.key,structuredClone(v)]),
    delete:r=>writes.push(["delete",r.key])
   };
   const result=await fn(tx);
   for(const [op,key,val] of writes)op==="delete"?this.docs.delete(key):this.docs.set(key,val);
   return result;
  });
  this.queue=work.catch(()=>{});return work;
 }
}
(async()=>{
 const privateDb=new Db(),publicDb=new Db();
 let now=10000;
 const claims=createClaimCoordinator({db:privateDb,nowMs:()=>now});
 const uid="owner_1",key=uid+":publish:100";
 const profile={businessId:uid,name:"Demo Salon",slug:"demo-salon",category:"Hair",phone:"",address:"",description:"",acceptingBookings:false};
 const command={uid,operation:"publish",version:100,profile};
 const [a,b]=await Promise.all([
  claims.acquire({key,worker:"worker_a",leaseMs:1000}),
  claims.acquire({key,worker:"worker_b",leaseMs:1000})
 ]);
 assert.equal([a,b].filter(c=>c.status==="ACQUIRED").length,1);
 assert.equal([a,b].filter(c=>c.status==="BUSY").length,1);
 const first=[a,b].find(c=>c.status==="ACQUIRED");
 const original=first.worker;
 const other=original==="worker_a"?"worker_b":"worker_a";
 assert.equal(await claims.verify({key,worker:original,generation:1}),true);
 const fence=(worker,generation)=>({requireFence:true,fence:{key,worker,generation}});
 assert.equal((await applyPublicListingCommand(publicDb,command,fence(original,1))).status,"PUBLISHED");
 now=11000; // Exactly at expiration: old lease is invalid.
 assert.equal(await claims.verify({key,worker:original,generation:1}),false);
 const replacement=await claims.acquire({key,worker:other,leaseMs:1000});
 assert.equal(replacement.status,"ACQUIRED");
 assert.equal(replacement.generation,2);
 assert.equal((await applyPublicListingCommand(publicDb,command,fence(other,2))).status,"ALREADY_APPLIED");
 assert.equal((await applyPublicListingCommand(publicDb,command,fence(original,1))).status,"FENCED");
 assert.equal((await claims.complete({key,worker:original,generation:1,outcome:"CONFIRMED"})).status,"FENCED");
 assert.equal((await claims.complete({key,worker:other,generation:2,outcome:"CONFIRMED"})).status,"COMPLETED");
 assert.equal((await claims.acquire({key,worker:"worker_c",leaseMs:1000})).status,"TERMINAL");
 assert.equal(publicDb.docs.get("publicationDestinationFences/"+key).generation,2);
 assert.equal(publicDb.docs.get("publicBusinesses/"+uid).acceptingBookings,false);
 // A late older-generation command for the same key must not alter listing.
 const late={...command,profile:{...profile,name:"Late Old Worker"}};
 assert.equal((await applyPublicListingCommand(publicDb,late,fence(original,1))).status,"FENCED");
 assert.equal(publicDb.docs.get("publicBusinesses/"+uid).name,"Demo Salon");
 console.log("PASS PHASE17_COMPETING_WORKERS: concurrent acquire, exact lease boundary, takeover, destination fencing, terminal claim");
 console.log("OFFLINE_SERIALIZED_FAKE_TRANSACTIONS_NO_LIVE_FIRESTORE_NO_DEPLOYMENT");
})().catch(e=>{console.error(e);process.exitCode=1;});
