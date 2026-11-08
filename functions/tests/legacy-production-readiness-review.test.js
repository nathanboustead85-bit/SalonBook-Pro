"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {digestBookings}=require("../finalBookingSyncVerifier");
const {reviewLegacyProductionReadiness:review}=require("../legacyProductionReadinessReview");
const owner="test-owner";
const json=JSON.stringify(Array.from({length:10},(_,i)=>({id:"test"+i})));
const archive={archiveType:"boustio-cloud-bookings-readonly",schemaVersion:1,
 sourcePath:"users/"+owner+"/liveData/bookings",bookingCount:10,
 bookingsJson:json,sourceSha256:digestBookings(json)};
function fake({mode=false,marker=false,appointments=0,locks=0,source=json}={}){
 const reads=[];let writes=0;
 const collection=path=>({doc:id=>({path:path+"/"+id,collection:name=>collection(path+"/"+id+"/"+name),
 get:async()=>{reads.push(path+"/"+id);return {
 exists:path.endsWith("/settings")?mode:path.endsWith("/migrations")?marker:true,
 data:()=>path.endsWith("/liveData")?{json:source,schemaVersion:1}:{}
 };}}),
 get:async()=>{reads.push(path);return {empty:(path.endsWith("/appointments")?appointments:locks)===0};}});
 return {db:{collection},reads,get writes(){return writes;}};
}
test("valid archive and empty shared calendar produce read-only readiness",async()=>{
 const f=fake();const result=await review({db:f.db,businessId:owner,authenticatedUid:owner,archive});
 assert.equal(result.ready,true);assert.equal(result.readOnly,true);
 assert.equal(result.productionChangePerformed,false);assert.equal(f.writes,0);
 assert.equal(result.bookingCount,10);assert.equal(result.requiresSeparateProductionApproval,true);
 assert.equal(f.reads.length,5);
});
test("archive for another business blocked before database access",async()=>{
 const f=fake();const result=await review({db:f.db,businessId:owner,authenticatedUid:owner,
 archive:{...archive,sourcePath:"users/another/liveData/bookings"}});
 assert.equal(result.ready,false);assert.equal(f.reads.length,0);
});
test("owner mismatch blocks before database access",async()=>{
 const f=fake();const result=await review({db:f.db,businessId:owner,authenticatedUid:"someone",archive});
 assert.equal(result.ready,false);assert.equal(f.reads.length,0);
});
test("tampered archive blocked",async()=>{
 const f=fake();const result=await review({db:f.db,businessId:owner,authenticatedUid:owner,
 archive:{...archive,sourceSha256:"0".repeat(64)}});
 assert.equal(result.ready,false);assert.equal(f.reads.length,0);
});
for(const [name,opts] of [["existing mode",{mode:true}],["migration marker",{marker:true}],
 ["appointments",{appointments:1}],["locks",{locks:1}],["cloud drift",{source:json+" "}]]){
 test(name+" blocks readiness",async()=>{
  const f=fake(opts);const result=await review({db:f.db,businessId:owner,authenticatedUid:owner,archive});
  assert.equal(result.ready,false);assert.equal(result.readOnly,true);assert.equal(f.writes,0);
 });
}
test("database error fails closed",async()=>{
 const db={collection:()=>{throw Error("network down");}};
 const result=await review({db,businessId:owner,authenticatedUid:owner,archive});
 assert.equal(result.ready,false);assert.equal(result.productionChangePerformed,false);
});
