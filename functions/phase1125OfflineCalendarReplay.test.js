"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const keys=["FIRESTORE_EMULATOR_HOST","FIREBASE_AUTH_EMULATOR_HOST","GCLOUD_PROJECT","GOOGLE_CLOUD_PROJECT","GOOGLE_APPLICATION_CREDENTIALS"];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
Object.assign(process.env,{FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080",FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:9099",GCLOUD_PROJECT:"demo-boustio-legacy-init",GOOGLE_CLOUD_PROJECT:"demo-boustio-legacy-init"});
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
const {createOfflineCalendarReplay}=require("./phase1125OfflineCalendarReplay");
const request={businessId:"demo_barber",date:"2026-11-10",ownerToken:"synthetic-owner"};
const booking=id=>({id,source:"demo_customer_web",serviceId:"cut",staffId:"barber",startAt:"2026-11-10T10:00:00Z",endAt:"2026-11-10T10:30:00Z",status:"confirmed"});
const feed=appointments=>({businessId:request.businessId,date:request.date,appointments});
const create=(maxPending=100)=>createOfflineCalendarReplay({request,initial:feed([booking("a")]),revision:1,maxPending});
test("11.25 queued reconnect updates replay once in order",()=>{
 const q=create(),u={revision:2,snapshot:feed([booking("a"),booking("b")])};
 q.enqueue(u);q.enqueue(u);
 assert.equal(q.state().revision,1);
 const r=q.flush();assert.equal(r.applied,1);assert.equal(r.duplicates,1);assert.equal(q.state().pending,0);
 assert.equal(q.flush().applied,0);assert.equal(q.state().revision,2);
});
test("11.25 interrupted replay keeps queue and last good calendar",()=>{
 const q=create();q.enqueue({revision:2,snapshot:feed([booking("a"),booking("b")])});
 q.enqueue({revision:3,snapshot:feed([])});
 assert.throws(()=>q.flush(),/incomplete calendar feed/);
 assert.equal(q.state().revision,1);assert.equal(q.state().pending,2);
 assert.equal(q.discardPending(),2);
 q.enqueue({revision:2,snapshot:feed([booking("a"),booking("b")])});
 assert.equal(q.flush().revision,2);
});
test("11.25 rejects queue overflow without losing pending updates",()=>{
 const q=create(1);q.enqueue({revision:2,snapshot:feed([booking("a")])});
 assert.throws(()=>q.enqueue({revision:3,snapshot:feed([booking("a")])}),/queue full/);
 assert.equal(q.state().pending,1);
});
test("11.25 copies queued input to prevent mutation",()=>{
 const q=create(),u={revision:2,snapshot:feed([booking("a"),booking("b")])};
 q.enqueue(u);u.snapshot.appointments.pop();
 assert.equal(q.flush().snapshot.appointments.length,2);
});
test("11.25 rejects stale replay without losing queued changes",()=>{
 const q=create();q.enqueue({revision:3,snapshot:feed([booking("a"),booking("b")])});q.flush();
 q.enqueue({revision:2,snapshot:feed([booking("a")])});
 assert.throws(()=>q.flush(),/out-of-order/);assert.equal(q.state().revision,3);assert.equal(q.state().pending,1);
});
test("11.25 prototype not exported as production Firebase function",()=>{
 assert.doesNotMatch(fs.readFileSync(path.join(__dirname,"index.js"),"utf8"),/phase1125OfflineCalendarReplay/);
});
test.after(()=>{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
