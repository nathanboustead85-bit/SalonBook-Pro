"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createTransactionRetryStressSimulation}=require("../functions/phase157TransactionRetryStressSimulation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const catalogue={services:[{id:"cut",published:true,durationMinutes:30}],
 staff:[{id:"kody",active:true,serviceIds:["cut"]}]};
const schedules=[{id:"kody",weeklySchedule:{friday:{open:"09:00",close:"17:00"}},weeklyBreaks:[],timeOff:[]}];
const original={staffId:"kody",date:"2026-11-20",time:"10:00",durationMinutes:30,status:"confirmed"};
const secret="phase157-test-secret-at-least-32-bytes-long";
const intent={serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"};
const make=(maxAttempts=3)=>createTransactionRetryStressSimulation({catalogue,schedules,bookings:[original]},{maxAttempts});
const request=(i,time="09:00",key="request_"+String(i).padStart(8,"0"))=>
 ({ownerId:"owner1",key,secret,intent:{...intent,time}});
async function main(){
 const s=make(),before=s.read();
 assert.deepEqual(await s.reserve(request(0)),DISABLED);
 assert.deepEqual(s.read(),before);
 const requests=Array.from({length:50},(_,i)=>request(i));
 const order=Array.from({length:50},(_,i)=>49-i);
 const out=s.run(requests,{order,dropAcknowledgements:[49]});
 assert.equal(out.status,"STRESS_SIMULATION_COMPLETE");
 assert.equal(out.results.length,50);
 assert.equal(out.results.filter(r=>r.status==="STRESS_ACKNOWLEDGEMENT_LOST").length,1);
 assert.equal(out.results.filter(r=>r.status==="EXISTING_BOOKING_CONFLICT").length,49);
 assert.equal(out.results[49].attempts,1,"first winner commits against initial snapshot");
 assert.equal(s.read().bookings.length,2,"50 competing devices must not double-book");
 assert.equal(s.read().requestCount,1);
 assert.deepEqual(s.read().bookings[0],original);
 const replay=s.run([request(49)]);
 assert.equal(replay.results[0].status,"SIMULATION_PREVIOUS_OUTCOME_FOUND");
 assert.equal(s.read().bookings.length,2);
 const mixed=make();
 const m=mixed.run([request(1,"09:00"),request(2,"09:15"),request(3,"11:00"),
  request(4,"11:30"),request(5,"10:00")]);
 assert.deepEqual(m.results.map(r=>r.status),[
  "SIMULATION_ATOMIC_COMMIT_ONLY","EXISTING_BOOKING_CONFLICT",
  "SIMULATION_ATOMIC_COMMIT_ONLY","SIMULATION_ATOMIC_COMMIT_ONLY",
  "EXISTING_BOOKING_CONFLICT"]);
 assert.equal(mixed.read().bookings.length,4);
 const limited=make(1).run([request(1),request(2)]);
 assert.equal(limited.results[0].status,"SIMULATION_ATOMIC_COMMIT_ONLY");
 assert.equal(limited.results[1].status,"SIMULATION_RETRY_REQUIRED");
 const invalid=make();
 assert.equal(invalid.run([request(1),request(2)],{order:[0,0]}).status,"STRESS_INVALID");
 assert.deepEqual(invalid.read(),before);
 assert.throws(()=>make(0),TypeError);
 const entry=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
 const source=fs.readFileSync(path.resolve(__dirname,"../functions/phase157TransactionRetryStressSimulation.js"),"utf8");
 assert.ok(!entry.includes("phase157TransactionRetryStressSimulation"));
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction("));
 console.log("PASS Phase 15.7 50-device contention, bounded retries, conflict isolation, lost acknowledgement, preserved appointments");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
