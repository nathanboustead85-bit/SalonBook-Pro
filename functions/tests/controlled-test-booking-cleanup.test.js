"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {digestBookings}=require("../finalBookingSyncVerifier");
const {clearArchivedTestBookings,APPROVAL}=require("../controlledTestBookingCleanup");
const json=JSON.stringify(Array.from({length:10},(_,i)=>({id:"test"+i})));
const archive={archiveType:"boustio-cloud-bookings-readonly",schemaVersion:1,
 bookingCount:10,bookingsJson:json,sourceSha256:digestBookings(json)};
function fake({source=json,mode="legacy",marker=false,apps=0,locks=0}={}){
 const state={source,writes:[],reads:[],paths:[]};
 function doc(path){return {path,collection:(part)=>collection(path+"/"+part)};}
 function collection(path){return {path,doc:(id)=>doc(path+"/"+id)};}
 const db={collection,async runTransaction(fn){
  const tx={async get(ref){
   state.reads.push(ref.path);
   if(ref.path.endsWith("/bookings"))return {exists:true,data:()=>({schemaVersion:1,json:state.source})};
   if(ref.path.endsWith("/bookingMode"))return {exists:true,data:()=>({mode})};
   if(ref.path.endsWith("/android-bookings-v1"))return {exists:marker,data:()=>({})};
   if(ref.path.endsWith("/appointments"))return {empty:apps===0};
   if(ref.path.endsWith("/bookingLocks"))return {empty:locks===0};
   throw Error("unexpected path "+ref.path);
  },update(ref,data){state.writes.push({path:ref.path,data});}};
  return fn(tx);
 }};
 return {db,state};
}
async function execute(options={},overrides={}){
 const {db,state}=fake(options);
 const args={db,businessId:"owner",authenticatedUid:"owner",archive,
  approval:APPROVAL,executionEnabled:true,...overrides};
 return {state,promise:clearArchivedTestBookings(args)};
}
test("default is disabled and never writes",async()=>{
 const {state,promise}=await execute({}, {executionEnabled:false});
 await assert.rejects(promise,/disabled/);assert.equal(state.writes.length,0);
});
test("approval is mandatory",async()=>{
 const {state,promise}=await execute({}, {approval:""});
 await assert.rejects(promise,/approval/);assert.equal(state.writes.length,0);
});
test("matching snapshot updates only legacy bookings JSON",async()=>{
 const {state,promise}=await execute();const result=await promise;
 assert.equal(result.cleared,10);assert.equal(state.writes.length,1);
 assert.equal(state.writes[0].path,"users/owner/liveData/bookings");
 assert.equal(state.writes[0].data.json,"[]");
});
test("changed source blocks",async()=>{
 const {state,promise}=await execute({source:json+" "});
 await assert.rejects(promise,/changed/);assert.equal(state.writes.length,0);
});
test("migration marker blocks",async()=>{
 const {state,promise}=await execute({marker:true});
 await assert.rejects(promise,/marker/);assert.equal(state.writes.length,0);
});
test("cloud mode blocks",async()=>{
 const {state,promise}=await execute({mode:"cloud"});
 await assert.rejects(promise,/legacy/);assert.equal(state.writes.length,0);
});
test("shared appointments block",async()=>{
 const {state,promise}=await execute({apps:1});
 await assert.rejects(promise,/Shared/);assert.equal(state.writes.length,0);
});
test("shared locks block",async()=>{
 const {state,promise}=await execute({locks:1});
 await assert.rejects(promise,/Shared/);assert.equal(state.writes.length,0);
});
test("owner mismatch blocks",async()=>{
 const {state,promise}=await execute({}, {authenticatedUid:"other"});
 await assert.rejects(promise,/Owner/);assert.equal(state.writes.length,0);
});
test("invalid archive blocks",async()=>{
 const {state,promise}=await execute({}, {archive:{...archive,sourceSha256:"0".repeat(64)}});
 await assert.rejects(promise,/archive/);assert.equal(state.writes.length,0);
});
