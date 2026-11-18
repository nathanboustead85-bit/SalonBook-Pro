"use strict";
const assert=require("node:assert/strict");
const {createExactJournal}=require("../functions/phase17ExactRecoveryJournal");
class Db{
 constructor(){this.docs=new Map();this.queue=Promise.resolve();}
 collection(c){return {doc:id=>({key:c+"/"+id,get:async()=>this.snap(c+"/"+id)})};}
 snap(k){const v=this.docs.get(k);return {exists:v!==undefined,data:()=>structuredClone(v)};}
 runTransaction(fn){const job=this.queue.then(async()=>{const writes=[];const tx={get:async r=>this.snap(r.key),create:(r,v)=>writes.push([r.key,structuredClone(v)]),update:(r,v)=>writes.push([r.key,structuredClone(v)])};const result=await fn(tx);for(const [k,v] of writes)this.docs.set(k,v);return result;});this.queue=job.catch(()=>{});return job;}
}
(async()=>{
 const db=new Db(),journal=createExactJournal({db}),uid="owner_1",snap=n=>({exists:true,updateTime:{seconds:1763450000,nanoseconds:n}});
 const profile={businessId:uid,name:"Demo Salon",slug:"demo-salon",category:"Hair",phone:"",address:"",description:"",acceptingBookings:false};
 const [a,b]=await Promise.all([journal.prepare({uid,operation:"publish",snapshot:snap(123456001),profile}),journal.prepare({uid,operation:"publish",snapshot:snap(123456002),profile})]);
 assert.notEqual(a.key,b.key);assert.equal(a.casRevision,1);assert.equal(b.casRevision,1);
 const same=await journal.prepare({uid,operation:"publish",snapshot:snap(123456001),profile});
 assert.deepEqual(same,a);
 await assert.rejects(()=>journal.transition({key:a.key,digest:a.digest,expectedRevision:1,state:"UNKNOWN",sourceSnapshot:snap(123456002)}),/SOURCE_NOT_CURRENT/);
 const unknown=await journal.transition({key:a.key,digest:a.digest,expectedRevision:1,state:"UNKNOWN",sourceSnapshot:snap(123456001)});
 assert.equal(unknown.casRevision,2);
 await assert.rejects(()=>journal.transition({key:a.key,digest:a.digest,expectedRevision:1,state:"CONFIRMED",sourceSnapshot:snap(123456001)}),/CAS_CONFLICT/);
 const confirmed=await journal.transition({key:a.key,digest:a.digest,expectedRevision:2,state:"CONFIRMED",sourceSnapshot:snap(123456001)});
 assert.equal(confirmed.state,"CONFIRMED");
 await assert.rejects(()=>journal.transition({key:a.key,digest:a.digest,expectedRevision:3,state:"BLOCKED"}),/TERMINAL_IMMUTABLE/);
 const blocked=await journal.transition({key:b.key,digest:b.digest,expectedRevision:1,state:"BLOCKED"});
 assert.equal(blocked.state,"BLOCKED");
 await assert.rejects(()=>journal.prepare({uid,operation:"publish",snapshot:snap(123456003),profile:{...profile,privateNotes:"secret"}}),/PRIVATE_PROFILE_FIELD_REJECTED/);
 console.log("PASS PHASE17_EXACT_JOURNAL: nanosecond-separated entries, CAS, source freshness, terminal safety, private field rejection");
 console.log("OFFLINE_ONLY_NOT_CONNECTED_TO_REMOTE_PUBLICATION_OR_LEGACY_CLAIMS");
})().catch(e=>{console.error(e);process.exitCode=1;});
