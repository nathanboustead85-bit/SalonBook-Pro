"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createRecoveryFailureInjection}=require("../functions/phase1513RecoveryFailureInjection");
const {prepareBookingStoragePlan}=require("../functions/phase151BookingInfrastructurePreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const input={ownerId:"salonA",key:"request_12345",secret:"phase1513-test-secret-at-least-32-bytes",
 intent:{serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"}};
const plan=prepareBookingStoragePlan(input),now=1800000000000,id="a".repeat(64);
const context={trustedServerContext:true,emailVerified:true,ownerId:"salonA"};
const originalBookings=[{id:"original1",date:"2026-11-20",time:"10:00"},
 {id:"original2",date:"2026-11-20",time:"11:00"}];
const pair={consistentSnapshot:true,
 marker:{fingerprint:plan.fingerprint,state:"COMMITTED_SIMULATION",createdAt:now-1000,reservationId:id},
 reservation:{id,requestId:plan.requestId,fingerprint:plan.fingerprint,
  state:"COMMITTED_SIMULATION",ownerId:"salonA"}};
async function main(){
 let reads=0,writes=0;
 const store={async readPair(markerPath,collectionPath){
  reads++;
  assert.equal(markerPath,plan.recoveryDocumentPath);
  assert.equal(collectionPath,plan.bookingCollectionPath);
  return structuredClone(pair);
 },set(){writes++;throw Error("write forbidden");},delete(){writes++;throw Error("delete forbidden");}};
 const original=structuredClone(originalBookings);
 const healthy=createRecoveryFailureInjection(store,{clock:()=>now});
 assert.deepEqual(await healthy.reserve(input),DISABLED);
 assert.equal((await healthy.inspect(input,context)).status,"OWNERSHIP_SIMULATED_PAIR_VERIFIED");
 for(const fault of ["offline","timeout","interrupted","malformed","torn","stale","storage-error"]){
  const recovery=createRecoveryFailureInjection(store,{fault,clock:()=>now});
  const results=await Promise.all(Array.from({length:25},()=>recovery.inspect(input,context)));
  assert.ok(results.every(x=>(x.status==="OWNERSHIP_UNCERTAIN"
   ||(fault==="malformed"&&x.status==="OWNERSHIP_KEY_REUSED_OR_CORRUPT"))
   &&x.acceptingBookings===false&&x.reservationCreated===false),fault);
  assert.equal(recovery.readCount(),25);
  assert.deepEqual(await recovery.reserve(input),DISABLED);
 }
 const blocked=createRecoveryFailureInjection(store,{fault:"offline",clock:()=>now});
 const before=blocked.readCount();
 assert.equal((await blocked.inspect(input,{...context,ownerId:"salonB"})).status,"OWNERSHIP_FORBIDDEN");
 assert.equal((await blocked.inspect(input,{...context,emailVerified:false})).status,"OWNERSHIP_UNAUTHORIZED");
 assert.equal(blocked.readCount(),before,"unauthorized requests must never touch storage");
 assert.equal(writes,0);
 assert.deepEqual(originalBookings,original);
 assert.deepEqual(pair.marker,{fingerprint:plan.fingerprint,state:"COMMITTED_SIMULATION",
  createdAt:now-1000,reservationId:id});
 assert.throws(()=>createRecoveryFailureInjection({},{}),TypeError);
 assert.throws(()=>createRecoveryFailureInjection(store,{fault:"unknown"}),TypeError);
 const entry=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
 const source=fs.readFileSync(path.resolve(__dirname,"../functions/phase1513RecoveryFailureInjection.js"),"utf8");
 assert.ok(!entry.includes("phase1513RecoveryFailureInjection"));
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction("));
 console.log("PASS Phase 15.13 175 injected recovery failures, fail-closed uncertainty, owner isolation, no writes");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
