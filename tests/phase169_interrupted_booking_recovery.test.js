"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createInterruptedBookingRehearsal}=require("../functions/phase169InterruptedBookingRehearsal");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const secret="phase169-test-secret-for-server-only-simulations";
const catalogue={services:[{id:"cut",published:true,durationMinutes:30}],
 staff:[{id:"barber",active:true,serviceIds:["cut"]}]};
const staffSchedules=[{id:"barber",weeklySchedule:{friday:{open:"09:00",close:"17:00"}},
 weeklyBreaks:[],timeOff:[]}];
const initialBookings=[{staffId:"barber",date:"2026-11-20",time:"13:00",
 durationMinutes:30,status:"confirmed"}];
const intent={serviceId:"cut",staffId:"barber",date:"2026-11-20",time:"10:00"};
const input={deviceId:"phoneA",ownerId:"salonA",key:"request_12345",intent};
async function main(){
 const original=JSON.stringify(initialBookings);
 const engine=createInterruptedBookingRehearsal({secret,catalogue,staffSchedules,initialBookings});
 assert.equal((await engine.request(input,{failure:"before"})).status,
  "INTERRUPTED_BEFORE_COMMIT_UNKNOWN");
 assert.equal(engine.inspect("salonA").newSimulatedBookings,0);
 assert.equal(engine.recover(input).status,"INTERRUPTED_NO_COMMIT_PROVEN_ONLY");
 assert.equal((await engine.request(input,{failure:"outage"})).status,
  "INTERRUPTED_BACKEND_UNAVAILABLE");
 assert.equal(engine.inspect("salonA").newSimulatedBookings,0);
 assert.equal((await engine.request(input,{failure:"after"})).status,
  "INTERRUPTED_RESPONSE_LOST_UNKNOWN");
 assert.equal(engine.inspect("salonA").newSimulatedBookings,1);
 assert.equal(engine.recover(input).status,"INTERRUPTED_PREVIOUS_COMMIT_FOUND");
 assert.equal((await engine.request({...input,deviceId:"phoneB"})).status,
  "INTERRUPTED_PREVIOUS_COMMIT_FOUND");
 assert.equal((await engine.request({...input,intent:{...intent,time:"11:00"}})).status,
  "INTERRUPTED_KEY_REUSED");
 assert.equal(engine.inspect("salonA").newSimulatedBookings,1);
 const burst=await Promise.all(Array.from({length:100},(_,i)=>engine.request({
  ...input,deviceId:"phone"+i,key:"unique_retry_"+String(i).padStart(5,"0")
 })));
 assert.equal(burst.filter(x=>x.status==="EXISTING_BOOKING_CONFLICT").length,100);
 assert.equal((await engine.request({...input,key:"legacy_key_123",intent:{...intent,time:"13:00"}})).status,
  "EXISTING_BOOKING_CONFLICT");
 assert.equal((await engine.request({...input,key:"other_slot_123",intent:{...intent,time:"10:30"}})).status,
  "INTERRUPTED_COMMIT_SIMULATED");
 assert.equal((await engine.request({...input,key:"bad"})).status,"INTERRUPTED_REQUEST_INVALID");
 assert.equal((await engine.request(input,{failure:"unknown"})).status,
  "INTERRUPTED_FAILURE_MODE_INVALID");
 assert.deepEqual(await engine.reserve(input),DISABLED);
 assert.equal(engine.inspect("salonA").productionWrites,0);
 assert.equal(JSON.stringify(initialBookings),original);
 const root=path.resolve(__dirname,"..");
 const entry=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
 const source=fs.readFileSync(path.join(root,"functions/phase169InterruptedBookingRehearsal.js"),"utf8");
 assert.ok(!entry.includes("phase169InterruptedBookingRehearsal"));
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction("));
 console.log("PASS Phase 16.9 interrupted before/after, lost response, retry, 100 conflicts, legacy fixtures and disabled production");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
