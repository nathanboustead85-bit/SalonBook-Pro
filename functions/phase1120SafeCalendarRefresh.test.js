"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const keys=["FIRESTORE_EMULATOR_HOST","FIREBASE_AUTH_EMULATOR_HOST","GCLOUD_PROJECT","GOOGLE_CLOUD_PROJECT","GOOGLE_APPLICATION_CREDENTIALS"];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
Object.assign(process.env,{FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080",FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:9099",GCLOUD_PROJECT:"demo-boustio-legacy-init",GOOGLE_CLOUD_PROJECT:"demo-boustio-legacy-init"});
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
const {createSafeCalendarRefresh}=require("./phase1120SafeCalendarRefresh");
const request={businessId:"demo_barber",date:"2026-11-10",ownerToken:"synthetic-owner"};
const booking=(id,status="confirmed")=>({id,source:"demo_customer_web",serviceId:"cut",staffId:"barber",startAt:"2026-11-10T10:00:00Z",endAt:"2026-11-10T10:30:00Z",status});
const feed=appointments=>({businessId:request.businessId,date:request.date,appointments});
test("11.20 new booking sync and repeat reconnect are idempotent",()=>{
 const s=createSafeCalendarRefresh({request,initial:feed([])});
 assert.deepEqual(s.apply({next:feed([booking("a")]),revision:1}).added.map(x=>x.id),["a"]);
 assert.equal(s.apply({next:feed([booking("a")]),revision:2}).unchanged,1);
 assert.equal(s.snapshot().appointments.length,1);
});
test("11.20 stale and repeated revisions rejected without changing state",()=>{
 const s=createSafeCalendarRefresh({request,initial:feed([booking("a")]),revision:5});
 assert.throws(()=>s.apply({next:feed([booking("a","cancelled")]),revision:5}),/stale/);
 assert.throws(()=>s.apply({next:feed([booking("a","cancelled")]),revision:4}),/stale/);
 assert.equal(s.snapshot().appointments[0].status,"confirmed");assert.equal(s.revision(),5);
});
test("11.20 incomplete feed cannot silently remove bookings",()=>{
 const s=createSafeCalendarRefresh({request,initial:feed([booking("a")]),revision:1});
 assert.throws(()=>s.apply({next:feed([]),revision:2}),/existing bookings missing/);
 assert.equal(s.snapshot().appointments.length,1);assert.equal(s.revision(),1);
});
test("11.20 explicit cancellation is accepted and retained",()=>{
 const s=createSafeCalendarRefresh({request,initial:feed([booking("a")])});
 const result=s.apply({next:feed([booking("a","cancelled")]),revision:1});
 assert.equal(result.changed.length,1);assert.equal(s.snapshot().appointments[0].status,"cancelled");
});
test("11.20 forged snapshot and duplicate booking IDs cannot advance revision",()=>{
 const s=createSafeCalendarRefresh({request,initial:feed([booking("a")])});
 assert.throws(()=>s.apply({next:{...feed([]),businessId:"demo_other"},revision:1}),/invalid snapshot/);
 assert.throws(()=>s.apply({next:feed([booking("a"),booking("a")]),revision:1}),/invalid booking/);
 assert.equal(s.revision(),0);
});
test("11.20 isolated from production Firebase entrypoint",()=>{
 const entry=fs.readFileSync(path.join(__dirname,"index.js"),"utf8");
 assert.doesNotMatch(entry,/phase1120SafeCalendarRefresh/);
});
test.after(()=>{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
