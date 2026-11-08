"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {digestBookings}=require("../finalBookingSyncVerifier");
const {prepareTestBookingCleanup}=require("../testBookingCleanupPlan");
const json=JSON.stringify(Array.from({length:10},(_,i)=>({id:"test"+i})));
const archive={archiveType:"boustio-cloud-bookings-readonly",schemaVersion:1,
 bookingCount:10,bookingsJson:json,sourceSha256:digestBookings(json)};
function db({cloud=json,mode="legacy",marker=false,apps=0,locks=0}={}){
 const snapshot=(data,exists=true)=>({exists,data:()=>data});
 const owner="owner";
 const sources={bookings:snapshot({schemaVersion:1,json:cloud}),
 bookingMode:snapshot({mode},mode!==null),
 "android-bookings-v1":snapshot({},marker)};
 return {collection(name){
  assert.ok(["businesses","users"].includes(name));
  return {doc(id){
   assert.equal(id,owner);
   return {collection(part){
    return {doc(key){
     if(part==="liveData")assert.equal(key,"bookings");
     return {get:async()=>sources[key]};
    },get:async()=>({empty:part==="appointments"?apps===0:locks===0})};
   }};
  }};
 }};
}
const check=(options={},a=archive)=>prepareTestBookingCleanup({
 db:db(options),businessId:"owner",authenticatedUid:"owner",archive:a});
test("matching archived ten bookings yields dry run only",async()=>{
 const result=await check();assert.equal(result.safeToPrepare,true);
 assert.equal(result.deletionAuthorised,false);assert.equal(result.readOnly,true);
});
test("modified cloud source blocks",async()=>{
 assert.equal((await check({cloud:json+" "})).safeToPrepare,false);
});
test("wrong archive hash blocks",async()=>{
 assert.equal((await check({}, {...archive,sourceSha256:"0".repeat(64)})).safeToPrepare,false);
});
test("duplicate IDs in archive block",async()=>{
 const duplicate=JSON.stringify(Array.from({length:10},()=>({id:"same"})));
 assert.equal((await check({}, {...archive,bookingsJson:duplicate,
  sourceSha256:digestBookings(duplicate)})).safeToPrepare,false);
});
test("migration marker blocks",async()=>{
 assert.equal((await check({marker:true})).safeToPrepare,false);
});
test("frozen or cloud mode blocks",async()=>{
 for(const mode of ["frozen","cloud"])
  assert.equal((await check({mode})).safeToPrepare,false);
});
test("shared appointments block",async()=>{
 assert.equal((await check({apps:1})).safeToPrepare,false);
});
test("shared locks block",async()=>{
 assert.equal((await check({locks:1})).safeToPrepare,false);
});
test("wrong owner blocks before reads",async()=>{
 const result=await prepareTestBookingCleanup({db:db(),businessId:"owner",
 authenticatedUid:"other",archive});
 assert.equal(result.safeToPrepare,false);
});
