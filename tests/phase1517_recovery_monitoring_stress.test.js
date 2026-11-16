"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createRecoveryMonitoringStressPreparation}=require("../functions/phase1517RecoveryMonitoringStress");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const input={ownerId:"salonA",key:"request_12345",secret:"phase1517-secret-at-least-32-bytes-long",
 intent:{serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00",customerName:"PRIVATE_PERSON"}};
const context={trustedServerContext:true,emailVerified:true,ownerId:"salonA"};
async function main(){
 let now=1800000000000,stored=null,bookingWrites=0,reads=0,deliveryAttempts=0,storageDown=false;
 const delivered=[];
 const store={async readPair(){reads++;throw Error("PRIVATE_OFFLINE");},
  set(){bookingWrites++;throw Error("forbidden");},delete(){bookingWrites++;throw Error("forbidden");}};
 const persistence={async load(){if(storageDown)throw Error("storage down");return structuredClone(stored);},
  async save(snapshot){if(storageDown)throw Error("storage down");stored=structuredClone(snapshot);}};
 const options={clock:()=>now,windowMs:1000,
  thresholds:{access_denied:3,integrity_alert:2,uncertain:2},
  emitAlert:async event=>{deliveryAttempts++;if(deliveryAttempts===1)throw Error("simulated alert transport failure");delivered.push(event);}};
 let api=createRecoveryMonitoringStressPreparation(store,persistence,options);
 assert.deepEqual(await api.reserve(input),DISABLED);
 const requests=Array.from({length:500},()=>({input,context:{...context,ownerId:"salonB"}}));
 const before=reads;
 const result=await api.inspectBatch(requests);
 assert.equal(result.status,"MONITORING_STRESS_COMPLETE");
 assert.equal(result.outcomes.length,500);
 assert.ok(result.outcomes.every(x=>x.status==="OWNERSHIP_FORBIDDEN"
  &&x.acceptingBookings===false&&x.reservationCreated===false));
 assert.equal(reads,before,"cross-owner attempts must not read booking data");
 assert.equal(stored.events.access_denied.length,500,"no lost monitoring events");
 assert.equal(deliveryAttempts,1,"one suppressed alert despite transport failure");
 assert.equal(delivered.length,0);
 api=createRecoveryMonitoringStressPreparation(store,persistence,options);
 await api.inspectBatch(requests.slice(0,20));
 assert.equal(deliveryAttempts,1,"restart retains alert suppression after delivery failure");
 now+=1001;
 api=createRecoveryMonitoringStressPreparation(store,persistence,options);
 await api.inspectBatch(requests.slice(0,3));
 assert.equal(deliveryAttempts,2,"next window can deliver a new alert");
 assert.equal(delivered.length,1);
 storageDown=true;
 api=createRecoveryMonitoringStressPreparation(store,persistence,options);
 const failed=await api.inspectBatch(requests.slice(0,20));
 assert.ok(failed.outcomes.every(x=>x.status==="MONITORING_UNAVAILABLE"));
 assert.equal(deliveryAttempts,2,"no alerts on failed storage");
 storageDown=false;
 assert.equal((await api.inspectBatch([])).status,"MONITORING_STRESS_INVALID");
 assert.equal((await api.inspectBatch(Array.from({length:501},()=>requests[0]))).status,"MONITORING_STRESS_INVALID");
 const serialized=JSON.stringify({stored,delivered});
 for(const value of ["salonA","salonB","request_12345","PRIVATE_PERSON",input.secret,"PRIVATE_OFFLINE"])
  assert.ok(!serialized.includes(value),"sensitive value leaked");
 assert.equal(bookingWrites,0);
 const entry=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
 const source=fs.readFileSync(path.resolve(__dirname,"../functions/phase1517RecoveryMonitoringStress.js"),"utf8");
 assert.ok(!entry.includes("phase1517RecoveryMonitoringStress"));
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction("));
 console.log("PASS Phase 15.17 500 concurrent events, restart, alert outage, suppression, storage outage, privacy, disabled bookings");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
