"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const admin=require("firebase-admin");
const {initialiseWithSingleUseApproval:initialize,OPERATION}=require("./phase1040EmulatorLockedInitialization");
const {digestBookings}=require("./finalBookingSyncVerifier");
const PROJECT="demo-boustio-legacy-init";
if(!process.env.FIRESTORE_EMULATOR_HOST||
 process.env.GCLOUD_PROJECT!==PROJECT||process.env.GOOGLE_CLOUD_PROJECT!==PROJECT||
 process.env.GOOGLE_APPLICATION_CREDENTIALS)throw Error("Isolated emulator only");
if(!admin.apps.length)admin.initializeApp({projectId:PROJECT});
const db=admin.firestore();
const now=2000000000000;
let seq=0;
const json=JSON.stringify(Array.from({length:10},(_,i)=>({id:"booking"+i})));
const hash=digestBookings(json);
async function setup(opts={}){
 const owner="phase1040_"+process.pid+"_"+(++seq);
 const business=db.collection("businesses").doc(owner);
 const approval=business.collection("legacyModeApprovals").doc("approval1");
 const mode=business.collection("settings").doc("bookingMode");
 const source=db.collection("users").doc(owner).collection("liveData").doc("bookings");
 await source.set({schemaVersion:1,json});
 await approval.set({ownerUid:owner,verifiedOwnerUid:owner,operation:OPERATION,
 archiveSha256:hash,status:"approved",usedAt:null,verifiedByTrustedOperator:true,
 issuedAtMs:now-1000,expiresAtMs:now+60000,...opts});
 const archive={archiveType:"boustio-cloud-bookings-readonly",schemaVersion:1,
 bookingCount:10,sourceSha256:hash,bookingsJson:json,
 sourcePath:"users/"+owner+"/liveData/bookings"};
 const run=(extra={})=>initialize({db,businessId:owner,approvalId:"approval1",
 archive,idToken:"emulator-test-token",nowMs:now,executionEnabled:true,
 verifyIdToken:async()=>({uid:owner,email_verified:true}),...extra});
 return {owner,business,approval,mode,source,archive,run};
}
test("atomically consumes approval and creates mode without changing bookings",async()=>{
 const f=await setup();const before=(await f.source.get()).data();
 const result=await f.run();assert.equal(result.approvalConsumed,true);
 assert.equal((await f.approval.get()).data().status,"consumed");
 assert.equal((await f.mode.get()).data().mode,"legacy");
 assert.deepEqual((await f.source.get()).data(),before);
});
test("replay of consumed approval fails",async()=>{
 const f=await setup();await f.run();
 await assert.rejects(f.run(),/approval|exists/);
 assert.equal((await f.source.get()).data().json,json);
});
test("two simultaneous attempts consume approval only once",async()=>{
 const f=await setup();
 const results=await Promise.allSettled([f.run(),f.run()]);
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(results.filter(x=>x.status==="rejected").length,1);
 assert.equal((await f.approval.get()).data().status,"consumed");
});
for(const [name,overrides] of [
 ["expired approval",{expiresAtMs:now-1}],
 ["used approval",{status:"consumed"}],
 ["unverified approval",{verifiedByTrustedOperator:false}],
 ["different archive hash",{archiveSha256:"0".repeat(64)}],
 ["wrong approval owner",{ownerUid:"another"}],
 ["future approval",{issuedAtMs:now+100}]
]){
 test(name+" fails closed",async()=>{
  const f=await setup(overrides);
  await assert.rejects(f.run());
  assert.equal((await f.mode.get()).exists,false);
  assert.equal((await f.approval.get()).data().status,overrides.status||"approved");
 });
}
test("unverified identity fails closed",async()=>{
 const f=await setup();
 await assert.rejects(f.run({verifyIdToken:async()=>({uid:f.owner,email_verified:false})}),/owner/);
 assert.equal((await f.mode.get()).exists,false);
});
test("wrong identity fails closed",async()=>{
 const f=await setup();
 await assert.rejects(f.run({verifyIdToken:async()=>({uid:"other",email_verified:true})}),/owner/);
 assert.equal((await f.mode.get()).exists,false);
});
test("disabled execution fails closed",async()=>{
 const f=await setup();await assert.rejects(f.run({executionEnabled:false}),/disabled/);
 assert.equal((await f.mode.get()).exists,false);
});
test("missing verifier fails closed",async()=>{
 const f=await setup();await assert.rejects(f.run({verifyIdToken:null}),/verifier/);
 assert.equal((await f.mode.get()).exists,false);
});
test("non-demo project environment is blocked before database writes",async()=>{
 const f=await setup();
 const original=process.env.GCLOUD_PROJECT;
 try{process.env.GCLOUD_PROJECT="salonbook-pro-ad5ff";
 await assert.rejects(f.run(),/Emulator-only/);}
 finally{process.env.GCLOUD_PROJECT=original;}
 assert.equal((await f.mode.get()).exists,false);
});
