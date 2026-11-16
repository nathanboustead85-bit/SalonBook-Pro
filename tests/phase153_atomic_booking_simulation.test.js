"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createAtomicBookingSimulation}=require("../functions/phase153AtomicBookingSimulation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const catalogue={services:[{id:"cut",published:true,durationMinutes:30}],
 staff:[{id:"kody",active:true,serviceIds:["cut"]}]};
const schedules=[{id:"kody",weeklySchedule:{friday:{open:"09:00",close:"17:00"}},weeklyBreaks:[],timeOff:[]}];
const original={staffId:"kody",date:"2026-11-20",time:"10:00",durationMinutes:30,status:"confirmed"};
const secret="phase153-test-secret-longer-than-32-bytes";
const intent={serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"};
const input={ownerId:"owner1",key:"request_12345",secret,intent};
const make=()=>createAtomicBookingSimulation({catalogue,schedules,bookings:[original]});
async function main(){
 const s=make(),before=s.read();
 assert.deepEqual(await s.reserve(input),DISABLED);
 assert.deepEqual(s.read(),before);
 const p1=s.prepare(input);
 const p2=s.prepare({...input,key:"request_22222",intent:{...intent,time:"09:15"}});
 assert.equal(p1.status,"SIMULATION_PLAN_ONLY");
 assert.equal(s.commit(p1,{simulateFailure:true}).status,"SIMULATION_ATOMIC_ROLLBACK");
 assert.deepEqual(s.read(),before,"failed commit must roll back booking and marker");
 assert.equal(s.commit(p1).status,"SIMULATION_ATOMIC_COMMIT_ONLY");
 assert.equal(s.read().bookings.length,2);
 assert.equal(s.read().requestCount,1);
 assert.deepEqual(s.read().bookings[0],original,"original appointment preserved");
 assert.equal(s.commit(p1).status,"SIMULATION_PREVIOUS_OUTCOME_FOUND");
 assert.equal(s.commit(p1).replayed,true);
 assert.equal(s.read().bookings.length,2,"replay cannot duplicate booking");
 assert.equal(s.submit({...input,intent:{...intent,time:"11:00"}}).status,
  "SIMULATION_IDEMPOTENCY_KEY_REUSED");
 assert.equal(s.commit(p2).status,"SIMULATION_RETRY_REQUIRED");
 assert.equal(s.submit({...input,key:"request_33333",intent:{...intent,time:"09:15"}}).status,
  "EXISTING_BOOKING_CONFLICT");
 assert.equal(s.submit({...input,key:"request_44444",intent:{...intent,time:"11:00"}}).status,
  "SIMULATION_ATOMIC_COMMIT_ONLY");
 assert.equal(s.read().requestCount,2);
 assert.equal(s.read().bookings.length,3);
 assert.equal(s.submit({...input,ownerId:"../invalid"}).status,"SIMULATION_INVALID");
 const failed=make();
 assert.equal(failed.submit({...input,intent:{...intent,time:"10:00"}}).status,
  "EXISTING_BOOKING_CONFLICT");
 assert.deepEqual(failed.read(),before);
 const snapshot=s.read();snapshot.bookings[0].time="00:00";
 assert.deepEqual(s.read().bookings[0],original);
 const entry=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
 assert.ok(!entry.includes("phase153AtomicBookingSimulation"),"no production endpoint");
 const source=fs.readFileSync(path.resolve(__dirname,"../functions/phase153AtomicBookingSimulation.js"),"utf8");
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction("),
  "simulation must never connect to Firestore");
 console.log("PASS Phase 15.3 atomic booking + request marker, duplicate retry, collision, rollback, disabled endpoint");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
