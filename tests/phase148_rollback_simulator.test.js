"use strict";
const assert=require("node:assert/strict");
const {createRollbackSimulator}=require("../functions/phase148RollbackSimulator");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const catalogue={services:[{id:"cut",published:true,durationMinutes:30}],
 staff:[{id:"kody",active:true,serviceIds:["cut"]}]};
const schedules=[{id:"kody",weeklySchedule:{friday:{open:"09:00",close:"17:00"}},weeklyBreaks:[],timeOff:[]}];
const original={staffId:"kody",date:"2026-11-20",time:"10:00",durationMinutes:30,status:"confirmed"};
const a={serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"};
const b={...a,time:"09:15"};
function simulator(){return createRollbackSimulator({catalogue,schedules,bookings:[original]});}
async function main(){
 const s=simulator(),before=s.read();
 assert.deepEqual(await s.reserve(a),DISABLED);
 assert.deepEqual(s.read(),before,"disabled reserve does not change bookings");
 const p1=s.prepare(a),p2=s.prepare(b);
 assert.equal(p1.status,"NO_KNOWN_CONFLICTS_ONLY");
 assert.equal(p2.status,"NO_KNOWN_CONFLICTS_ONLY");
 assert.equal(s.commit(p1,{simulateFailure:true}).status,"SIMULATION_ROLLED_BACK");
 assert.deepEqual(s.read(),before,"failure rolls back every change");
 assert.equal(s.commit(p1).status,"SIMULATION_COMMITTED_IN_MEMORY_ONLY");
 assert.equal(s.read().bookings.length,2,"only simulator gained one record");
 assert.equal(s.read().bookings[0].time,"10:00","original appointment unchanged");
 assert.equal(s.commit(p2).status,"SIMULATION_RETRY_REQUIRED","second concurrent attempt loses");
 assert.equal(s.prepare(b).status,"EXISTING_BOOKING_CONFLICT","retry sees winner");
 assert.equal(s.commit(p1).status,"SIMULATION_RETRY_REQUIRED","replay cannot double book");
 const other=simulator();
 assert.equal(other.commit(other.prepare({...a,time:"10:00"})).status,"SIMULATION_REJECTED");
 assert.deepEqual(other.read().bookings,[original]);
 const independent=simulator();
 const q1=independent.prepare(a),q2=independent.prepare({...a,time:"11:00"});
 assert.equal(independent.commit(q1).status,"SIMULATION_COMMITTED_IN_MEMORY_ONLY");
 assert.equal(independent.commit(q2).status,"SIMULATION_RETRY_REQUIRED");
 assert.equal(independent.commit(independent.prepare({...a,time:"11:00"})).status,"SIMULATION_COMMITTED_IN_MEMORY_ONLY");
 assert.equal(independent.read().bookings.length,3);
 const mutable=simulator(),snap=mutable.read();
 snap.bookings[0].time="01:00";
 assert.equal(mutable.read().bookings[0].time,"10:00","snapshot is a copy");
 assert.equal(mutable.commit({version:0,status:"NO_KNOWN_CONFLICTS_ONLY",intent:{...a,time:"10:00"}}).status,
  "EXISTING_BOOKING_CONFLICT","cannot bypass validation");
 assert.deepEqual(mutable.read().bookings,[original]);
 console.log("PASS Phase 14.8 in-memory atomic rollback, concurrency and replay; no Firestore writes");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
