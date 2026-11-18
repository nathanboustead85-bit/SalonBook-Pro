"use strict";
const assert=require("node:assert/strict");
const {createRecoveryStore}=require("../functions/phase17RecoveryFirestoreStore");
class Db{
 constructor(){this.docs=new Map();this.queue=Promise.resolve();}
 collection(c){return {doc:id=>({key:c+"/"+id,get:async()=>this.snap(c+"/"+id)})};}
 snap(k){const v=this.docs.get(k);return {exists:v!==undefined,data:()=>structuredClone(v)};}
 runTransaction(fn){const job=this.queue.then(async()=>{const writes=[];const tx={get:async r=>this.snap(r.key),create:(r,v)=>writes.push([r.key,structuredClone(v)]),update:(r,v)=>writes.push([r.key,structuredClone(v)])};const result=await fn(tx);for(const [k,v] of writes)this.docs.set(k,v);return result;});this.queue=job.catch(()=>{});return job;}
}
(async()=>{
 const db=new Db(),store=createRecoveryStore({db});
 const key="owner_1:publish:1",command={uid:"owner_1",operation:"publish",version:1,profile:{businessId:"owner_1",acceptingBookings:false}};
 const pending={key,command,fingerprint:"abc",state:"PENDING"};
 const created=await store.put(key,pending,0);
 assert.equal(created.revision,1);
 const unknown={...pending,state:"UNKNOWN"};
 const [a,b]=await Promise.allSettled([store.put(key,unknown,1),store.put(key,unknown,1)]);
 assert.equal([a,b].filter(x=>x.status==="fulfilled").length,1);
 assert.equal([a,b].filter(x=>x.status==="rejected"&&x.reason.message==="RECOVERY_REVISION_CONFLICT").length,1);
 assert.equal((await store.get(key)).revision,2);
 await assert.rejects(()=>store.put(key,{...pending,state:"CONFIRMED"},1),/RECOVERY_REVISION_CONFLICT/);
 const confirmed=await store.put(key,{...pending,state:"CONFIRMED"},2);
 assert.equal(confirmed.revision,3);
 assert.equal((await store.put(key,{...pending,state:"CONFIRMED"},3)).revision,3);
 await assert.rejects(()=>store.put(key,{...pending,state:"BLOCKED"},3),/RECOVERY_TERMINAL_STATE_IMMUTABLE/);
 console.log("PASS PHASE17_RECOVERY_CAS: concurrent writers fenced; stale revision rejected; terminal state immutable");
 console.log("OFFLINE_ONLY_FAKE_DATABASE_NO_FIREBASE_CONNECTION_NO_DEPLOYMENT");
})().catch(e=>{console.error(e);process.exitCode=1;});
