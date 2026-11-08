"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {digestBookings}=require("../finalBookingSyncVerifier");
const {initialiseArchivedLegacyMode,APPROVAL}=require("../controlledLegacyModeInitialization");
const json=JSON.stringify(Array.from({length:10},(_,i)=>({id:"test"+i})));
const archive={archiveType:"boustio-cloud-bookings-readonly",schemaVersion:1,
 bookingCount:10,bookingsJson:json,sourceSha256:digestBookings(json),
 sourcePath:"users/owner/liveData/bookings"};
function fake({mode=false,marker=false,source=json,apps=0,locks=0}={}){
 const state={writes:[]};
 const collection=name=>({path:name,doc:id=>({
  path:name+"/"+id,collection:part=>collection(name+"/"+id+"/"+part)
 }),get:async()=>({empty:(name.endsWith("/appointments")?apps:locks)===0})});
 const db={collection,runTransaction:async fn=>fn({
  get:async ref=>ref.path.endsWith("/appointments")||ref.path.endsWith("/bookingLocks")
   ? {empty:(ref.path.endsWith("/appointments")?apps:locks)===0}
   : ({
   exists:ref.path.endsWith("/settings/bookingMode")?mode:
    ref.path.endsWith("/migrations/android-bookings-v1")?marker:true,
   data:()=>ref.path.endsWith("/liveData/bookings")?{json:source,schemaVersion:1}:{}
  }),
  create:(ref,data)=>state.writes.push({path:ref.path,data})
 })};
 return {db,state};
}
async function run(opts={},overrides={}){
 const {db,state}=fake(opts);
 return {state,promise:initialiseArchivedLegacyMode({db,businessId:"owner",
  authenticatedUid:"owner",archive,approval:APPROVAL,executionEnabled:true,...overrides})};
}
test("creates only booking mode with valid archived data",async()=>{
 const {state,promise}=await run();const result=await promise;
 assert.equal(result.initialized,true);assert.equal(result.cleanupPerformed,false);
 assert.equal(state.writes.length,1);assert.equal(state.writes[0].path,"businesses/owner/settings/bookingMode");
 assert.equal(state.writes[0].data.mode,"legacy");
});
test("disabled execution blocks",async()=>{
 const {state,promise}=await run({}, {executionEnabled:false});
 await assert.rejects(promise,/disabled/);assert.equal(state.writes.length,0);
});
test("missing approval blocks",async()=>{
 const {state,promise}=await run({}, {approval:""});
 await assert.rejects(promise,/approval/);assert.equal(state.writes.length,0);
});
test("existing mode blocks",async()=>{
 const {state,promise}=await run({mode:true});
 await assert.rejects(promise,/already initialised/);assert.equal(state.writes.length,0);
});
test("migration marker blocks",async()=>{
 const {state,promise}=await run({marker:true});
 await assert.rejects(promise,/Migration/);assert.equal(state.writes.length,0);
});
test("changed cloud data blocks",async()=>{
 const {state,promise}=await run({source:json+" "});
 await assert.rejects(promise,/differ/);assert.equal(state.writes.length,0);
});
test("appointments block",async()=>{
 const {state,promise}=await run({apps:1});
 await assert.rejects(promise,/Shared/);assert.equal(state.writes.length,0);
});
test("locks block",async()=>{
 const {state,promise}=await run({locks:1});
 await assert.rejects(promise,/Shared/);assert.equal(state.writes.length,0);
});
test("owner mismatch blocks",async()=>{
 const {state,promise}=await run({}, {authenticatedUid:"other"});
 await assert.rejects(promise,/Owner/);assert.equal(state.writes.length,0);
});
test("invalid archive blocks",async()=>{
 const {state,promise}=await run({}, {archive:{...archive,sourceSha256:"0".repeat(64)}});
 await assert.rejects(promise,/archive/);assert.equal(state.writes.length,0);
});

test("archive without owner sourcePath blocks before transaction",async()=>{
 const {state,promise}=await run({}, {archive:{...archive,sourcePath:undefined}});
 await assert.rejects(promise,/sourcePath/);assert.equal(state.writes.length,0);
});
test("archive from a different owner blocks before transaction",async()=>{
 const {state,promise}=await run({}, {archive:{...archive,sourcePath:"users/another/liveData/bookings"}});
 await assert.rejects(promise,/sourcePath/);assert.equal(state.writes.length,0);
});
