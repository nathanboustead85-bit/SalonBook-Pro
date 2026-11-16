"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createRecoveryAuditPreparation}=require("../functions/phase1514RecoveryAuditPreparation");
const {prepareBookingStoragePlan}=require("../functions/phase151BookingInfrastructurePreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const secret="phase1514-secret-at-least-32-bytes-long",now=1800000000000,id="a".repeat(64);
const input={ownerId:"salonA",key:"request_12345",secret,
 intent:{serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00",customerName:"PRIVATE_PERSON"}};
const plan=prepareBookingStoragePlan(input);
const context={trustedServerContext:true,emailVerified:true,ownerId:"salonA"};
const pair={consistentSnapshot:true,
 marker:{fingerprint:plan.fingerprint,state:"COMMITTED_SIMULATION",createdAt:now-1000,reservationId:id},
 reservation:{id,requestId:plan.requestId,fingerprint:plan.fingerprint,
  state:"COMMITTED_SIMULATION",ownerId:"salonA"}};
async function main(){
 let writes=0,reads=0,offline=false;
 const events=[];
 const store={async readPair(){reads++;if(offline)throw Error("PRIVATE_BACKEND_FAILURE");return structuredClone(pair);},
  set(){writes++;throw Error("write");},delete(){writes++;throw Error("delete");}};
 const api=createRecoveryAuditPreparation(store,{clock:()=>now,emit:async e=>events.push(e)});
 assert.deepEqual(await api.reserve(input),DISABLED);
 assert.equal((await api.inspect(input,context)).status,"OWNERSHIP_SIMULATED_PAIR_VERIFIED");
 const before=reads;
 assert.equal((await api.inspect(input,{...context,ownerId:"salonB"})).status,"OWNERSHIP_FORBIDDEN");
 assert.equal((await api.inspect(input,{...context,emailVerified:false})).status,"OWNERSHIP_UNAUTHORIZED");
 assert.equal(reads,before);
 assert.equal((await api.inspect({...input,intent:{...input.intent,time:"11:00"}},context)).status,
  "OWNERSHIP_KEY_REUSED_OR_CORRUPT");
 offline=true;
 assert.equal((await api.inspect(input,context)).status,"OWNERSHIP_UNCERTAIN");
 offline=false;
 assert.deepEqual(api.summary(),{recovered:1,access_denied:2,integrity_alert:1,uncertain:1});
 assert.equal(events.length,5);
 const allowed=["type","category","status","acceptingBookings","reservationCreated"];
 for(const event of events){
  assert.deepEqual(Object.keys(event).sort(),allowed.sort());
  assert.equal(event.acceptingBookings,false);
  assert.equal(event.reservationCreated,false);
 }
 const serialized=JSON.stringify(events);
 for(const sensitive of ["salonA","salonB","request_12345","PRIVATE_PERSON",
  "PRIVATE_BACKEND_FAILURE",secret,plan.fingerprint,plan.requestId])
  assert.ok(!serialized.includes(sensitive),"leaked "+sensitive);
 const failedSink=createRecoveryAuditPreparation(store,{clock:()=>now,emit:async()=>{throw Error("sink unavailable");}});
 assert.equal((await failedSink.inspect(input,context)).status,"OWNERSHIP_SIMULATED_PAIR_VERIFIED");
 assert.equal(writes,0);
 assert.throws(()=>createRecoveryAuditPreparation(store,{emit:null}),TypeError);
 const source=fs.readFileSync(path.resolve(__dirname,"../functions/phase1514RecoveryAuditPreparation.js"),"utf8");
 const entry=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
 assert.ok(!entry.includes("phase1514RecoveryAuditPreparation"));
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction("));
 console.log("PASS Phase 15.14 privacy-minimal audit events, security categories, no PII, sink failure safety, disabled bookings");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
