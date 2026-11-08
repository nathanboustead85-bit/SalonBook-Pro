"use strict";
/** Phase 10.21: isolated Firestore emulator only. Never use production credentials. */
const test=require("node:test");
const assert=require("node:assert/strict");
const admin=require("firebase-admin");
const {initialiseArchivedLegacyMode,APPROVAL}=require("./controlledLegacyModeInitialization");
const {digestBookings}=require("./finalBookingSyncVerifier");
const PROJECT="demo-boustio-legacy-init";
if(!process.env.FIRESTORE_EMULATOR_HOST ||
 process.env.GCLOUD_PROJECT!==PROJECT ||
 process.env.GOOGLE_CLOUD_PROJECT!==PROJECT ||
 process.env.GOOGLE_APPLICATION_CREDENTIALS ||
 process.env.FIREBASE_CONFIG)
 throw Error("Dedicated emulator and no production credentials required");
if(!admin.apps.length)admin.initializeApp({projectId:PROJECT});
const db=admin.firestore();
let sequence=0;
const json=JSON.stringify(Array.from({length:10},(_,i)=>({id:"test"+i,client:"Test "+i})));
const archive={archiveType:"boustio-cloud-bookings-readonly",schemaVersion:1,
 bookingCount:10,bookingsJson:json,sourceSha256:digestBookings(json)};
async function fixture({mode=false,marker=false,source=json,appointments=false,locks=false}={}){
 const owner="legacyinit_"+process.pid+"_"+(++sequence);
 const business=db.collection("businesses").doc(owner);
 const modeRef=business.collection("settings").doc("bookingMode");
 const sourceRef=db.collection("users").doc(owner).collection("liveData").doc("bookings");
 await sourceRef.set({json:source,schemaVersion:1,updatedAt:new Date(),keep:"unchanged"});
 if(mode)await modeRef.set({mode:"legacy"});
 if(marker)await business.collection("migrations").doc("android-bookings-v1").set({status:"started"});
 if(appointments)await business.collection("appointments").doc("existing").set({status:"confirmed"});
 if(locks)await business.collection("bookingLocks").doc("occupied").set({appointmentId:"existing"});
 return {owner,business,modeRef,sourceRef};
}
const execute=(f,overrides={})=>initialiseArchivedLegacyMode({
 db,businessId:f.owner,authenticatedUid:f.owner,archive,approval:APPROVAL,
 executionEnabled:true,...overrides
});
async function unchanged(f){
 assert.equal((await f.modeRef.get()).exists,false);
 assert.equal((await f.sourceRef.get()).data().json,await f.sourceRef.get().then(s=>s.data().json));
}
test("transaction creates only legacy mode, preserves archive and all ten bookings",async()=>{
 const f=await fixture();
 const before=(await f.sourceRef.get()).data();
 const result=await execute(f);
 assert.equal(result.initialized,true);
 assert.equal(result.cleanupPerformed,false);
 assert.equal((await f.modeRef.get()).data().mode,"legacy");
 assert.deepEqual((await f.sourceRef.get()).data(),before);
 assert.equal((await f.business.collection("appointments").get()).empty,true);
 assert.equal((await f.business.collection("bookingLocks").get()).empty,true);
 assert.equal((await f.business.collection("migrations").get()).empty,true);
});
test("second initialization is blocked without modifying bookings",async()=>{
 const f=await fixture();await execute(f);
 await assert.rejects(execute(f),/already initialised/);
 assert.equal((await f.sourceRef.get()).data().json,json);
});
for(const [name,opts,pattern] of [
 ["existing mode",{mode:true},/already initialised/],
 ["migration marker",{marker:true},/Migration/],
 ["shared appointments",{appointments:true},/Shared/],
 ["shared booking locks",{locks:true},/Shared/],
 ["changed source",{source:json+" "},/differ/]
]){
 test(name+" blocks and leaves mode uncreated when appropriate",async()=>{
  const f=await fixture(opts);
  await assert.rejects(execute(f),pattern);
  assert.equal((await f.modeRef.get()).exists,Boolean(opts.mode));
  assert.equal((await f.sourceRef.get()).data().json,opts.source??json);
 });
}
test("disabled execution cannot create mode",async()=>{
 const f=await fixture();
 await assert.rejects(execute(f,{executionEnabled:false}),/disabled/);
 await unchanged(f);
});
test("wrong approval cannot create mode",async()=>{
 const f=await fixture();
 await assert.rejects(execute(f,{approval:"NO"}),/approval/);
 await unchanged(f);
});
test("different authenticated owner cannot create mode",async()=>{
 const f=await fixture();
 await assert.rejects(execute(f,{authenticatedUid:"another-owner"}),/Owner mismatch/);
 await unchanged(f);
});
test("invalid archive cannot create mode",async()=>{
 const f=await fixture();
 await assert.rejects(execute(f,{archive:{...archive,sourceSha256:"0".repeat(64)}}),/archive/);
 await unchanged(f);
});
