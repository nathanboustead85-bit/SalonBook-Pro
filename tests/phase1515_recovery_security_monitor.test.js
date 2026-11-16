"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createRecoverySecurityMonitor}=require("../functions/phase1515RecoverySecurityMonitor");
const {prepareBookingStoragePlan}=require("../functions/phase151BookingInfrastructurePreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const secret="phase1515-secret-at-least-32-bytes-long",id="a".repeat(64);
const input={ownerId:"salonA",key:"request_12345",secret,
 intent:{serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00",customerName:"PRIVATE_PERSON"}};
const plan=prepareBookingStoragePlan(input),ctx={trustedServerContext:true,emailVerified:true,ownerId:"salonA"};
async function main(){
 let now=1800000000000,offline=false,writes=0,reads=0;
 const alerts=[];
 const pair={consistentSnapshot:true,
  marker:{fingerprint:plan.fingerprint,state:"COMMITTED_SIMULATION",createdAt:now-1000,reservationId:id},
  reservation:{id,requestId:plan.requestId,fingerprint:plan.fingerprint,
   state:"COMMITTED_SIMULATION",ownerId:"salonA"}};
 const store={async readPair(){reads++;if(offline)throw Error("PRIVATE_ERROR");return structuredClone(pair);},
  set(){writes++;throw Error("write");},delete(){writes++;throw Error("write");}};
 const monitor=createRecoverySecurityMonitor(store,{clock:()=>now,windowMs:1000,
  thresholds:{access_denied:3,integrity_alert:2,uncertain:2},emitAlert:async e=>alerts.push(e)});
 assert.deepEqual(await monitor.reserve(input),DISABLED);
 const before=reads;
 for(let i=0;i<5;i++){
  const r=await monitor.inspect(input,{...ctx,ownerId:"salonB"});
  assert.equal(r.status,"OWNERSHIP_FORBIDDEN");
  assert.equal(r.acceptingBookings,false);
  assert.equal(r.reservationCreated,false);
 }
 assert.equal(reads,before);
 assert.equal(alerts.length,1,"only one alert for sustained threshold");
 assert.deepEqual(alerts[0],{type:"recovery_security_threshold",category:"access_denied",count:3,windowMs:1000});
 for(let i=0;i<2;i++){
  const r=await monitor.inspect({...input,intent:{...input.intent,time:"11:00"}},ctx);
  assert.equal(r.status,"OWNERSHIP_KEY_REUSED_OR_CORRUPT");
 }
 assert.equal(alerts.length,2);
 offline=true;
 for(let i=0;i<2;i++)assert.equal((await monitor.inspect(input,ctx)).status,"OWNERSHIP_UNCERTAIN");
 offline=false;
 assert.equal(alerts.length,3);
 now+=1001;
 assert.equal((await monitor.inspect(input,{...ctx,ownerId:"salonB"})).status,"OWNERSHIP_FORBIDDEN");
 assert.equal(alerts.length,3,"new window below threshold");
 for(let i=0;i<2;i++)await monitor.inspect(input,{...ctx,ownerId:"salonB"});
 assert.equal(alerts.length,4,"threshold re-arms in next window");
 assert.equal((await monitor.inspect(input,ctx)).status,"OWNERSHIP_SIMULATED_PAIR_VERIFIED");
 assert.equal(alerts.length,4,"successful recovery does not trigger security alert");
 const serialized=JSON.stringify(monitor.summary());
 for(const privateValue of ["salonA","salonB","request_12345","PRIVATE_PERSON",
  "PRIVATE_ERROR",secret,plan.fingerprint,plan.requestId])
  assert.ok(!serialized.includes(privateValue),"leak "+privateValue);
 assert.equal(writes,0);
 const broken=createRecoverySecurityMonitor(store,{clock:()=>now,thresholds:{access_denied:1,integrity_alert:1,uncertain:1},
  emitAlert:async()=>{throw Error("alert sink offline");}});
 assert.equal((await broken.inspect(input,{...ctx,ownerId:"salonB"})).status,"OWNERSHIP_FORBIDDEN");
 assert.equal(broken.summary().alerts.length,1);
 assert.throws(()=>createRecoverySecurityMonitor(store,{windowMs:0}),TypeError);
 assert.throws(()=>createRecoverySecurityMonitor(store,{thresholds:{access_denied:0,integrity_alert:2,uncertain:2}}),TypeError);
 const entry=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
 const source=fs.readFileSync(path.resolve(__dirname,"../functions/phase1515RecoverySecurityMonitor.js"),"utf8");
 assert.ok(!entry.includes("phase1515RecoverySecurityMonitor"));
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction("));
 console.log("PASS Phase 15.15 alert thresholds, suppression, window reset, privacy, failed sinks, disabled bookings");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
