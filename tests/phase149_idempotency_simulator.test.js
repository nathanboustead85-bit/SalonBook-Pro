"use strict";
const assert=require("node:assert/strict");
const {createIdempotencySimulator}=require("../functions/phase149IdempotencySimulator");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const catalogue={services:[{id:"cut",published:true,durationMinutes:30}],
 staff:[{id:"kody",active:true,serviceIds:["cut"]}]};
const schedules=[{id:"kody",weeklySchedule:{friday:{open:"09:00",close:"17:00"}},weeklyBreaks:[],timeOff:[]}];
const original={staffId:"kody",date:"2026-11-20",time:"10:00",durationMinutes:30,status:"confirmed"};
const a={serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"};
const key="client_request_12345678";
const make=()=>createIdempotencySimulator({catalogue,schedules,bookings:[original]});
async function main(){
 const s=make(),before=s.read();
 assert.deepEqual(await s.reserve(a),DISABLED);
 assert.deepEqual(s.read(),before);
 assert.equal(s.submit("owner",key,a,{simulateFailure:true}).status,"SIMULATION_ROLLED_BACK");
 assert.equal(s.ledgerSize(),0,"failed requests are retryable");
 assert.deepEqual(s.read(),before,"rollback preserves original");
 const first=s.submit("owner",key,a);
 assert.equal(first.status,"SIMULATION_COMMITTED_IN_MEMORY_ONLY");
 assert.equal(first.replayed,false);
 assert.equal(s.read().bookings.length,2);
 for(const variant of [a,{time:a.time,date:a.date,staffId:a.staffId,serviceId:a.serviceId}]){
  const repeated=s.submit("owner",key,variant);
  assert.equal(repeated.status,first.status,"retry returns prior result");
  assert.equal(repeated.replayed,true);
 }
 assert.equal(s.read().bookings.length,2,"double tap creates one simulated booking");
 assert.equal(s.ledgerSize(),1);
 assert.equal(s.submit("owner",key,{...a,time:"11:00"}).status,"IDEMPOTENCY_KEY_REUSED");
 assert.equal(s.read().bookings.length,2,"key reused with new payload blocked");
 assert.equal(s.submit("owner","another_request_1234",a).status,"EXISTING_BOOKING_CONFLICT");
 assert.equal(s.submit("owner","short",a).status,"IDEMPOTENCY_KEY_INVALID");
 assert.equal(s.submit("../owner",key,a).status,"IDEMPOTENCY_KEY_INVALID");
 assert.equal(s.submit("owner","third_request_1234",{}).status,"IDEMPOTENCY_REQUEST_INVALID");
 assert.equal(s.read().bookings[0].time,"10:00","original unchanged");
 const other=make();
 assert.equal(other.submit("other-owner",key,a).status,"SIMULATION_COMMITTED_IN_MEMORY_ONLY");
 assert.equal(other.ledgerSize(),1,"key namespace scoped to owner");
 console.log("PASS Phase 14.9 duplicate taps, retries, conflicting payloads, rollback; zero cloud writes");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
