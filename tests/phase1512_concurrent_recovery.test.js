"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createConcurrentRecoveryPreparation}=require("../functions/phase1512ConcurrentRecoveryPreparation");
const {prepareBookingStoragePlan}=require("../functions/phase151BookingInfrastructurePreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const secret="phase1512-secret-longer-than-32-bytes",now=1800000000000,id="a".repeat(64);
const intent={serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"};
const input=ownerId=>({ownerId,key:"request_12345",secret,intent});
const ctx=ownerId=>({trustedServerContext:true,emailVerified:true,ownerId});
const planA=prepareBookingStoragePlan(input("salonA"));
const planB=prepareBookingStoragePlan(input("salonB"));
const pair=p=>({consistentSnapshot:true,
 marker:{fingerprint:p.fingerprint,state:"COMMITTED_SIMULATION",createdAt:now-1000,reservationId:id},
 reservation:{id,requestId:p.requestId,fingerprint:p.fingerprint,state:"COMMITTED_SIMULATION",ownerId:p.ownerId}});
async function main(){
 let reads=0,writes=0,offline=false;
 const records=new Map([[planA.recoveryDocumentPath,pair(planA)],
  [planB.recoveryDocumentPath,pair(planB)]]);
 const store={async readPair(markerPath,collectionPath){
  reads++;
  await Promise.resolve(); // Force interleaving at the asynchronous read boundary.
  if(offline)throw Error("offline");
  const owner=markerPath.split("/")[1];
  assert.equal(collectionPath,"users/"+owner+"/customerBookingReservations");
  return records.get(markerPath);
 },set(){writes++;throw Error("forbidden");},delete(){writes++;throw Error("forbidden");}};
 const api=createConcurrentRecoveryPreparation(store,{clock:()=>now});
 assert.deepEqual(await api.reserve(input("salonA")),DISABLED);
 const requests=Array.from({length:100},(_,i)=>i%4===0
  ?{input:input("salonA"),context:ctx("salonB")}
  :i%4===1?{input:input("salonB"),context:ctx("salonB")}
  :i%4===2?{input:input("salonA"),context:ctx("salonA")}
  :{input:{...input("salonA"),intent:{...intent,time:"11:00"}},context:ctx("salonA")});
 const before=reads;
 const result=await api.inspectBatch(requests);
 assert.equal(result.status,"CONCURRENCY_INSPECTIONS_COMPLETE");
 assert.equal(result.outcomes.length,100);
 const expected=["OWNERSHIP_FORBIDDEN","OWNERSHIP_SIMULATED_PAIR_VERIFIED",
  "OWNERSHIP_SIMULATED_PAIR_VERIFIED","OWNERSHIP_KEY_REUSED_OR_CORRUPT"];
 result.outcomes.forEach((x,i)=>{
  assert.equal(x.status,expected[i%4]);
  assert.equal(x.acceptingBookings,false);
  assert.equal(x.reservationCreated,false);
 });
 assert.equal(reads-before,75,"cross-owner attempts cannot read storage");
 assert.equal(writes,0);
 assert.deepEqual(records.get(planA.recoveryDocumentPath),pair(planA));
 assert.deepEqual(records.get(planB.recoveryDocumentPath),pair(planB));
 offline=true;
 const failed=await api.inspectBatch([{input:input("salonA"),context:ctx("salonA")}]);
 assert.equal(failed.outcomes[0].status,"OWNERSHIP_UNCERTAIN");
 offline=false;
 records.set(planA.recoveryDocumentPath,{...pair(planA),reservation:{...pair(planA).reservation,ownerId:"salonB"}});
 const corrupt=await api.inspectBatch(Array.from({length:30},()=>({input:input("salonA"),context:ctx("salonA")})));
 assert.ok(corrupt.outcomes.every(x=>x.status==="OWNERSHIP_UNCERTAIN"));
 assert.equal(writes,0);
 assert.equal((await api.inspectBatch([])).status,"CONCURRENCY_INVALID");
 assert.equal((await api.inspectBatch(Array.from({length:101},()=>requests[0]))).status,"CONCURRENCY_INVALID");
 assert.equal((await api.inspectBatch(requests,{limit:0})).status,"CONCURRENCY_INVALID");
 const entry=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
 const source=fs.readFileSync(path.resolve(__dirname,"../functions/phase1512ConcurrentRecoveryPreparation.js"),"utf8");
 assert.ok(!entry.includes("phase1512ConcurrentRecoveryPreparation"));
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction("));
 console.log("PASS Phase 15.12 100 parallel mock recovery inspections, cross-tenant denial, corruption, offline, no writes");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
