"use strict";
const assert=require("node:assert/strict");
const {createRecoveryStore}=require("../functions/phase17RecoveryFirestoreStore");
class FakeDb{
 constructor(){this.docs=new Map();this.queue=Promise.resolve();}
 collection(name){return {doc:id=>({key:name+"/"+id,get:async()=>this.snapshot(name+"/"+id)})};}
 snapshot(key){const value=this.docs.get(key);return {exists:value!==undefined,data:()=>structuredClone(value)};}
 runTransaction(fn){
  const work=this.queue.then(async()=>{
   const writes=[];
   const tx={get:async ref=>this.snapshot(ref.key),create:(ref,value)=>writes.push([ref.key,structuredClone(value)]),update:(ref,value)=>writes.push([ref.key,structuredClone(value)])};
   const result=await fn(tx);
   for(const [key,value] of writes)this.docs.set(key,value);
   return result;
  });
  this.queue=work.catch(()=>{});return work;
 }
}
(async()=>{
 const db=new FakeDb(),store=createRecoveryStore({db,strict:true});
 const uid="owner_1",version=42,key=uid+":publish:"+version;
 const profile={businessId:uid,name:"Demo Salon",slug:"demo-salon",category:"Hair",phone:"",address:"",description:"",published:true,acceptingBookings:false,schemaVersion:1};
 const entry={key,fingerprint:"fixture",state:"PENDING",command:{uid,version,operation:"publish",profile}};
 await assert.rejects(()=>store.put(key,entry),/RECOVERY_CAS_REQUIRED/);
 await assert.rejects(()=>store.put(key,{...entry,command:{...entry.command,profile:{...profile,privateNotes:"SECRET"}}},0),/PRIVATE_OR_UNCANONICAL_JOURNAL_PROFILE/);
 await assert.rejects(()=>store.put(key,{...entry,command:{...entry.command,profile:{...profile,acceptingBookings:true}}},0),/RECOVERY_BOOKINGS_MUST_BE_DISABLED/);
 await assert.rejects(()=>store.put(key,{...entry,command:{...entry.command,version:43}},0),/STRICT_RECOVERY_KEY_MISMATCH/);
 const created=await store.put(key,entry,0);
 assert.equal(created.revision,1);
 const results=await Promise.allSettled([
  store.put(key,{...entry,state:"UNKNOWN"},1),
  store.put(key,{...entry,state:"UNKNOWN"},1)
 ]);
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(results.filter(x=>x.status==="rejected"&&/RECOVERY_REVISION_CONFLICT/.test(x.reason.message)).length,1);
 const saved=await store.get(key);
 assert.equal(saved.revision,2);
 assert.equal(JSON.stringify(saved).includes("SECRET"),false);
 const unpublishKey=uid+":unpublish:43";
 const unpublish={key:unpublishKey,fingerprint:"fixture2",state:"PENDING",command:{uid,version:43,operation:"unpublish"}};
 await assert.rejects(()=>store.put(unpublishKey,{...unpublish,command:{...unpublish.command,profile:{acceptingBookings:false,privateNotes:"SECRET"}}},0),/UNPUBLISH_JOURNAL_PROFILE_FORBIDDEN/);
 assert.equal((await store.put(unpublishKey,unpublish,0)).revision,1);
 console.log("PASS PHASE17_STRICT_JOURNAL: mandatory CAS, concurrent revision conflict, private-field rejection, exact keys, unpublish privacy");
 console.log("OFFLINE_FAKE_DATABASE_ONLY_NO_FIREBASE_NO_DEPLOYMENT");
})().catch(e=>{console.error(e);process.exitCode=1;});
