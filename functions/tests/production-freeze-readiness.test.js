"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {digestBookings}=require("../finalBookingSyncVerifier");
const {inspectFreezeReadiness}=require("../productionFreezeReadiness");
const json=JSON.stringify(Array.from({length:10},(_,i)=>({id:"test"+i})));
const archive={archiveType:"boustio-cloud-bookings-readonly",schemaVersion:1,
 bookingCount:10,bookingsJson:json,sourceSha256:digestBookings(json)};
function mock({mode="legacy",marker=false,source=json,appointments=0,locks=0}={}){
 let writes=0;
 function collection(name){return {doc(id){
  if(name==="businesses"||name==="users")return {collection:part=>collection(part)};
  return {get:async()=>({
   exists:name==="settings"?mode!==null:name==="migrations"?marker:true,
   data:()=>name==="settings"?{mode}:name==="liveData"?{json:source,schemaVersion:1}:{}
  })};
 },get:async()=>({empty:(name==="appointments"?appointments:locks)===0})};}
 return {db:{collection},writes:()=>writes};
}
async function check(opts={},extra={}){
 const {db,writes}=mock(opts);
 const result=await inspectFreezeReadiness({db,businessId:"owner",
  authenticatedUid:"owner",archive,...extra});
 assert.equal(writes(),0);assert.equal(result.freezePerformed,false);
 assert.equal(result.cleanupPerformed,false);return result;
}
test("matching legacy mode is only ready for separate freeze approval",async()=>{
 const r=await check();assert.equal(r.ready,true);assert.equal(r.currentMode,"legacy");
 assert.equal(r.requiresSeparateApproval,true);
});
test("already frozen is only read-only ready",async()=>{
 assert.equal((await check({mode:"frozen"})).ready,true);
});
test("missing mode blocks",async()=>{assert.equal((await check({mode:null})).ready,false);});
test("migration marker blocks",async()=>{assert.equal((await check({marker:true})).ready,false);});
test("cloud mismatch blocks",async()=>{assert.equal((await check({source:json+" "})).ready,false);});
test("appointments block",async()=>{assert.equal((await check({appointments:1})).ready,false);});
test("locks block",async()=>{assert.equal((await check({locks:1})).ready,false);});
test("wrong owner blocks",async()=>{assert.equal((await check({}, {authenticatedUid:"other"})).ready,false);});
test("archive mismatch blocks",async()=>{
 assert.equal((await check({}, {archive:{...archive,sourceSha256:"0".repeat(64)}})).ready,false);
});
