"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {verifyMigratedCalendar}=require("../migratedCalendarVerifier");
const hash="a".repeat(64),businessId="owner1",date="2026-11-18";
const appointment={businessId,id:"one",migrationId:"android-bookings-v1",staffId:"alex",
 date,startTime:"10:00",endTime:"10:30",status:"confirmed"};
const locks=["1000","1015"].map(t=>({businessId,id:"alex_"+date+"_"+t,
 appointmentId:"one",migrationId:"android-bookings-v1"}));
function db({marker=true,mode="cloud",apps=[appointment],occupied=locks,sourceHash=hash}={}){
 const docs={migrations:{exists:marker,data:{status:"completed",verifiedFinalSync:true,
  schemaVersion:1,businessId,sourceHash,appointmentCount:1,lockCount:2}},
 settings:{exists:true,data:{mode}},
 appointments:{docs:apps.map(a=>({id:a.id,data:()=>a}))},
 bookingLocks:{docs:occupied.map(l=>({id:l.id,data:()=>l}))}};
 return {collection(root){
  assert.equal(root,"businesses");
  return {doc(uid){
   assert.equal(uid,businessId);
   return {collection(name){
    assert.ok(docs[name]);
    return {doc(id){
     assert.ok(["android-bookings-v1","bookingMode"].includes(id));
     return {get:async()=>({exists:docs[name].exists,
      get:key=>docs[name].data[key]})};
    },get:async()=>docs[name]};
   }};
  }};
 }};
}
const verify=(fixture)=>verifyMigratedCalendar({db:db(fixture),businessId,
 authenticatedUid:businessId,expectedSourceHash:hash});
test("complete migrated calendar verifies read only",async()=>{
 const result=await verify();
 assert.equal(result.verified,true);
 assert.equal(result.audit.reconciled,true);
});
test("missing marker blocks verification",async()=>{
 assert.equal((await verify({marker:false})).verified,false);
});
test("frozen mode blocks verification",async()=>{
 assert.equal((await verify({mode:"frozen"})).verified,false);
});
test("source hash mismatch blocks verification",async()=>{
 assert.equal((await verify({sourceHash:"b".repeat(64)})).verified,false);
});
test("missing booking lock blocks verification",async()=>{
 assert.equal((await verify({occupied:locks.slice(0,1)})).verified,false);
});
test("cross tenant document blocks verification",async()=>{
 assert.equal((await verify({apps:[{...appointment,businessId:"other"}]})).verified,false);
});
test("unverified owner cannot read calendar",async()=>{
 await assert.rejects(verifyMigratedCalendar({db:db(),businessId,
  authenticatedUid:"other",expectedSourceHash:hash}),/Verified owner/);
});
