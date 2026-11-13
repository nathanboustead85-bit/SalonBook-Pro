"use strict";
const assert = require("node:assert/strict");
const { inspectMigration } = require("../functions/inspectMigration");

function booking(id, time="09:00", duration=30) {
  return { id, date:"2026-11-20", time, duration, staffId:"staff1" };
}
function mockDb({json, exists=true, lockIds=[], shared=false, malformedGetAll=false}={}) {
  const calls = [];
  const snapshot = { exists, get:key => key==="json" ? json : undefined };
  const db = {
    collection(name) {
      assert.equal(name,"users");
      return {doc(uid) {
        assert.equal(uid,"verified-owner");
        return {collection(key) {
          assert.equal(key,"liveData");
          return {doc(id) {
            assert.equal(id,"bookings");
            return {async get(){ calls.push("legacy-read"); return snapshot; }};
          }};
        }};
      }};
    },
    async getAll(...refs) {
      calls.push("lock-read");
      if (malformedGetAll) return [];
      return refs.map(ref=>({exists:lockIds.includes(ref.id)}));
    }
  };
  const originalCollection=db.collection.bind(db);
  db.collection=name=>name==="businesses" ? {doc(uid) {
    assert.equal(uid,"verified-owner");
    return {collection(key) {
      if(key==="bookingLocks")return {doc:id=>({id})};
      if(key==="appointments")return {limit:n=>{
        assert.equal(n,1);
        return {async get(){calls.push("shared-read");return {empty:!shared};}};
      }};
      throw Error("unexpected collection "+key);
    }};
  }} : originalCollection(name);
  return {db,calls};
}
async function run() {
  const tests=[
    {name:"safe snapshot previews without writes",json:JSON.stringify([booking("one"),booking("two","11:30")]),expected:true,count:2},
    {name:"overlapping appointments block readiness",json:JSON.stringify([booking("one"),booking("two","09:15")]),expected:false},
    {name:"duplicate IDs block readiness",json:JSON.stringify([booking("one"),booking("one","11:30")]),expected:false},
    {name:"invalid staff metadata blocks readiness",json:JSON.stringify([{...booking("one"),staffId:""}]),expected:false},
    {name:"invalid JSON blocks readiness",json:"not-json",expected:false},
    {name:"existing shared appointments block readiness",json:JSON.stringify([booking("one")]),shared:true,expected:false},
    {name:"existing lock blocks readiness",json:JSON.stringify([booking("one")]),lockIds:["staff1_2026-11-20_0900"],expected:false},
    {name:"missing snapshot blocks readiness",exists:false,expected:false},
  ];
  for (const t of tests) {
    const {db,calls}=mockDb(t);
    const result=await inspectMigration(db,"verified-owner");
    assert.equal(result.safe,t.expected,t.name);
    assert.equal(result.migrationPerformed,false,t.name);
    assert.equal(result.liveBookingsEnabled,false,t.name);
    if(t.count!==undefined)assert.equal(result.count,t.count,t.name);
    assert.ok(calls.every(c=>c.endsWith("-read")),t.name);
    console.log("PASS",t.name);
  }
  const {db}=mockDb({json:JSON.stringify([booking("one")]),malformedGetAll:true});
  await assert.rejects(inspectMigration(db,"verified-owner"),/Incomplete booking lock comparison/);
  console.log("PASS incomplete lock lookup fails closed");
}
run().catch(error=>{console.error(error);process.exitCode=1;});
