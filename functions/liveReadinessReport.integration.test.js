"use strict";
/**
 * Phase 10.24: Firestore-backed report verification, emulator only.
 * No production connection, credentials, write, deployment or callable.
 */
const test=require("node:test");
const assert=require("node:assert/strict");
const admin=require("firebase-admin");
const {generateLiveReadinessReport}=require("./liveReadinessReport");
const {digestBookings}=require("./finalBookingSyncVerifier");
const PROJECT="demo-boustio-live-readonly";
if(!process.env.FIRESTORE_EMULATOR_HOST ||
 process.env.GCLOUD_PROJECT!==PROJECT ||
 process.env.GOOGLE_CLOUD_PROJECT!==PROJECT ||
 process.env.GOOGLE_APPLICATION_CREDENTIALS)
 throw Error("Isolated Firestore emulator required; production credentials prohibited");
if(!admin.apps.length)admin.initializeApp({projectId:PROJECT});
const db=admin.firestore();
const json=JSON.stringify(Array.from({length:10},(_,i)=>({id:"test"+i,customer:"PRIVATE"})));
let sequence=0;
async function fixture({mode=false,marker=false,appointments=false,locks=false,source=json}={}){
 const owner="readonly_"+process.pid+"_"+(++sequence);
 const business=db.collection("businesses").doc(owner);
 await db.collection("users").doc(owner).collection("liveData").doc("bookings")
  .set({schemaVersion:1,json:source});
 if(mode)await business.collection("settings").doc("bookingMode").set({mode:"legacy"});
 if(marker)await business.collection("migrations").doc("android-bookings-v1").set({status:"started"});
 if(appointments)await business.collection("appointments").doc("existing").set({status:"confirmed"});
 if(locks)await business.collection("bookingLocks").doc("occupied").set({appointmentId:"existing"});
 const archive={archiveType:"boustio-cloud-bookings-readonly",schemaVersion:1,
  sourcePath:"users/"+owner+"/liveData/bookings",bookingCount:10,
  bookingsJson:json,sourceSha256:digestBookings(json)};
 return {owner,business,archive};
}
const verify=f=>generateLiveReadinessReport({db,businessId:f.owner,authenticatedUid:f.owner,archive:f.archive});
test("real Firestore reads confirm safe readiness without writing",async()=>{
 const f=await fixture();
 const before=(await db.collection("users").doc(f.owner).collection("liveData").doc("bookings").get()).data();
 const result=await verify(f);
 assert.equal(result.ready,true);assert.equal(result.readOnly,true);
 assert.equal(result.status,"READ_ONLY_READY");
 assert.equal(result.bookingCount,10);
 assert.equal(result.productionChangePerformed,false);
 assert.ok(!JSON.stringify(result).includes(f.owner));
 assert.ok(!JSON.stringify(result).includes("PRIVATE"));
 assert.deepEqual((await db.collection("users").doc(f.owner).collection("liveData").doc("bookings").get()).data(),before);
 assert.equal((await f.business.collection("settings").get()).empty,true);
});
for(const [name,options] of [
 ["mode exists",{mode:true}],["migration exists",{marker:true}],
 ["appointments exist",{appointments:true}],["locks exist",{locks:true}],
 ["cloud source differs",{source:json+" "}]]){
 test(name+" blocks without changing data",async()=>{
  const f=await fixture(options);
  const result=await verify(f);
  assert.equal(result.ready,false);
  assert.equal(result.productionChangePerformed,false);
  const actual=(await db.collection("users").doc(f.owner).collection("liveData").doc("bookings").get()).data();
  assert.equal(actual.json,options.source??json);
 });
}
test("wrong owner and mismatched archive cannot be verified",async()=>{
 const f=await fixture();
 const wrong=await generateLiveReadinessReport({db,businessId:f.owner,authenticatedUid:"another",archive:f.archive});
 assert.equal(wrong.ready,false);
 const mismatched=await generateLiveReadinessReport({db,businessId:f.owner,authenticatedUid:f.owner,
  archive:{...f.archive,sourcePath:"users/another/liveData/bookings"}});
 assert.equal(mismatched.ready,false);
});
