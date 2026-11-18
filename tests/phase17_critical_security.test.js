"use strict";
const assert=require("node:assert/strict");
const {applyPublicListingCommand}=require("../functions/phase17PublicDatabaseWriter");
const {createClaimCoordinator}=require("../functions/phase17RecoveryClaim");
const {reconcileWithClaim}=require("../functions/phase17ClaimedRecovery");
const {prepare}=require("../functions/phase17DurableRecovery");
class Db{
 constructor(){this.docs=new Map();this.queue=Promise.resolve();}
 collection(c){return {doc:id=>({key:c+"/"+id,id,get:async()=>this.snap(c+"/"+id)})};}
 snap(k){const v=this.docs.get(k);return {exists:v!==undefined,data:()=>structuredClone(v),get:f=>v?.[f]};}
 runTransaction(fn){const job=this.queue.then(async()=>{const w=[];const tx={get:async r=>this.snap(r.key),set:(r,v)=>w.push(["set",r.key,structuredClone(v)]),update:(r,v)=>w.push(["set",r.key,structuredClone(v)]),create:(r,v)=>w.push(["set",r.key,structuredClone(v)]),delete:r=>w.push(["delete",r.key])};const res=await fn(tx);for(const [op,k,v] of w){if(op==="delete")this.docs.delete(k);else this.docs.set(k,v);}return res;});this.queue=job.catch(()=>{});return job;}
}
const uid="owner_1",profile={businessId:uid,name:"Demo Salon",slug:"demo-salon",category:"Hair",phone:"",address:"",description:"",privateNotes:"PRIVATE"};
const command={uid,version:1,operation:"publish",profile};
(async()=>{
 const publicDb=new Db();
 assert.equal((await applyPublicListingCommand(publicDb,command)).status,"PUBLISHED");
 assert.equal((await applyPublicListingCommand(publicDb,command)).status,"ALREADY_APPLIED");
 assert.equal((await applyPublicListingCommand(publicDb,{...command,profile:{...profile,name:"Other Salon"}})).status,"VERSION_CONFLICT");
 assert.equal((await applyPublicListingCommand(publicDb,{...command,profile:{...profile,slug:"other-salon"}})).status,"VERSION_CONFLICT");
 assert.equal((await applyPublicListingCommand(publicDb,{uid,version:1,operation:"unpublish"})).status,"VERSION_CONFLICT");
 assert.equal(publicDb.docs.get("publicBusinesses/"+uid).name,"Demo Salon");
 assert.equal(publicDb.docs.get("publicBusinesses/"+uid).acceptingBookings,false);
 const journalDb=new Db(),claimDb=new Db();let now=10000;
 const store={get:async k=>{const s=await journalDb.collection("journal").doc(k).get();return s.exists?s.data():null;},put:async(k,v)=>journalDb.runTransaction(async tx=>tx.set(journalDb.collection("journal").doc(k),v))};
 const claims=createClaimCoordinator({db:claimDb,nowMs:()=>now});
 const entry=await prepare({store,command});
 let sends=0;
 const send=async c=>{sends++;return applyPublicListingCommand(publicDb,c);};
 const current=async()=>({version:1,operation:"publish",fingerprint:entry.fingerprint});
 const [first,second]=await Promise.all([
  reconcileWithClaim({store,claims,key:entry.key,worker:"worker_a",readCurrent:current,send}),
  reconcileWithClaim({store,claims,key:entry.key,worker:"worker_b",readCurrent:current,send})
 ]);
 assert.equal([first.status,second.status].filter(s=>s==="CONFIRMED").length,1);
 assert.equal([first.status,second.status].filter(s=>s==="BUSY").length,1);
 assert.equal(sends,1);
 assert.equal((await claims.acquire({key:entry.key,worker:"worker_c"})).status,"TERMINAL");
 console.log("PASS PHASE17_CRITICAL_SECURITY: conflicting version rejected; claimed recovery single sender; terminal fencing");
 console.log("OFFLINE_ONLY_NO_LIVE_FIRESTORE_NO_DEPLOYMENT_NO_BOOKING_ACTIVATION");
})().catch(e=>{console.error(e);process.exitCode=1;});
