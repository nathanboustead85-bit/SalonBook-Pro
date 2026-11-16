"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createRecoveryConsistencyPreparation}=require("../functions/phase1510RecoveryConsistencyPreparation");
const {prepareBookingStoragePlan}=require("../functions/phase151BookingInfrastructurePreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const input={ownerId:"owner1",key:"request_12345",secret:"phase1510-secret-at-least-32-bytes-long",
 intent:{serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"}};
const plan=prepareBookingStoragePlan(input),now=1800000000000,id="a".repeat(64);
const good=()=>({consistentSnapshot:true,
 marker:{fingerprint:plan.fingerprint,state:"COMMITTED_SIMULATION",createdAt:now-1000,reservationId:id},
 reservation:{id,requestId:plan.requestId,fingerprint:plan.fingerprint,state:"COMMITTED_SIMULATION",ownerId:"owner1"}});
const make=(pair,fail=false)=>{const calls=[];return {calls,store:{async readPair(...args){
 calls.push(args);if(fail)throw Error("offline");return pair;},
 set(){throw Error("write attempted");},delete(){throw Error("delete attempted");}}};};
async function main(){
 const fixture=make(good()),api=createRecoveryConsistencyPreparation(fixture.store,{clock:()=>now});
 assert.deepEqual(await api.reserve(input),DISABLED);
 const ok=await api.inspect(input);
 assert.equal(ok.status,"CONSISTENCY_SIMULATED_PAIR_VERIFIED");
 assert.equal(ok.acceptingBookings,false);
 assert.equal(ok.reservationCreated,false);
 assert.deepEqual(fixture.calls[0],[plan.recoveryDocumentPath,plan.bookingCollectionPath]);
 const cases=[
  [null,"CONSISTENCY_UNCERTAIN"],
  [{...good(),consistentSnapshot:false},"CONSISTENCY_UNCERTAIN"],
  [{...good(),reservation:null},"CONSISTENCY_UNCERTAIN"],
  [{...good(),marker:{...good().marker,fingerprint:"b".repeat(64)}},"CONSISTENCY_KEY_REUSED_OR_CORRUPT"],
  [{...good(),marker:{...good().marker,fingerprint:"bad"}},"CONSISTENCY_KEY_REUSED_OR_CORRUPT"],
  [{...good(),marker:{...good().marker,state:"PENDING"}},"CONSISTENCY_UNCERTAIN"],
  [{...good(),marker:{...good().marker,createdAt:now+1}},"CONSISTENCY_UNCERTAIN"],
  [{...good(),marker:{...good().marker,createdAt:now-8*86400000}},"CONSISTENCY_UNCERTAIN"],
  [{...good(),marker:{...good().marker,reservationId:"c".repeat(64)}},"CONSISTENCY_UNCERTAIN"],
  [{...good(),reservation:{...good().reservation,requestId:"c".repeat(64)}},"CONSISTENCY_UNCERTAIN"],
  [{...good(),reservation:{...good().reservation,ownerId:"other"}},"CONSISTENCY_UNCERTAIN"],
  [{...good(),reservation:{...good().reservation,state:"PENDING"}},"CONSISTENCY_UNCERTAIN"]
 ];
 for(const [pair,expected] of cases){
  const f=make(pair);
  const result=await createRecoveryConsistencyPreparation(f.store,{clock:()=>now}).inspect(input);
  assert.equal(result.status,expected);
  assert.equal(result.acceptingBookings,false);
  assert.equal(result.reservationCreated,false);
 }
 assert.equal((await createRecoveryConsistencyPreparation(make(good(),true).store,{clock:()=>now}).inspect(input)).status,
  "CONSISTENCY_UNCERTAIN");
 assert.equal((await api.inspect({...input,key:"short"})).status,"CONSISTENCY_INVALID");
 assert.throws(()=>createRecoveryConsistencyPreparation({}),TypeError);
 const source=fs.readFileSync(path.resolve(__dirname,"../functions/phase1510RecoveryConsistencyPreparation.js"),"utf8");
 const entry=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
 assert.ok(!entry.includes("phase1510RecoveryConsistencyPreparation"));
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction("));
 console.log("PASS Phase 15.10 consistent mock snapshots, missing/corrupt/mismatched markers, expiry, offline and disabled bookings");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
