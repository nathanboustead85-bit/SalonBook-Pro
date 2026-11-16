"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createMultiDeviceRecoverySimulation}=require("../functions/phase155MultiDeviceRecoverySimulation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const catalogue={services:[{id:"cut",published:true,durationMinutes:30}],
 staff:[{id:"kody",active:true,serviceIds:["cut"]}]};
const schedules=[{id:"kody",weeklySchedule:{friday:{open:"09:00",close:"17:00"}},weeklyBreaks:[],timeOff:[]}];
const original={staffId:"kody",date:"2026-11-20",time:"10:00",durationMinutes:30,status:"confirmed"};
const intent={serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"};
const input={ownerId:"owner1",key:"request_12345",secret:"phase155-secret-longer-than-32-bytes",intent};
const make=()=>createMultiDeviceRecoverySimulation({catalogue,schedules,bookings:[original]});
async function main(){
 const s=make(),a=s.createDevice(),b=s.createDevice(),initial=s.read();
 assert.deepEqual(await a.reserve(input),DISABLED);
 assert.deepEqual(s.read(),initial);
 assert.equal(a.inspect(input).status,"MULTI_DEVICE_NOT_FOUND_RETRY_NOT_AUTHORIZED");
 assert.equal(a.inspect(input,{offline:true}).status,"MULTI_DEVICE_OUTCOME_UNCERTAIN");
 const pa=a.prepare(input);
 const pb=b.prepare({...input,key:"request_22222",intent:{...intent,time:"09:15"}});
 assert.equal(a.commit(pa,{simulateFailure:true}).status,"SIMULATION_ATOMIC_ROLLBACK");
 assert.deepEqual(s.read(),initial);
 assert.equal(s.markerCount(),0);
 assert.equal(a.commit(pa,{ackLost:true}).status,"MULTI_DEVICE_OUTCOME_UNCERTAIN");
 assert.equal(s.read().bookings.length,2);
 assert.equal(s.markerCount(),1);
 // New device instance represents restart and sees the shared simulated outcome.
 const restarted=s.createDevice();
 assert.equal(restarted.inspect(input).status,"MULTI_DEVICE_SIMULATED_OUTCOME_RECOVERED");
 assert.equal(restarted.inspect(input).replayed,true);
 assert.equal(b.submit(input).status,"SIMULATION_PREVIOUS_OUTCOME_FOUND");
 assert.equal(s.read().bookings.length,2,"retry must not create a duplicate");
 assert.equal(b.commit(pb).status,"SIMULATION_RETRY_REQUIRED");
 assert.equal(b.submit({...input,key:"request_33333",intent:{...intent,time:"09:15"}}).status,
  "EXISTING_BOOKING_CONFLICT");
 assert.equal(restarted.inspect({...input,intent:{...intent,time:"11:00"}}).status,"MULTI_DEVICE_KEY_REUSED");
 assert.equal(restarted.inspect({...input,ownerId:"owner2"}).status,"MULTI_DEVICE_NOT_FOUND_RETRY_NOT_AUTHORIZED");
 assert.equal(restarted.inspect({...input,key:"short"}).status,"MULTI_DEVICE_INVALID");
 assert.equal(restarted.inspect(input,{offline:true}).status,"MULTI_DEVICE_OUTCOME_UNCERTAIN");
 assert.equal(s.read().bookings.length,2);
 assert.deepEqual(s.read().bookings[0],original);
 const offline=make(),device=offline.createDevice();
 assert.equal(device.submit(input,{offline:true}).status,"MULTI_DEVICE_OUTCOME_UNCERTAIN");
 assert.equal(offline.markerCount(),0);
 assert.equal(offline.read().bookings.length,1);
 const entry=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
 assert.ok(!entry.includes("phase155MultiDeviceRecoverySimulation"));
 const source=fs.readFileSync(path.resolve(__dirname,"../functions/phase155MultiDeviceRecoverySimulation.js"),"utf8");
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction("));
 console.log("PASS Phase 15.5 multi-device concurrency, lost acknowledgements, retry, recovery and disabled bookings");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
