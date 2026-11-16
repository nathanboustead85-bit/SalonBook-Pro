"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createPersistentRecoveryMonitor}=require("../functions/phase1516PersistentRecoveryMonitor");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const input={ownerId:"salonA",key:"request_12345",secret:"phase1516-secret-at-least-32-bytes-long",
 intent:{serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00",customerName:"PRIVATE_PERSON"}};
const context={trustedServerContext:true,emailVerified:true,ownerId:"salonA"};
async function main(){
 let now=1800000000000,stored=null,reads=0,writes=0,failSave=false,failLoad=false;
 const alerts=[];
 const bookingStore={async readPair(){reads++;throw Error("offline");},
  set(){writes++;throw Error("forbidden");},delete(){writes++;throw Error("forbidden");}};
 const persistence={async load(){if(failLoad)throw Error("storage offline");return structuredClone(stored);},
  async save(s){if(failSave)throw Error("storage offline");stored=structuredClone(s);}};
 const options={clock:()=>now,windowMs:1000,
  thresholds:{access_denied:3,integrity_alert:2,uncertain:2},emitAlert:async e=>alerts.push(e)};
 let monitor=createPersistentRecoveryMonitor(bookingStore,persistence,options);
 assert.deepEqual(await monitor.reserve(input),DISABLED);
 const before=reads;
 for(let i=0;i<2;i++)assert.equal((await monitor.inspect(input,{...context,ownerId:"salonB"})).status,"OWNERSHIP_FORBIDDEN");
 assert.equal(reads,before,"unauthorized requests never access booking storage");
 assert.equal(alerts.length,0);
 // Simulate process restart: reload persisted counters and trigger threshold once.
 monitor=createPersistentRecoveryMonitor(bookingStore,persistence,options);
 assert.equal((await monitor.inspect(input,{...context,ownerId:"salonB"})).status,"OWNERSHIP_FORBIDDEN");
 assert.equal(alerts.length,1);
 monitor=createPersistentRecoveryMonitor(bookingStore,persistence,options);
 for(let i=0;i<4;i++)await monitor.inspect(input,{...context,ownerId:"salonB"});
 assert.equal(alerts.length,1,"persisted latch suppresses repeated alerts");
 now+=1001;
 monitor=createPersistentRecoveryMonitor(bookingStore,persistence,options);
 for(let i=0;i<3;i++)await monitor.inspect(input,{...context,ownerId:"salonB"});
 assert.equal(alerts.length,2,"alert rearms after window expires");
 const saved=JSON.stringify(stored),serialized=JSON.stringify(alerts);
 for(const value of ["salonA","salonB","request_12345","PRIVATE_PERSON",input.secret])
  assert.ok(!saved.includes(value)&&!serialized.includes(value),"private value leaked");
 failSave=true;
 monitor=createPersistentRecoveryMonitor(bookingStore,persistence,options);
 assert.equal((await monitor.inspect(input,{...context,ownerId:"salonB"})).status,"MONITORING_UNAVAILABLE");
 assert.equal(alerts.length,2,"no alert after failed persistence");
 failSave=false;
 failLoad=true;
 monitor=createPersistentRecoveryMonitor(bookingStore,persistence,options);
 assert.equal((await monitor.inspect(input,context)).status,"MONITORING_UNAVAILABLE");
 failLoad=false;
 const previous=stored;
 stored={...previous,events:{...previous.events,access_denied:[now+1000]}};
 monitor=createPersistentRecoveryMonitor(bookingStore,persistence,options);
 assert.equal((await monitor.inspect(input,context)).status,"MONITORING_UNAVAILABLE");
 stored=previous;
 monitor=createPersistentRecoveryMonitor(bookingStore,persistence,options);
 const many=await Promise.all(Array.from({length:20},()=>monitor.inspect(input,{...context,ownerId:"salonB"})));
 assert.ok(many.every(r=>r.status==="OWNERSHIP_FORBIDDEN"));
 assert.equal(stored.events.access_denied.length,23,"parallel inspections retain every mock counter");
 assert.equal(writes,0);
 assert.throws(()=>createPersistentRecoveryMonitor(bookingStore,{}),TypeError);
 const entry=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
 const source=fs.readFileSync(path.resolve(__dirname,"../functions/phase1516PersistentRecoveryMonitor.js"),"utf8");
 assert.ok(!entry.includes("phase1516PersistentRecoveryMonitor"));
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction("));
 console.log("PASS Phase 15.16 restart persistence, alert suppression, window rearm, corrupted state, storage outages, privacy, no booking writes");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
