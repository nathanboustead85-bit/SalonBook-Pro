"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createRecoveryOwnershipIsolation}=require("../functions/phase1511RecoveryOwnershipIsolation");
const {prepareBookingStoragePlan}=require("../functions/phase151BookingInfrastructurePreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const secret="phase1511-secret-at-least-32-bytes-long",now=1800000000000;
const intent={serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"};
const input={ownerId:"salonA",key:"request_12345",secret,intent};
const plan=prepareBookingStoragePlan(input);
const ctx=ownerId=>({trustedServerContext:true,emailVerified:true,ownerId});
const id="a".repeat(64);
function pair(p=plan){return {consistentSnapshot:true,
 marker:{fingerprint:p.fingerprint,state:"COMMITTED_SIMULATION",createdAt:now-1000,reservationId:id},
 reservation:{id,requestId:p.requestId,fingerprint:p.fingerprint,state:"COMMITTED_SIMULATION",ownerId:p.ownerId}};}
async function main(){
 let reads=0,writes=0,offline=false;
 const records=new Map([[plan.recoveryDocumentPath,pair()]]);
 const store={async readPair(markerPath,collectionPath){
  reads++;
  if(offline)throw Error("offline");
  assert.ok(markerPath.startsWith("users/"));
  assert.ok(collectionPath.startsWith("users/"));
  return records.get(markerPath);
 },set(){writes++;throw Error("write");},delete(){writes++;throw Error("write");}};
 const api=createRecoveryOwnershipIsolation(store,{clock:()=>now});
 assert.deepEqual(await api.reserve(input),DISABLED);
 assert.equal((await api.inspect(input,ctx("salonA"))).status,"OWNERSHIP_SIMULATED_PAIR_VERIFIED");
 const before=reads;
 for(const context of [undefined,{},ctx("salonB"),{...ctx("salonA"),emailVerified:false},
  {...ctx("salonA"),trustedServerContext:false},{...ctx("salonA"),ownerId:"../salonA"}]){
  const result=await api.inspect(input,context);
  assert.ok(["OWNERSHIP_UNAUTHORIZED","OWNERSHIP_FORBIDDEN"].includes(result.status));
  assert.equal(result.acceptingBookings,false);
  assert.equal(result.reservationCreated,false);
 }
 assert.equal(reads,before,"unauthorized requests must not read storage");
 assert.equal((await api.inspect({...input,ownerId:"salonB"},ctx("salonA"))).status,"OWNERSHIP_FORBIDDEN");
 assert.equal(reads,before);
 assert.equal((await api.inspect({...input,key:"short"},ctx("salonA"))).status,"OWNERSHIP_INVALID");
 assert.equal(reads,before);
 assert.equal((await api.inspect({...input,intent:{...intent,time:"11:00"}},ctx("salonA"))).status,
  "OWNERSHIP_KEY_REUSED_OR_CORRUPT");
 records.set(plan.recoveryDocumentPath,{...pair(),reservation:{...pair().reservation,ownerId:"salonB"}});
 assert.equal((await api.inspect(input,ctx("salonA"))).status,"OWNERSHIP_UNCERTAIN");
 records.set(plan.recoveryDocumentPath,pair());
 offline=true;
 assert.equal((await api.inspect(input,ctx("salonA"))).status,"OWNERSHIP_UNCERTAIN");
 offline=false;
 const other={...input,ownerId:"salonB"};
 const otherPlan=prepareBookingStoragePlan(other);
 records.set(otherPlan.recoveryDocumentPath,pair(otherPlan));
 assert.notEqual(plan.recoveryDocumentPath,otherPlan.recoveryDocumentPath);
 assert.equal((await api.inspect(other,ctx("salonB"))).status,"OWNERSHIP_SIMULATED_PAIR_VERIFIED");
 assert.equal(writes,0);
 assert.throws(()=>createRecoveryOwnershipIsolation({}),TypeError);
 const entry=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
 const source=fs.readFileSync(path.resolve(__dirname,"../functions/phase1511RecoveryOwnershipIsolation.js"),"utf8");
 assert.ok(!entry.includes("phase1511RecoveryOwnershipIsolation"));
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction("));
 console.log("PASS Phase 15.11 owner isolation, denied cross-tenant reads, tampering, verified principal, offline and disabled bookings");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
