"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const keys=["FIRESTORE_EMULATOR_HOST","FIREBASE_AUTH_EMULATOR_HOST","GCLOUD_PROJECT","GOOGLE_CLOUD_PROJECT","GOOGLE_APPLICATION_CREDENTIALS"];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
Object.assign(process.env,{FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080",FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:9099",GCLOUD_PROJECT:"demo-boustio-legacy-init",GOOGLE_CLOUD_PROJECT:"demo-boustio-legacy-init"});
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
const {createReconnectRecovery}=require("./phase1126ReconnectRecovery");
const request={businessId:"demo_barber",date:"2026-11-10",ownerToken:"synthetic-owner"};
const booking=(id,status="confirmed")=>({id,source:"demo_customer_web",serviceId:"cut",staffId:"barber",startAt:"2026-11-10T10:00:00Z",endAt:"2026-11-10T10:30:00Z",status});
const feed=appointments=>({businessId:request.businessId,date:request.date,appointments});
const create=()=>createReconnectRecovery({request,initial:feed([booking("a")]),revision:1});
test("11.26 offline recovery does not consume queued changes",()=>{
 const c=create();c.enqueue({revision:2,snapshot:feed([booking("a"),booking("b")])});
 assert.equal(c.recover().outcome,"offline");assert.equal(c.status().pending,1);assert.equal(c.status().revision,1);
 assert.equal(c.status().attempts,0);
});
test("11.26 reconnect applies updates once even on repeated recovery",()=>{
 const c=create(),u={revision:2,snapshot:feed([booking("a"),booking("b")])};
 c.enqueue(u);c.enqueue(u);c.setOnline(true);
 const r=c.recover();assert.equal(r.outcome,"synchronized");assert.equal(r.applied,1);assert.equal(r.duplicates,1);
 assert.equal(c.status().pending,0);assert.equal(c.recover().applied,0);assert.equal(c.status().revision,2);
});
test("11.26 interrupted batch remains atomic and blocked until operator action",()=>{
 const c=create();c.enqueue({revision:2,snapshot:feed([booking("a"),booking("b")])});
 c.enqueue({revision:3,snapshot:feed([])});c.setOnline(true);
 assert.equal(c.recover().outcome,"blocked");assert.equal(c.status().revision,1);assert.equal(c.status().pending,2);
 assert.equal(c.recover().outcome,"blocked");assert.equal(c.status().pending,2);
 assert.equal(c.discardPending(),2);
 c.enqueue({revision:2,snapshot:feed([booking("a"),booking("b")])});
 assert.equal(c.recover().outcome,"synchronized");assert.equal(c.status().revision,2);assert.equal(c.status().lastError,null);
});
test("11.26 stale reconnect never rolls back a confirmed booking",()=>{
 const c=create();c.setOnline(true);c.enqueue({revision:4,snapshot:feed([booking("a"),booking("b")])});
 assert.equal(c.recover().outcome,"synchronized");
 c.enqueue({revision:3,snapshot:feed([booking("a")])});
 assert.equal(c.recover().outcome,"blocked");assert.equal(c.status().revision,4);
 assert.equal(c.status().snapshot.appointments.length,2);
});
test("11.26 reconnection requires explicit boolean status",()=>{
 const c=create();assert.throws(()=>c.setOnline("true"),/invalid connection state/);
 assert.equal(c.status().online,false);
});
test("11.26 cancellation stays explicit after reconnect",()=>{
 const c=create();c.enqueue({revision:2,snapshot:feed([booking("a","cancelled")])});
 c.setOnline(true);assert.equal(c.recover().outcome,"synchronized");
 assert.equal(c.status().snapshot.appointments[0].status,"cancelled");
});
test("11.26 recovery module not exported from production functions",()=>{
 assert.doesNotMatch(fs.readFileSync(path.join(__dirname,"index.js"),"utf8"),/phase1126ReconnectRecovery/);
});
test.after(()=>{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
