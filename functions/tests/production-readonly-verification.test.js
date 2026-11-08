"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {digestBookings}=require("../finalBookingSyncVerifier");
const {verifyProductionReadOnly:verify,EXPECTED_PROJECT}=require("../productionReadOnlyVerification");
const owner="testowner";
const json=JSON.stringify(Array.from({length:10},(_,i)=>({id:"test"+i})));
const archive={archiveType:"boustio-cloud-bookings-readonly",schemaVersion:1,
 sourcePath:"users/"+owner+"/liveData/bookings",bookingCount:10,
 bookingsJson:json,sourceSha256:digestBookings(json)};
function fake(){
 let reads=0;
 const collection=path=>({doc:id=>({collection:part=>collection(path+"/"+id+"/"+part),
 get:async()=>{reads++;return {exists:!path.endsWith("/settings")&&!path.endsWith("/migrations"),
 data:()=>path.endsWith("/liveData")?{json,schemaVersion:1}:{}};}}),
 get:async()=>{reads++;return {empty:true};}});
 return {db:{collection},get reads(){return reads;}};
}
function args(f){return {db:f.db,projectId:EXPECTED_PROJECT,businessId:owner,
 authenticatedUid:owner,archive,operatorConfirmedReadOnly:true,operatorConfirmedOwner:true};}
test("explicitly confirmed, verified owner gets read-only report",async()=>{
 const f=fake();const r=await verify(args(f));
 assert.equal(r.ready,true);assert.equal(r.readOnly,true);
 assert.equal(r.productionChangePerformed,false);assert.equal(f.reads,5);
});
for(const [name,change] of [
 ["wrong project",{projectId:"demo-boustio"}],
 ["no operator confirmation",{operatorConfirmedReadOnly:false}],
 ["no owner confirmation",{operatorConfirmedOwner:false}],
 ["wrong owner",{authenticatedUid:"someone-else"}],
 ["archive owner mismatch",{archive:{...archive,sourcePath:"users/other/liveData/bookings"}}],
 ["missing database",{db:null}]]){
 test(name+" fails before database reads",async()=>{
  const f=fake();const r=await verify({...args(f),...change});
  assert.equal(r.ready,false);assert.equal(r.productionChangePerformed,false);
  assert.equal(f.reads,0);
 });
}
test("no credentials or production connection are created by module",()=>{
 const source=require("node:fs").readFileSync(require.resolve("../productionReadOnlyVerification"),"utf8");
 assert.doesNotMatch(source,/initializeApp|credential\.cert|runTransaction|\.set\(|\.update\(|\.delete\(|\.create\(/);
});
