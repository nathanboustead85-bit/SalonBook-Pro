"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {digestBookings}=require("../finalBookingSyncVerifier");
const {generateLiveReadinessReport:report}=require("../liveReadinessReport");
const owner="owner-test";
const json=JSON.stringify(Array.from({length:10},(_,i)=>({id:"test"+i,customer:"private"})));
const archive={archiveType:"boustio-cloud-bookings-readonly",schemaVersion:1,
 sourcePath:"users/"+owner+"/liveData/bookings",bookingCount:10,
 bookingsJson:json,sourceSha256:digestBookings(json)};
function fake({mode=false,marker=false,appointments=0,locks=0,source=json,throwOnRead=false}={}){
 let reads=0;
 const collection=path=>({doc:id=>({collection:part=>collection(path+"/"+id+"/"+part),
 get:async()=>{reads++;if(throwOnRead)throw Error("offline");
 return {exists:path.endsWith("/settings")?mode:path.endsWith("/migrations")?marker:true,
 data:()=>path.endsWith("/liveData")?{json:source,schemaVersion:1}:{}};}}),
 get:async()=>{reads++;if(throwOnRead)throw Error("offline");
 return {empty:(path.endsWith("/appointments")?appointments:locks)===0};}});
 return {db:{collection},get reads(){return reads;}};
}
const run=(f,opts={})=>report({db:f.db,businessId:owner,authenticatedUid:owner,archive,...opts});
test("safe read-only report exposes no customer or owner details",async()=>{
 const f=fake();const result=await run(f);
 assert.equal(result.ready,true);assert.equal(result.status,"READ_ONLY_READY");
 assert.equal(result.bookingCount,10);assert.equal(result.productionChangePerformed,false);
 assert.equal(result.cloudArchiveMatch,true);
 assert.equal(f.reads,5);
 assert.ok(!JSON.stringify(result).includes("private"));
 assert.ok(!JSON.stringify(result).includes(owner));
});
test("mismatched owner archive blocked before reads",async()=>{
 const f=fake();const result=await run(f,{archive:{...archive,sourcePath:"users/other/liveData/bookings"}});
 assert.equal(result.ready,false);assert.equal(f.reads,0);
});
test("wrong authenticated user blocked before reads",async()=>{
 const f=fake();const result=await run(f,{authenticatedUid:"other"});
 assert.equal(result.ready,false);assert.equal(f.reads,0);
});
for(const [name,opts] of [["mode exists",{mode:true}],["migration exists",{marker:true}],
 ["appointments exist",{appointments:1}],["locks exist",{locks:1}],
 ["cloud changed",{source:json+" "}],["server offline",{throwOnRead:true}]]){
 test(name+" blocks live readiness",async()=>{
  const result=await run(fake(opts));
  assert.equal(result.ready,false);assert.equal(result.productionChangePerformed,false);
 });
}
test("invalid archive hash blocks",async()=>{
 const result=await run(fake(),{archive:{...archive,sourceSha256:"0".repeat(64)}});
 assert.equal(result.ready,false);
});
