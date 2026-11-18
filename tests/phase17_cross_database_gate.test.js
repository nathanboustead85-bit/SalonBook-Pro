"use strict";
const assert=require("node:assert/strict");
const {applyWithAuthoritativeClaim}=require("../functions/phase17CrossDatabaseSafetyGate");
class Db{
 constructor(){this.docs=new Map();this.queue=Promise.resolve();this.transactions=0;}
 collection(c){return {doc:id=>({key:c+"/"+id})};}
 snap(k){const v=this.docs.get(k);return {exists:v!==undefined,data:()=>structuredClone(v),get:f=>v?.[f]};}
 runTransaction(fn){this.transactions++;const job=this.queue.then(async()=>{const writes=[];const tx={get:async r=>this.snap(r.key),set:(r,v)=>writes.push(["set",r.key,structuredClone(v)]),delete:r=>writes.push(["delete",r.key])};const result=await fn(tx);for(const [op,k,v] of writes){if(op==="delete")this.docs.delete(k);else this.docs.set(k,v);}return result;});this.queue=job.catch(()=>{});return job;}
}
(async()=>{
 const privateDb=new Db(),publicDb=new Db(),uid="owner_1",key=uid+":publish:1",fence={key,worker:"worker_a",generation:1,requiresDestinationFence:true};
 const command={uid,version:1,operation:"publish",profile:{businessId:uid,name:"Demo Salon",slug:"demo-salon",category:"Hair",phone:"",address:"",description:"",acceptingBookings:false}};
 privateDb.docs.set("publicationRecoveryClaims/"+key,{key,worker:"worker_a",generation:1,state:"HELD",expiresAt:20000});
 const args={publicDb,command,fence,nowMs:()=>10000};
 await assert.rejects(()=>applyWithAuthoritativeClaim({...args,claimPlacement:"private-database"}),/CROSS_DATABASE_CLAIM_NOT_ATOMIC/);
 await assert.rejects(()=>applyWithAuthoritativeClaim({...args}),/CROSS_DATABASE_CLAIM_NOT_ATOMIC/);
 assert.equal(publicDb.transactions,0);
 assert.equal(publicDb.docs.size,0);
 // The private claim is not available to a public transaction: fail closed.
 assert.equal((await applyWithAuthoritativeClaim({...args,claimPlacement:"destination-transaction"})).status,"FENCED");
 assert.equal(publicDb.docs.has("publicBusinesses/"+uid),false);
 // A separately copied snapshot is NOT an authoritative claim protocol.
 // Test only the co-located option, where takeover is visible transactionally.
 publicDb.docs.set("publicationRecoveryClaims/"+key,{key,worker:"worker_b",generation:2,state:"HELD",expiresAt:20000});
 assert.equal((await applyWithAuthoritativeClaim({...args,claimPlacement:"destination-transaction"})).status,"FENCED");
 assert.equal(publicDb.docs.has("publicBusinesses/"+uid),false);
 const accepted=await applyWithAuthoritativeClaim({...args,fence:{...fence,worker:"worker_b",generation:2},claimPlacement:"destination-transaction"});
 assert.equal(accepted.status,"PUBLISHED");
 assert.equal(publicDb.docs.get("publicBusinesses/"+uid).acceptingBookings,false);
 console.log("PASS PHASE17_CROSS_DATABASE_GATE: separate-claim path fails closed; destination claim required; stale worker rejected");
 console.log("OFFLINE_SIMULATION_ONLY_NO_CROSS_DATABASE_ATOMICITY_CLAIM_NO_FIREBASE");
})().catch(e=>{console.error(e);process.exitCode=1;});
