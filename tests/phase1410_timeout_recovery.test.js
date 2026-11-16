"use strict";
const assert=require("node:assert/strict");
const {createTimeoutRecoverySimulator}=require("../functions/phase1410TimeoutRecoverySimulator");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const catalogue={services:[{id:"cut",published:true,durationMinutes:30}],
 staff:[{id:"kody",active:true,serviceIds:["cut"]}]};
const schedules=[{id:"kody",weeklySchedule:{friday:{open:"09:00",close:"17:00"}},weeklyBreaks:[],timeOff:[]}];
const original={staffId:"kody",date:"2026-11-20",time:"10:00",durationMinutes:30,status:"confirmed"};
const a={serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"};
const make=()=>createTimeoutRecoverySimulator({catalogue,schedules,bookings:[original]});
function main(){
 const s=make(),before=s.read(),key="timeout_request_1234";
 assert.equal(s.request("owner",key,a,{timeoutAt:"before"}).status,"REQUEST_OUTCOME_UNKNOWN");
 assert.deepEqual(s.read(),before,"pre-execution timeout creates nothing");
 assert.equal(s.recover("owner",key,a).status,"RECOVERY_NOT_FOUND");
 assert.equal(s.request("owner",key,a).status,"SIMULATION_COMMITTED_IN_MEMORY_ONLY");
 assert.equal(s.recover("owner",key,a).status,"SIMULATION_PREVIOUS_OUTCOME_FOUND");
 assert.equal(s.request("owner",key,a).replayed,true);
 assert.equal(s.read().bookings.length,2,"retry never duplicates simulated booking");
 assert.equal(s.read().bookings[0].time,"10:00","original appointment unchanged");
 assert.equal(s.recover("owner",key,{...a,time:"11:00"}).status,"IDEMPOTENCY_KEY_REUSED");
 const t=make(),k2="after_commit_1234";
 assert.equal(t.request("owner",k2,a,{timeoutAt:"after"}).status,"REQUEST_OUTCOME_UNKNOWN");
 assert.equal(t.read().bookings.length,2,"simulated commit happened despite lost reply");
 assert.equal(t.recover("owner",k2,a).status,"SIMULATION_PREVIOUS_OUTCOME_FOUND");
 assert.equal(t.request("owner",k2,a).replayed,true,"same-key retry replays");
 assert.equal(t.read().bookings.length,2);
 const failed=make(),k3="failed_request_1234";
 assert.equal(failed.request("owner",k3,a,{simulateFailure:true}).status,"SIMULATION_ROLLED_BACK");
 assert.equal(failed.recover("owner",k3,a).status,"RECOVERY_NOT_FOUND");
 assert.deepEqual(failed.read(),before);
 assert.equal(failed.request("owner",k3,a).status,"SIMULATION_COMMITTED_IN_MEMORY_ONLY");
 assert.equal(failed.request("owner",k3,{...a,time:"11:00"}).status,"IDEMPOTENCY_KEY_REUSED");
 assert.equal(failed.recover("../owner",k3,a).status,"RECOVERY_REQUEST_INVALID");
 return failed.reserve(a).then(result=>{
  assert.deepEqual(result,DISABLED);
  console.log("PASS Phase 14.10 timeout before/after commit, uncertain recovery and safe retry; no cloud writes");
 });
}
main().catch(e=>{console.error(e);process.exitCode=1;});
