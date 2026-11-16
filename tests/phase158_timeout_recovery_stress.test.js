"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createTimeoutRecoveryStressSimulation}=require("../functions/phase158TimeoutRecoveryStressSimulation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const catalogue={services:[{id:"cut",published:true,durationMinutes:30}],
 staff:[{id:"kody",active:true,serviceIds:["cut"]}]};
const schedules=[{id:"kody",weeklySchedule:{friday:{open:"09:00",close:"17:00"}},weeklyBreaks:[],timeOff:[]}];
const original={staffId:"kody",date:"2026-11-20",time:"10:00",durationMinutes:30,status:"confirmed"};
const input={ownerId:"owner1",key:"request_12345",secret:"phase158-test-secret-longer-than-32-bytes",
 intent:{serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"}};
const make=()=>createTimeoutRecoveryStressSimulation({catalogue,schedules,bookings:[original]});
async function main(){
 const s=make(),before=s.read();
 assert.deepEqual(await s.reserve(input),DISABLED);
 assert.equal(s.attempt(input,{timeoutAt:"before"}).status,"TIMEOUT_OUTCOME_UNCERTAIN");
 assert.deepEqual(s.read(),before);
 assert.equal(s.recover(input).status,"TIMEOUT_OUTCOME_UNCERTAIN");
 assert.equal(s.attempt(input,{timeoutAt:"after"}).status,"TIMEOUT_OUTCOME_UNCERTAIN");
 assert.equal(s.read().bookings.length,2);
 assert.equal(s.markerCount(),1);
 assert.equal(s.recover(input).status,"TIMEOUT_SIMULATED_OUTCOME_RECOVERED");
 assert.equal(s.recover(input).replayed,true);
 assert.equal(s.recover(input,{offline:true}).status,"TIMEOUT_OUTCOME_UNCERTAIN");
 assert.equal(s.attempt(input).status,"SIMULATION_PREVIOUS_OUTCOME_FOUND");
 assert.equal(s.recover({...input,intent:{...input.intent,time:"11:00"}}).status,"TIMEOUT_KEY_REUSED");
 assert.equal(s.read().bookings.length,2);
 assert.deepEqual(s.read().bookings[0],original);
 const conflict=make();
 assert.equal(conflict.attempt({...input,intent:{...input.intent,time:"10:00"}}).status,
  "EXISTING_BOOKING_CONFLICT");
 assert.equal(conflict.markerCount(),0);
 assert.deepEqual(conflict.read(),before);
 const stress=make();
 const requests=Array.from({length:60},(_,i)=>({...input,key:"request_"+String(i).padStart(8,"0")}));
 const results=stress.stress(requests);
 assert.equal(results.status,"TIMEOUT_STRESS_COMPLETE");
 assert.equal(results.outcomes[0].first,"TIMEOUT_OUTCOME_UNCERTAIN");
 assert.equal(results.outcomes[0].recovery,"TIMEOUT_SIMULATED_OUTCOME_RECOVERED");
 assert.equal(results.outcomes.slice(1).every(x=>x.first==="EXISTING_BOOKING_CONFLICT"
  &&x.recovery==="TIMEOUT_OUTCOME_UNCERTAIN"),true);
 assert.equal(stress.read().bookings.length,2);
 assert.equal(stress.markerCount(),1);
 assert.deepEqual(stress.read().bookings[0],original);
 assert.equal(stress.attempt(input,{timeoutAt:"invalid"}).status,"TIMEOUT_INVALID");
 assert.equal(stress.stress([]).status,"TIMEOUT_INVALID");
 const source=fs.readFileSync(path.resolve(__dirname,"../functions/phase158TimeoutRecoveryStressSimulation.js"),"utf8");
 const entry=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
 assert.ok(!entry.includes("phase158TimeoutRecoveryStressSimulation"));
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction("));
 console.log("PASS Phase 15.8 60-request timeout, acknowledgement loss, recovery, fail-closed uncertainty, unchanged appointments");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
