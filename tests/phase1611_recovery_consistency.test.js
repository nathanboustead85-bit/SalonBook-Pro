"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createRecoveryConsistencyInspector}=require("../functions/phase1611RecoveryConsistencyInspector");
const {prepareBookingStoragePlan}=require("../functions/phase151BookingInfrastructurePreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const secret="phase1611-server-test-secret-more-than-32";
const input={ownerId:"salonA",key:"request_12345",
 intent:{serviceId:"cut",staffId:"barber",date:"2026-11-20",time:"10:00"}};
const plan=prepareBookingStoragePlan({...input,secret});
const id="b".repeat(64);
const marker={ownerId:"salonA",requestId:plan.requestId,fingerprint:plan.fingerprint,
 reservationId:id,state:"COMMITTED_SIMULATION",schemaVersion:1};
const reservation={id,ownerId:"salonA",requestId:plan.requestId,
 fingerprint:plan.fingerprint,state:"COMMITTED_SIMULATION",schemaVersion:1};
const pair={consistentSnapshot:true,marker,reservation};
const make=p=>createRecoveryConsistencyInspector({secret,readConsistentPair:async()=>p});
async function main(){
 const inspector=make(pair);
 assert.equal((await inspector.inspect(input)).status,"CONSISTENCY_PRIOR_SIMULATED_COMMIT_VERIFIED");
 const hundred=await Promise.all(Array.from({length:100},()=>inspector.inspect(input)));
 assert.ok(hundred.every(x=>x.status==="CONSISTENCY_PRIOR_SIMULATED_COMMIT_VERIFIED"));
 assert.equal((await inspector.inspect({...input,intent:{...input.intent,time:"11:00"}})).status,
  "CONSISTENCY_IDEMPOTENCY_KEY_REUSED");
 for(const bad of [
  {marker:null,reservation}, {marker,reservation:null}
 ])assert.equal((await make({...pair,...bad}).inspect(input)).status,
  "CONSISTENCY_PARTIAL_RECORD_MANUAL_REVIEW");
 for(const bad of [
  {marker:{...marker,schemaVersion:2}},
  {reservation:{...reservation,unexpected:"data"}},
  {marker:{...marker,requestId:null}},
  {reservation:{...reservation,schemaVersion:"1"}}
 ])assert.equal((await make({...pair,...bad}).inspect(input)).status,"CONSISTENCY_SCHEMA_INVALID");
 for(const bad of [
  {reservation:{...reservation,ownerId:"salonB"}},
  {reservation:{...reservation,id:"c".repeat(64)}},
  {marker:{...marker,state:"PENDING"}},
  {reservation:{...reservation,requestId:"c".repeat(64)}}
 ])assert.equal((await make({...pair,...bad}).inspect(input)).status,
  "CONSISTENCY_CORRUPT_MANUAL_REVIEW");
 assert.equal((await make({...pair,consistentSnapshot:false}).inspect(input)).status,
  "CONSISTENCY_SNAPSHOT_UNTRUSTED");
 assert.equal((await make({consistentSnapshot:true,marker:null,reservation:null}).inspect(input)).status,
  "CONSISTENCY_NO_RECORD_ONLY");
 const down=createRecoveryConsistencyInspector({secret,readConsistentPair:async()=>{throw Error("offline");}});
 assert.equal((await down.inspect(input)).status,"CONSISTENCY_READ_UNAVAILABLE");
 assert.equal((await inspector.inspect({...input,key:"bad"})).status,"CONSISTENCY_REQUEST_INVALID");
 assert.deepEqual(await inspector.reserve(input),DISABLED);
 const root=path.resolve(__dirname,"..");
 const entry=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
 const source=fs.readFileSync(path.join(root,"functions/phase1611RecoveryConsistencyInspector.js"),"utf8");
 assert.ok(!entry.includes("phase1611RecoveryConsistencyInspector"));
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction("));
 console.log("PASS Phase 16.11 strict schemas, corruption, owner isolation, stale snapshot, 100 retries, disabled bookings");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
