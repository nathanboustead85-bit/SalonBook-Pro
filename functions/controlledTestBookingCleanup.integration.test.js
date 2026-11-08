"use strict";
/**
 * Phase 10.15: Firestore emulator ONLY.
 * Never use a production project or credentials.
 */
const test=require("node:test");
const assert=require("node:assert/strict");
const admin=require("firebase-admin");
const {clearArchivedTestBookings,APPROVAL}=require("./controlledTestBookingCleanup");
const {digestBookings}=require("./finalBookingSyncVerifier");
const PROJECT="demo-boustio-cleanup";
if(!process.env.FIRESTORE_EMULATOR_HOST ||
 process.env.GCLOUD_PROJECT!==PROJECT ||
 process.env.GOOGLE_CLOUD_PROJECT!==PROJECT)
 throw Error("Dedicated cleanup emulator required");
if(admin.apps.length===0)admin.initializeApp({projectId:PROJECT});
const db=admin.firestore();
let counter=0;
const json=JSON.stringify(Array.from({length:10},(_,i)=>({
 id:"test"+i,client:"Test Client "+i,date:"2026-11-18",time:"10:00"
})));
const archive={archiveType:"boustio-cloud-bookings-readonly",
 schemaVersion:1,bookingCount:10,bookingsJson:json,sourceSha256:digestBookings(json)};
async function fixture({mode="frozen",source=json,marker=false,appointments=false,locks=false}={}){
 const owner="cleanup_"+process.pid+"_"+(++counter);
 const business=db.collection("businesses").doc(owner);
 const sourceRef=db.collection("users").doc(owner).collection("liveData").doc("bookings");
 await business.collection("settings").doc("bookingMode").set({mode});
 await sourceRef.set({json:source,schemaVersion:1,updatedAt:new Date(),preserve:"yes"});
 if(marker)await business.collection("migrations").doc("android-bookings-v1").set({status:"completed"});
 if(appointments)await business.collection("appointments").doc("existing").set({status:"confirmed"});
 if(locks)await business.collection("bookingLocks").doc("occupied").set({appointmentId:"existing"});
 return {owner,business,sourceRef};
}
async function execute(f,opts={}){
 return clearArchivedTestBookings({db,businessId:f.owner,authenticatedUid:f.owner,
  archive,approval:APPROVAL,executionEnabled:true,...opts});
}
test("transaction clears only matching archived source; preserves other data",async()=>{
 const f=await fixture();
 const result=await execute(f);
 assert.equal(result.cleared,10);
 const source=(await f.sourceRef.get()).data();
 assert.equal(source.json,"[]");assert.equal(source.preserve,"yes");
 assert.equal((await f.business.collection("settings").doc("bookingMode").get()).data().mode,"frozen");
 assert.equal((await f.business.collection("appointments").get()).empty,true);
 assert.equal((await f.business.collection("bookingLocks").get()).empty,true);
});
test("changed cloud data cannot be cleared",async()=>{
 const f=await fixture({source:json+" "});
 await assert.rejects(execute(f),/changed/);
 assert.equal((await f.sourceRef.get()).data().json,json+" ");
});
test("migration marker prevents cleanup",async()=>{
 const f=await fixture({marker:true});
 await assert.rejects(execute(f),/marker/);
 assert.equal((await f.sourceRef.get()).data().json,json);
});
test("unfrozen legacy booking mode prevents cleanup",async()=>{
 const f=await fixture({mode:"legacy"});
 await assert.rejects(execute(f),/Frozen/);
 assert.equal((await f.sourceRef.get()).data().json,json);
});
test("shared appointments prevent cleanup",async()=>{
 const f=await fixture({appointments:true});
 await assert.rejects(execute(f),/Shared/);
 assert.equal((await f.sourceRef.get()).data().json,json);
});
test("shared booking locks prevent cleanup",async()=>{
 const f=await fixture({locks:true});
 await assert.rejects(execute(f),/Shared/);
 assert.equal((await f.sourceRef.get()).data().json,json);
});
test("disabled execution cannot clear",async()=>{
 const f=await fixture();
 await assert.rejects(execute(f,{executionEnabled:false}),/disabled/);
 assert.equal((await f.sourceRef.get()).data().json,json);
});
