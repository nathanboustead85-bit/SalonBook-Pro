"use strict";
const assert=require("node:assert/strict");
const {createEndToEndSafetyRehearsal}=require("../functions/phase1414EndToEndSafetyRehearsal");
const {createInMemoryRecoveryAdapter}=require("../functions/phase1411RecoveryRecordPreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const catalogue={services:[{id:"cut",published:true,durationMinutes:30}],
 staff:[{id:"kody",active:true,serviceIds:["cut"]}]};
const schedules=[{id:"kody",weeklySchedule:{friday:{open:"09:00",close:"17:00"}},weeklyBreaks:[],timeOff:[]}];
const original={staffId:"kody",date:"2026-11-20",time:"10:00",durationMinutes:30,status:"confirmed"};
const a={serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"};
const secret="phase1414-test-secret-longer-than-32-bytes";
const now=1800000000000;
function make(adapter=createInMemoryRecoveryAdapter()){
 return createEndToEndSafetyRehearsal({catalogue,schedules,bookings:[original]},
  {adapter,secret,clock:()=>now});
}
async function main(){
 const adapter=createInMemoryRecoveryAdapter(),s=make(adapter),before=s.read();
 assert.deepEqual(await s.reserve(a),DISABLED);
 assert.deepEqual(s.read(),before,"public reservation never mutates simulation");
 assert.equal((await s.simulate({owner:"owner",key:"key_00000001",intent:{...a,time:"10:00"}})).status,
  "EXISTING_BOOKING_CONFLICT");
 assert.equal((await s.simulate({owner:"owner",key:"key_00000002",intent:{...a,time:"08:00"}})).reservationCreated,false);
 assert.deepEqual(s.read(),before,"invalid and conflicting requests leave state intact");
 assert.equal((await s.simulate({owner:"owner",key:"key_00000003",intent:a,simulateFailure:true})).status,
  "SIMULATION_ROLLED_BACK");
 assert.deepEqual(s.read(),before,"failed simulation rolls back");
 assert.equal((await s.simulate({owner:"owner",key:"key_00000003",intent:a})).status,
  "SIMULATION_RECORDED_IN_TEST_ONLY");
 assert.equal((await s.simulate({owner:"owner",key:"key_00000003",intent:a,device:"tablet"})).status,
  "SIMULATION_ALREADY_RECORDED");
 assert.equal((await s.recover("owner","key_00000003",a)).status,"SIMULATION_PREVIOUS_OUTCOME_FOUND");
 assert.equal((await s.simulate({owner:"owner",key:"key_00000003",intent:{...a,time:"11:00"}})).status,
  "IDEMPOTENCY_KEY_REUSED");
 assert.equal((await s.simulate({owner:"owner",key:"key_00000004",intent:{...a,time:"09:15"}})).status,
  "EXISTING_BOOKING_CONFLICT");
 assert.equal(s.read().bookings.length,2,"no duplicate simulated booking");
 assert.deepEqual(s.read().bookings[0],original,"original booking unchanged");
 const failing=make({async read(){throw Error("offline");},async createIfAbsent(){throw Error("offline");}});
 assert.equal((await failing.simulate({owner:"owner",key:"key_00000005",intent:a})).status,
  "SECURE_RECORD_OUTCOME_UNCERTAIN");
 assert.equal(failing.read().bookings.length,1,"storage unavailable blocks mutation");
 const interrupted=make({async read(){return null;},async createIfAbsent(){throw Error("offline");}});
 assert.equal((await interrupted.simulate({owner:"owner",key:"key_00000006",intent:a})).status,
  "SIMULATION_OUTCOME_UNCERTAIN");
 assert.equal(interrupted.read().bookings.length,2,
  "non-atomic storage failure demonstrates why this is NOT production ready");
 console.log("PASS Phase 14.14 validation, conflicts, recovery, rollback, disabled entry and non-atomic failure disclosure");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
