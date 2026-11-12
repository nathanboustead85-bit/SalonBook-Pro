"use strict";
const assert = require("node:assert/strict");
const { inspectMigration } = require("../functions/inspectMigration");
const booking = {id:"one",staffId:"staff-1",date:"2026-11-20",time:"09:00",duration:30};
function fakeDb(items, options={}) {
  const reads=[];
  const db={
    collection(name) {
      return {doc(uid) {
        return {collection(child) {
          return {
            doc(id) {
              if (child==="bookings") return {async get() {
                reads.push("legacy");
                return {exists: items !== null, get:()=>JSON.stringify(items)};
              }};
              if (child==="bookingLocks") return {id};
              throw Error("Unexpected document path");
            },
            limit(n) {
              assert.equal(n,1);
              return {async get() {
                reads.push("shared");
                return {empty:!options.shared};
              }};
            }
          };
        }};
      }};
    },
    async getAll(...refs) {
      reads.push("locks");
      if(options.incomplete) return [];
      return refs.map((_,i)=>({exists:options.lockConflict && i===0}));
    }
  };
  return {db,reads};
}
(async()=>{
  let {db}=fakeDb([booking]);
  let result=await inspectMigration(db,"owner");
  assert.equal(result.safe,true);
  assert.equal(result.count,1);
  assert.equal(result.lockCount,2);
  assert.equal(result.migrationPerformed,false);
  assert.equal(result.liveBookingsEnabled,false);
  ({db}=fakeDb([booking],{lockConflict:true}));
  result=await inspectMigration(db,"owner");
  assert.equal(result.safe,false);
  assert.equal(result.existingLockConflicts,1);
  ({db}=fakeDb([booking],{shared:true}));
  result=await inspectMigration(db,"owner");
  assert.equal(result.safe,false);
  assert.equal(result.existingSharedAppointments,true);
  ({db}=fakeDb([{...booking,duration:0}]));
  result=await inspectMigration(db,"owner");
  assert.equal(result.safe,false);
  assert.equal(result.existingLocksChecked,false);
  ({db}=fakeDb(null));
  result=await inspectMigration(db,"owner");
  assert.equal(result.safe,false);
  assert.equal(result.migrationPerformed,false);
  ({db}=fakeDb([booking],{incomplete:true}));
  await assert.rejects(()=>inspectMigration(db,"owner"),/Incomplete booking lock comparison/);
  console.log("Read-only Firestore migration inspection integration tests passed");
})().catch(err=>{console.error(err);process.exitCode=1;});
