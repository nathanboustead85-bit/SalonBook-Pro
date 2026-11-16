"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createRestartRecoveryInspector}=require("../functions/phase1610RestartRecoveryInspector");
const {prepareBookingStoragePlan}=require("../functions/phase151BookingInfrastructurePreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const secret="phase1610-test-server-secret-more-than-32";
const input={ownerId:"salonA",key:"request_12345",
 intent:{serviceId:"cut",staffId:"barber",date:"2026-11-20",time:"10:00"}};
const plan=prepareBookingStoragePlan({...input,secret});
const reservationId="b".repeat(64);
const marker={ownerId:"salonA",requestId:plan.requestId,fingerprint:plan.fingerprint,
 reservationId,state:"COMMITTED_SIMULATION"};
const reservation={id:reservationId,ownerId:"salonA",requestId:plan.requestId,
 fingerprint:plan.fingerprint,state:"COMMITTED_SIMULATION"};
async function main(){
 const durableFixture=new Map();
 const reader=async({ownerId,requestId,recoveryDocumentPath,bookingCollectionPath})=>{
  assert.equal(recoveryDocumentPath,"users/"+ownerId+"/customerBookingRequests/"+requestId);
  assert.equal(bookingCollectionPath,"users/"+ownerId+"/customerBookingReservations");
  return durableFixture.get(ownerId+":"+requestId)||{consistentSnapshot:true,marker:null,reservation:null};
 };
 const start=()=>createRestartRecoveryInspector({secret,readConsistentPair:reader});
 assert.equal((await start().inspect(input)).status,"RESTART_NO_PRIOR_RECORD_ONLY");
 // Simulate a previously committed pair surviving disposal of the inspector.
 durableFixture.set("salonA:"+plan.requestId,{consistentSnapshot:true,marker,reservation});
 let first=start();
 assert.equal((await first.inspect(input)).status,"RESTART_PREVIOUS_SIMULATED_COMMIT_VERIFIED");
 first=null;
 const restarted=start();
 const checks=await Promise.all(Array.from({length:100},()=>restarted.inspect(input)));
 assert.ok(checks.every(x=>x.status==="RESTART_PREVIOUS_SIMULATED_COMMIT_VERIFIED"));
 assert.equal((await restarted.inspect({...input,intent:{...input.intent,time:"11:00"}})).status,
  "RESTART_IDEMPOTENCY_KEY_REUSED");
 const partial=createRestartRecoveryInspector({secret,readConsistentPair:async()=>({
  consistentSnapshot:true,marker,reservation:null})});
 assert.equal((await partial.inspect(input)).status,"RESTART_PARTIAL_RECORD_MANUAL_REVIEW");
 const stale=createRestartRecoveryInspector({secret,readConsistentPair:async()=>({
  consistentSnapshot:false,marker,reservation})});
 assert.equal((await stale.inspect(input)).status,"RESTART_SNAPSHOT_UNTRUSTED");
 const unavailable=createRestartRecoveryInspector({secret,readConsistentPair:async()=>{throw Error("offline");}});
 assert.equal((await unavailable.inspect(input)).status,"RESTART_READ_UNAVAILABLE");
 const forged=createRestartRecoveryInspector({secret,readConsistentPair:async()=>({
  consistentSnapshot:true,marker,reservation:{...reservation,ownerId:"salonB"}})});
 assert.equal((await forged.inspect(input)).status,"RESTART_RECORD_INCONSISTENT_MANUAL_REVIEW");
 assert.equal((await restarted.inspect({...input,ownerId:"salonB"})).status,"RESTART_NO_PRIOR_RECORD_ONLY");
 assert.equal((await restarted.inspect({...input,key:"bad"})).status,"RESTART_REQUEST_INVALID");
 assert.deepEqual(await restarted.reserve(input),DISABLED);
 const root=path.resolve(__dirname,"..");
 const entry=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
 const source=fs.readFileSync(path.join(root,"functions/phase1610RestartRecoveryInspector.js"),"utf8");
 assert.ok(!entry.includes("phase1610RestartRecoveryInspector"));
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction("));
 console.log("PASS Phase 16.10 restart recovery, 100 retries, owner separation, partial/forged/stale/outage failures, disabled bookings");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
