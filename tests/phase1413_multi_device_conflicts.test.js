"use strict";
const assert=require("node:assert/strict");
const {createMultiDeviceConflictSimulator}=require("../functions/phase1413MultiDeviceConflictSimulator");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const catalogue={services:[{id:"cut",published:true,durationMinutes:30}],
 staff:[{id:"kody",active:true,serviceIds:["cut"]}]};
const schedules=[{id:"kody",weeklySchedule:{friday:{open:"09:00",close:"17:00"}},weeklyBreaks:[],timeOff:[]}];
const original={staffId:"kody",date:"2026-11-20",time:"10:00",durationMinutes:30,status:"confirmed"};
const a={serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"};
const make=()=>createMultiDeviceConflictSimulator({catalogue,schedules,bookings:[original]});
async function main(){
 const shared=make(),phone=shared.device("Samsung"),tablet=shared.device("Tablet");
 const before=shared.read();
 assert.deepEqual(await shared.reserve(a),DISABLED);
 assert.deepEqual(shared.read(),before);
 const phoneView=phone.observe(),tabletView=tablet.observe();
 assert.equal(phoneView.version,tabletView.version);
 const first=phone.prepare(a),second=tablet.prepare({...a,time:"09:15"});
 assert.equal(first.status,"NO_KNOWN_CONFLICTS_ONLY");
 assert.equal(second.status,"NO_KNOWN_CONFLICTS_ONLY");
 assert.equal(phone.attempt(first).status,"SIMULATION_COMMITTED_IN_MEMORY_ONLY");
 assert.equal(tablet.attempt(second).status,"SIMULATION_RETRY_REQUIRED",
  "stale second device must not overwrite");
 assert.equal(tablet.prepare({...a,time:"09:15"}).status,"EXISTING_BOOKING_CONFLICT");
 assert.equal(shared.read().bookings.length,2);
 assert.equal(shared.read().bookings[0].time,"10:00","original appointment preserved");
 assert.equal(tablet.cached().version,0,"cached device view remains stale");
 assert.equal(tablet.observe().version,1,"refresh observes winner");
 assert.equal(tablet.attempt(first).status,"DEVICE_PLAN_INVALID","device cannot submit another device plan");
 assert.equal(phone.attempt(first).status,"SIMULATION_RETRY_REQUIRED","replay cannot duplicate");
 const distinct=make(),one=distinct.device("A"),two=distinct.device("B");
 const p=one.prepare(a),q=two.prepare({...a,time:"11:00"});
 assert.equal(one.attempt(p,{simulateFailure:true}).status,"SIMULATION_ROLLED_BACK");
 assert.equal(distinct.read().bookings.length,1,"rollback leaves original intact");
 assert.equal(one.attempt(p).status,"SIMULATION_COMMITTED_IN_MEMORY_ONLY");
 assert.equal(two.attempt(q).status,"SIMULATION_RETRY_REQUIRED");
 assert.equal(two.attempt(two.prepare({...a,time:"11:00"})).status,"SIMULATION_COMMITTED_IN_MEMORY_ONLY");
 assert.equal(distinct.read().bookings.length,3,"non-overlapping slot succeeds after refresh");
 assert.equal(distinct.read().bookings[0].time,"10:00");
 console.log("PASS Phase 14.13 two-device stale snapshots, collisions, retry and rollback; no cloud writes");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
