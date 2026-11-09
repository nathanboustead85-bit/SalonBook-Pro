"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const keys=["FIRESTORE_EMULATOR_HOST","FIREBASE_AUTH_EMULATOR_HOST","GCLOUD_PROJECT","GOOGLE_CLOUD_PROJECT","GOOGLE_APPLICATION_CREDENTIALS"];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
Object.assign(process.env,{FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080",FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:9099",GCLOUD_PROJECT:"demo-boustio-legacy-init",GOOGLE_CLOUD_PROJECT:"demo-boustio-legacy-init"});delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
const {createIdempotentCalendarSync}=require("./phase1124IdempotentCalendarSync");
const request={businessId:"demo_barber",date:"2026-11-10",ownerToken:"synthetic-owner"};
const booking=(id,status="confirmed")=>({id,source:"demo_customer_web",serviceId:"cut",staffId:"barber",startAt:"2026-11-10T10:00:00Z",endAt:"2026-11-10T10:30:00Z",status});
const feed=appointments=>({businessId:request.businessId,date:request.date,appointments});
const create=()=>createIdempotentCalendarSync({request,initial:feed([booking("a")]),revision:1});
test("11.24 repeated identical update is idempotent",()=>{
 const s=create(),u={revision:2,snapshot:feed([booking("a"),booking("b")])};
 assert.equal(s.apply(u).applied,1);assert.equal(s.apply(u).duplicates,1);
 assert.equal(s.state().snapshot.appointments.length,2);assert.equal(s.state().revision,2);
});
test("11.24 same revision with different booking content rejected",()=>{
 const s=create();s.apply({revision:2,snapshot:feed([booking("a"),booking("b")])});
 assert.throws(()=>s.apply({revision:2,snapshot:feed([booking("a"),booking("c")])}),/conflicting replay/);
 assert.equal(s.state().snapshot.appointments[1].id,"b");
});
test("11.24 interrupted batch is atomic and can be retried",()=>{
 const s=create(),good={revision:2,snapshot:feed([booking("a"),booking("b")])};
 assert.throws(()=>s.applyBatch([good,{revision:3,snapshot:feed([])}]),/incomplete calendar feed/);
 assert.equal(s.state().revision,1);assert.equal(s.state().snapshot.appointments.length,1);
 assert.equal(s.apply(good).revision,2);
});
test("11.24 stale and out-of-order updates never roll calendar back",()=>{
 const s=create();s.apply({revision:4,snapshot:feed([booking("a"),booking("b")])});
 assert.throws(()=>s.apply({revision:3,snapshot:feed([booking("a")])}),/out-of-order/);
 assert.equal(s.state().revision,4);
});
test("11.24 duplicate in batch and explicit cancellation are safe",()=>{
 const s=create(),cancel={revision:2,snapshot:feed([booking("a","cancelled")])};
 const r=s.applyBatch([cancel,cancel]);
 assert.equal(r.applied,1);assert.equal(r.duplicates,1);assert.equal(r.snapshot.appointments[0].status,"cancelled");
});
test("11.24 cross-business and duplicate booking feeds fail closed",()=>{
 const s=create();
 assert.throws(()=>s.apply({revision:2,snapshot:{...feed([]),businessId:"demo_other"}}),/invalid snapshot/);
 assert.throws(()=>s.apply({revision:2,snapshot:feed([booking("a"),booking("a")])}),/invalid booking/);
 assert.equal(s.state().revision,1);
});
test("11.24 module is not a production Firebase export",()=>{
 assert.doesNotMatch(fs.readFileSync(path.join(__dirname,"index.js"),"utf8"),/phase1124IdempotentCalendarSync/);
});
test.after(()=>{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
