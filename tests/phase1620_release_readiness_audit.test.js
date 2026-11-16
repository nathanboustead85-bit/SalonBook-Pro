"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createPhase16ReleaseReadinessAudit,RELEASE_BLOCKERS}=require("../functions/phase1620ReleaseReadinessAudit");
const {prepareBookingStoragePlan}=require("../functions/phase151BookingInfrastructurePreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const secret="phase1620-server-test-secret-more-than-32";
const input={ownerId:"salonA",key:"request_12345",intent:{serviceId:"cut",staffId:"barber",date:"2026-11-20",time:"10:00"}};
const plan=prepareBookingStoragePlan({...input,secret});
const id="b".repeat(64);
const marker={ownerId:"salonA",requestId:plan.requestId,fingerprint:plan.fingerprint,reservationId:id,state:"COMMITTED_SIMULATION",schemaVersion:1};
const reservation={id,ownerId:"salonA",requestId:plan.requestId,fingerprint:plan.fingerprint,state:"COMMITTED_SIMULATION",schemaVersion:1};
const pair={consistentSnapshot:true,marker,reservation};
const make=readConsistentPair=>createPhase16ReleaseReadinessAudit({secret,readConsistentPair});
const scenario={requests:[input],batches:[[input]]};
async function main(){
 const good=make(async()=>pair);
 const clear=await good.audit(scenario);
 assert.equal(clear.status,"PHASE_16_SIMULATED_CHECKS_PASSED_RELEASE_BLOCKED");
 assert.equal(clear.simulatedChecksPassed,true);
 assert.equal(clear.productionReady,false);
 assert.equal(clear.acceptingBookings,false);
 assert.equal(clear.reservationCreated,false);
 assert.equal(clear.legacyAppointmentsUntouchedByAudit,true);
 assert.deepEqual(clear.blockers,RELEASE_BLOCKERS);
 assert.ok(clear.blockers.length>=4);
 const cases=[
  undefined,
  {requests:[],batches:[[input]]},
  {requests:[input],batches:[]},
  {requests:[input,{...input,intent:{...input.intent,time:"11:00"}}],batches:[[input]]},
  {requests:[input],batches:[Array.from({length:100},()=>input)]}
 ];
 for(const item of cases){
  const result=await good.audit(item);
  assert.equal(result.status,"PHASE_16_MANUAL_REVIEW_REQUIRED");
  assert.equal(result.productionReady,false);
  assert.equal(result.acceptingBookings,false);
 }
 for(const read of [
  async()=>{throw Error("offline");},
  async()=>({...pair,marker:null}),
  async()=>({...pair,reservation:{...reservation,ownerId:"salonB"}})
 ]){
  const result=await make(read).audit(scenario);
  assert.equal(result.status,"PHASE_16_MANUAL_REVIEW_REQUIRED");
  assert.equal(result.productionReady,false);
 }
 const absent=await make(async()=>({consistentSnapshot:true,marker:null,reservation:null})).audit(scenario);
 assert.equal(absent.simulatedChecksPassed,true);
 assert.equal(absent.productionReady,false);
 assert.deepEqual(await good.reserve(input),DISABLED);
 const entry=fs.readFileSync(path.join(__dirname,"../functions/index.js"),"utf8");
 const source=fs.readFileSync(path.join(__dirname,"../functions/phase1620ReleaseReadinessAudit.js"),"utf8");
 assert.ok(!entry.includes("phase1620ReleaseReadinessAudit"));
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction("));
 assert.ok(!JSON.stringify(clear).includes("request_12345"));
 assert.ok(!JSON.stringify(clear).includes("salonA"));
 console.log("PASS Phase 16.20 simulated release audit, explicit production blockers, fail-closed safety, disabled bookings");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
