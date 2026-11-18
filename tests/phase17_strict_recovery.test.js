"use strict";
const assert=require("node:assert/strict");
const {createRecoveryStore}=require("../functions/phase17RecoveryFirestoreStore");
const {prepareStrict,reconcileStrict}=require("../functions/phase17StrictRecovery");
const {fingerprint}=require("../functions/phase17DurableRecovery");
class Db{
 constructor(){this.docs=new Map();this.queue=Promise.resolve();}
 collection(c){return {doc:id=>({key:c+"/"+id,get:async()=>this.snap(c+"/"+id)})};}
 snap(k){const v=this.docs.get(k);return {exists:v!==undefined,data:()=>structuredClone(v)};}
 runTransaction(fn){
  const work=this.queue.then(async()=>{
   const writes=[];const tx={get:async r=>this.snap(r.key),create:(r,v)=>writes.push([r.key,structuredClone(v)]),update:(r,v)=>writes.push([r.key,structuredClone(v)])};
   const result=await fn(tx);for(const [k,v] of writes)this.docs.set(k,v);return result;
  });this.queue=work.catch(()=>{});return work;
 }
}
(async()=>{
 const store=createRecoveryStore({db:new Db(),strict:true});
 const uid="owner_1";
 const profile={businessId:uid,name:"Demo Salon",slug:"demo-salon",category:"Hair",phone:"",address:"",description:"",acceptingBookings:false};
 const command={uid,version:55,operation:"publish",profile};
 await assert.rejects(()=>prepareStrict({store,command:{...command,profile:{...profile,privateNotes:"SECRET"}}}),/PRIVATE_OR_UNCANONICAL_JOURNAL_PROFILE/);
 const [a,b]=await Promise.all([prepareStrict({store,command}),prepareStrict({store,command})]);
 assert.equal(a.key,b.key);
 assert.equal((await store.get(a.key)).revision,1);
 assert.equal(JSON.stringify(await store.get(a.key)).includes("SECRET"),false);
 const current=async()=>({version:55,operation:"publish",fingerprint:fingerprint(a.command)});
 let sends=0;
 const first=await reconcileStrict({store,key:a.key,readCurrent:current,send:async()=>{sends++;throw Error("LOST_REPLY");}});
 assert.equal(first.state,"UNKNOWN");
 assert.equal((await store.get(a.key)).revision,2);
 const second=await reconcileStrict({store,key:a.key,readCurrent:current,send:async()=>{sends++;return {status:"ALREADY_APPLIED"};}});
 assert.equal(second.state,"CONFIRMED");
 assert.equal(sends,2);
 const terminal=await reconcileStrict({store,key:a.key,readCurrent:current,send:async()=>{sends++;}});
 assert.equal(terminal.state,"CONFIRMED");assert.equal(sends,2);
 const next=await prepareStrict({store,command:{...command,version:56}});
 let blockedSends=0;
 assert.equal((await reconcileStrict({store,key:next.key,readCurrent:async()=>null,send:async()=>{blockedSends++;}})).state,"BLOCKED");
 assert.equal(blockedSends,0);
 const unpublish=await prepareStrict({store,command:{uid,version:57,operation:"unpublish"}});
 assert.equal(unpublish.command.profile,undefined);
 await assert.rejects(()=>prepareStrict({store,command:{uid,version:58,operation:"unpublish",profile:{acceptingBookings:false}}}),/UNPUBLISH_PROFILE_FORBIDDEN/);
 console.log("PASS PHASE17_STRICT_RECOVERY: strict journal CAS, canonical projection, lost response, replay, stale source, unpublish privacy");
 console.log("OFFLINE_ONLY_NO_FIREBASE_NO_DEPLOYMENT");
})().catch(e=>{console.error(e);process.exitCode=1;});
