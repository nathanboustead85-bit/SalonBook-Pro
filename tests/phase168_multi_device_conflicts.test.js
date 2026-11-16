"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createMultiDeviceConflictRehearsal}=require("../functions/phase168MultiDeviceConflictRehearsal");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const secret="phase168-server-only-test-secret-longer-than-32";
const catalogue={services:[{id:"cut",published:true,durationMinutes:30}],
 staff:[{id:"barber",active:true,serviceIds:["cut"]}]};
const staffSchedules=[{id:"barber",weeklySchedule:{friday:{open:"09:00",close:"17:00"}},
 weeklyBreaks:[],timeOff:[]}];
const intent={serviceId:"cut",staffId:"barber",date:"2026-11-20",time:"10:00"};
const initialBookings=[{staffId:"barber",date:"2026-11-20",time:"13:00",
 durationMinutes:30,status:"confirmed"}];
const req=(deviceId,key,time="10:00",ownerId="salonA")=>({
 deviceId,ownerId,key,intent:{...intent,time}});
async function main(){
 const originals=JSON.stringify(initialBookings);
 const shared=createMultiDeviceConflictRehearsal({secret,catalogue,staffSchedules,initialBookings});
 const attempts=await Promise.all(Array.from({length:100},(_,i)=>
  shared.attempt(req("device_"+(i%10),"request_key_"+String(i).padStart(5,"0")))));
 assert.equal(attempts.filter(x=>x.status==="DEVICE_SHARED_COMMIT_SIMULATED").length,1);
 assert.equal(attempts.filter(x=>x.status==="EXISTING_BOOKING_CONFLICT").length,99);
 assert.equal(shared.inspect("salonA").newSimulatedBookings,1);
 assert.equal(shared.inspect("salonA").requestMarkers,1);
 assert.equal((await shared.attempt(req("device_other","request_key_00000"))).status,
  "DEVICE_IDEMPOTENT_REPLAY");
 assert.equal((await shared.attempt(req("device_other","request_key_00000","11:00"))).status,
  "DEVICE_IDEMPOTENCY_MISMATCH");
 assert.equal((await shared.attempt(req("device_other","request_key_new_123","10:15"))).status,
  "EXISTING_BOOKING_CONFLICT");
 assert.equal((await shared.attempt(req("device_other","request_key_later","10:30"))).status,
  "DEVICE_SHARED_COMMIT_SIMULATED");
 assert.equal((await shared.attempt(req("device_other","request_key_legacy","13:00"))).status,
  "EXISTING_BOOKING_CONFLICT");
 assert.equal((await shared.attempt(req("device_other","request_key_owner","10:00","salonB"))).status,
  "DEVICE_SHARED_COMMIT_SIMULATED");
 assert.equal(shared.inspect("salonA").newSimulatedBookings,2);
 assert.equal(shared.inspect("salonB").newSimulatedBookings,1);
 assert.equal((await shared.attempt(req("bad device","request_key_invalid"))).status,"DEVICE_ID_INVALID");
 assert.deepEqual(await shared.reserve(req("device_1","request_key_disabled")),DISABLED);
 assert.equal(shared.inspect("salonA").productionWrites,0);
 assert.equal(JSON.stringify(initialBookings),originals);
 const root=path.resolve(__dirname,"..");
 const entry=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
 const source=fs.readFileSync(path.join(root,"functions/phase168MultiDeviceConflictRehearsal.js"),"utf8");
 assert.ok(!entry.includes("phase168MultiDeviceConflictRehearsal"));
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction("));
 console.log("PASS Phase 16.8 100 attempts from 10 devices, overlapping and legacy conflicts, replay, owner isolation and no production writes");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
