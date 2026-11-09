"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const envKeys=["FIRESTORE_EMULATOR_HOST","FIREBASE_AUTH_EMULATOR_HOST","GCLOUD_PROJECT","GOOGLE_CLOUD_PROJECT","GOOGLE_APPLICATION_CREDENTIALS"];
const saved=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
Object.assign(process.env,{FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080",FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:9099",GCLOUD_PROJECT:"demo-boustio-legacy-init",GOOGLE_CLOUD_PROJECT:"demo-boustio-legacy-init"});
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
const {reconcileCalendar}=require("./phase1119CalendarReconciliation");
const request={businessId:"demo_barber",date:"2026-11-10",ownerToken:"synthetic-owner"};
const item=(id,status="confirmed")=>({id,source:"demo_customer_web",serviceId:"cut",staffId:"barber",startAt:"2026-11-10T10:00:00Z",endAt:"2026-11-10T10:30:00Z",status});
const snapshot=appointments=>({businessId:request.businessId,date:request.date,appointments});
test("11.19 first website booking appears once in owner calendar",()=>{
 const r=reconcileCalendar({request,previous:snapshot([]),current:snapshot([item("b1")])});
 assert.deepEqual(r.added.map(a=>a.id),["b1"]);assert.deepEqual(r.changed,[]);assert.deepEqual(r.removed,[]);assert.equal(r.unchanged,0);
});
test("11.19 reconnect does not duplicate existing booking",()=>{
 const r=reconcileCalendar({request,previous:snapshot([item("b1")]),current:snapshot([item("b1")])});
 assert.equal(r.unchanged,1);assert.equal(r.added.length,0);assert.equal(r.changed.length,0);
});
test("11.19 cancellation is a change, not silent deletion",()=>{
 const r=reconcileCalendar({request,previous:snapshot([item("b1")]),current:snapshot([item("b1","cancelled")])});
 assert.equal(r.changed[0].status,"cancelled");assert.deepEqual(r.removed,[]);
});
test("11.19 missing booking explicitly reported, not silently ignored",()=>{
 const r=reconcileCalendar({request,previous:snapshot([item("b1")]),current:snapshot([])});
 assert.deepEqual(r.removed,["b1"]);
});
test("11.19 rejects duplicate IDs, mismatched business, invalid owner and forged source",()=>{
 assert.throws(()=>reconcileCalendar({request,previous:snapshot([]),current:snapshot([item("b1"),item("b1")])}),/invalid booking/);
 assert.throws(()=>reconcileCalendar({request,previous:snapshot([]),current:{...snapshot([]),businessId:"demo_other"}}),/invalid snapshot/);
 assert.throws(()=>reconcileCalendar({request:{...request,ownerToken:""},previous:snapshot([]),current:snapshot([])}),/owner token/);
 assert.throws(()=>reconcileCalendar({request,previous:snapshot([]),current:snapshot([{...item("b1"),source:"external"}])}),/invalid booking/);
});
test("11.19 remains unexported from production Firebase entrypoint",()=>{
 const entry=fs.readFileSync(path.join(__dirname,"index.js"),"utf8");
 assert.doesNotMatch(entry,/phase1119CalendarReconciliation/);
});
test.after(()=>{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
