"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createRestartRecoveryPreparation}=require("../functions/phase159RestartRecoveryPreparation");
const {prepareBookingStoragePlan}=require("../functions/phase151BookingInfrastructurePreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const input={ownerId:"owner1",key:"request_12345",secret:"phase159-test-secret-longer-than-32-bytes",
 intent:{serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"}};
const plan=prepareBookingStoragePlan(input),now=1800000000000;
async function main(){
 const records=new Map();
 let reads=0,writes=0,offline=false;
 const store={async get(key){reads++;if(offline)throw Error("network");return records.get(key);},
  set(){writes++;throw Error("forbidden");}};
 const create=()=>createRestartRecoveryPreparation(store,{clock:()=>now});
 assert.deepEqual(await create().reserve(input),DISABLED);
 assert.equal((await create().inspect(input)).status,"RESTART_OUTCOME_UNCERTAIN");
 // Fixture provisioning simulates an earlier completed transaction; the API never writes.
 records.set(plan.recoveryDocumentPath,{fingerprint:plan.fingerprint,
  state:"COMMITTED_SIMULATION",createdAt:now-1000});
 for(let i=0;i<40;i++){
  const restarted=create();
  const result=await restarted.inspect(input);
  assert.equal(result.status,"RESTART_SIMULATED_OUTCOME_RECOVERED");
  assert.equal(result.replayed,true);
  assert.equal(result.acceptingBookings,false);
  assert.equal(result.reservationCreated,false);
 }
 assert.equal((await create().inspect({...input,intent:{...input.intent,time:"11:00"}})).status,
  "RESTART_KEY_REUSED_OR_CORRUPT");
 offline=true;
 assert.equal((await create().inspect(input)).status,"RESTART_OUTCOME_UNCERTAIN");
 offline=false;
 records.set(plan.recoveryDocumentPath,{fingerprint:plan.fingerprint,state:"PENDING",createdAt:now-1000});
 assert.equal((await create().inspect(input)).status,"RESTART_OUTCOME_UNCERTAIN");
 records.set(plan.recoveryDocumentPath,{fingerprint:plan.fingerprint,state:"COMMITTED_SIMULATION",createdAt:now-8*86400000});
 assert.equal((await create().inspect(input)).status,"RESTART_OUTCOME_UNCERTAIN");
 records.set(plan.recoveryDocumentPath,{fingerprint:"bad",state:"COMMITTED_SIMULATION",createdAt:now-1000});
 assert.equal((await create().inspect(input)).status,"RESTART_OUTCOME_UNCERTAIN");
 assert.equal((await create().inspect({...input,key:"short"})).status,"RESTART_INVALID");
 assert.equal(writes,0);
 assert.ok(reads>=45);
 assert.throws(()=>createRestartRecoveryPreparation({}),TypeError);
 const source=fs.readFileSync(path.resolve(__dirname,"../functions/phase159RestartRecoveryPreparation.js"),"utf8");
 const entry=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
 assert.ok(!entry.includes("phase159RestartRecoveryPreparation"));
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction("));
 console.log("PASS Phase 15.9 40 simulated restarts, durable mock marker reads, expiry, corruption, offline and no writes");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
