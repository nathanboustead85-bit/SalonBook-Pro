"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {digestBookings}=require("../finalBookingSyncVerifier");
const {inspectLegacyInitialization}=require("../legacyModeInitializationPreflight");
const json=JSON.stringify(Array.from({length:10},(_,i)=>({id:"test"+i})));
const archive={archiveType:"boustio-cloud-bookings-readonly",schemaVersion:1,
 bookingCount:10,bookingsJson:json,sourceSha256:digestBookings(json)};
function mock({mode=false,marker=false,source=json,apps=0,locks=0}={}){
 const collection=name=>({doc:()=>({
  collection:part=>collection(part),
  get:async()=>({exists:name==="settings"?mode:name==="migrations"?marker:true,
   data:()=>name==="liveData"?{schemaVersion:1,json:source}:{mode:"legacy"}})
 }),get:async()=>({empty:(name==="appointments"?apps:locks)===0})});
 return {collection};
}
async function check(options={},overrides={}){
 return inspectLegacyInitialization({db:mock(options),businessId:"owner",
  authenticatedUid:"owner",archive,...overrides});
}
test("missing mode and unchanged archive yield read-only readiness",async()=>{
 const r=await check();assert.equal(r.ready,true);assert.equal(r.initialized,false);
 assert.equal(r.frozen,false);assert.equal(r.requiresSeparateProductionApproval,true);
});
test("existing mode blocks",async()=>assert.equal((await check({mode:true})).ready,false));
test("migration marker blocks",async()=>assert.equal((await check({marker:true})).ready,false));
test("changed source blocks",async()=>assert.equal((await check({source:json+" "})).ready,false));
test("appointments block",async()=>assert.equal((await check({apps:1})).ready,false));
test("locks block",async()=>assert.equal((await check({locks:1})).ready,false));
test("wrong owner blocks",async()=>assert.equal((await check({}, {authenticatedUid:"other"})).ready,false));
test("invalid archive blocks",async()=>assert.equal((await check({}, {archive:{...archive,sourceSha256:"0".repeat(64)}})).ready,false));
