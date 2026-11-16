"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createAtomicIdempotencySafeguards,createIsolatedAtomicRehearsal}=
 require("../functions/phase165AtomicIdempotencySafeguards");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const secret="phase165-server-only-test-secret-32-bytes-min";
const intent={serviceId:"cut",staffId:"barber",date:"2026-11-20",time:"10:00"};
const input={ownerId:"salonA",key:"request_12345",intent};
const catalogue={services:[{id:"cut",published:true,durationMinutes:30}],
 staff:[{id:"barber",active:true,serviceIds:["cut"]}]};
const staffSchedules=[{id:"barber",weeklySchedule:{friday:{open:"09:00",close:"17:00"}},
 weeklyBreaks:[],timeOff:[]}];
async function main(){
 const safeguards=createAtomicIdempotencySafeguards({secret});
 const a=safeguards.plan(input),b=safeguards.plan(input);
 assert.equal(a.status,"ATOMIC_IDEMPOTENCY_PLAN_ONLY");
 assert.equal(a.requestId,b.requestId);
 assert.equal(a.fingerprint,b.fingerprint);
 assert.equal(a.requiresSingleAtomicCommit,true);
 assert.equal(a.requiresSharedStaffDateGuard,true);
 assert.notEqual(a.requestId,safeguards.plan({...input,ownerId:"salonB"}).requestId);
 assert.notEqual(a.fingerprint,safeguards.plan({...input,intent:{...intent,time:"11:00"}}).fingerprint);
 assert.equal(safeguards.plan({...input,key:"bad"}).status,"ATOMIC_PLAN_INVALID");
 assert.deepEqual(await safeguards.reserve(input),DISABLED);
 const rehearsal=createIsolatedAtomicRehearsal({secret,catalogue,staffSchedules});
 const simultaneous=await Promise.all(Array.from({length:100},(_,i)=>rehearsal.attempt({
  ...input,key:"unique_key_"+String(i).padStart(5,"0")})));
 assert.equal(simultaneous.filter(x=>x.status==="REHEARSAL_ATOMIC_COMMIT_SIMULATED").length,1);
 assert.equal(simultaneous.filter(x=>x.status==="EXISTING_BOOKING_CONFLICT").length,99);
 assert.equal(rehearsal.inspect().simulatedBookings,1);
 assert.equal(rehearsal.inspect().requestMarkers,1);
 const replay=await rehearsal.attempt({...input,key:"unique_key_00000"});
 assert.equal(replay.status,"REHEARSAL_IDEMPOTENT_REPLAY");
 const mismatch=await rehearsal.attempt({...input,key:"unique_key_00000",intent:{...intent,time:"11:00"}});
 assert.equal(mismatch.status,"REHEARSAL_IDEMPOTENCY_MISMATCH");
 assert.equal(rehearsal.inspect().simulatedBookings,1);
 const originals=[{id:"original1"},{id:"original2"}],before=JSON.stringify(originals);
 assert.deepEqual(await rehearsal.reserve(input),DISABLED);
 assert.equal(JSON.stringify(originals),before);
 const root=path.resolve(__dirname,"..");
 const entry=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
 const source=fs.readFileSync(path.join(root,"functions/phase165AtomicIdempotencySafeguards.js"),"utf8");
 assert.ok(!entry.includes("phase165AtomicIdempotencySafeguards"));
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction(")
  &&!source.includes("tx.create(")&&!source.includes("tx.set("));
 assert.equal(rehearsal.inspect().productionWrites,0);
 console.log("PASS Phase 16.5 100 parallel requests, one simulated winner, idempotent replay, mismatch and disabled production");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
