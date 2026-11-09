"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const keys=["FIRESTORE_EMULATOR_HOST","FIREBASE_AUTH_EMULATOR_HOST","GCLOUD_PROJECT","GOOGLE_CLOUD_PROJECT","GOOGLE_APPLICATION_CREDENTIALS"];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
Object.assign(process.env,{FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080",FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:9099",GCLOUD_PROJECT:"demo-boustio-legacy-init",GOOGLE_CLOUD_PROJECT:"demo-boustio-legacy-init"});delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
const {createCalendarReconnect}=require("./phase1121CalendarReconnect");
const request={businessId:"demo_barber",date:"2026-11-10",ownerToken:"synthetic-owner"};
const booking=(id,status="confirmed")=>({id,source:"demo_customer_web",serviceId:"cut",staffId:"barber",startAt:"2026-11-10T10:00:00Z",endAt:"2026-11-10T10:30:00Z",status});
const feed=appointments=>({businessId:request.businessId,date:request.date,appointments});
test("11.21 offline failure preserves appointments and revision",async()=>{
 const s=createCalendarReconnect({request,initial:feed([booking("a")]),revision:1});
 await assert.rejects(s.reconnect(async()=>{throw Error("network offline");}),/unavailable/);
 assert.equal(s.state().connected,false);assert.equal(s.state().revision,1);assert.equal(s.state().snapshot.appointments[0].id,"a");
});
test("11.21 reconnect with new booking applies once",async()=>{
 const s=createCalendarReconnect({request,initial:feed([booking("a")]),revision:1});
 const result=await s.reconnect(async()=>({revision:2,snapshot:feed([booking("a"),booking("b")])}));
 assert.deepEqual(result.added.map(x=>x.id),["b"]);assert.equal(s.state().snapshot.appointments.length,2);assert.equal(s.state().connected,true);
 s.disconnect();assert.equal(s.state().connected,false);assert.equal(s.state().snapshot.appointments.length,2);
});
test("11.21 stale reconnect cannot replace newer appointments",async()=>{
 const s=createCalendarReconnect({request,initial:feed([booking("a")]),revision:5});
 await assert.rejects(s.reconnect(async()=>({revision:4,snapshot:feed([])})),/unavailable/);
 assert.equal(s.state().revision,5);assert.equal(s.state().snapshot.appointments.length,1);
});
test("11.21 incomplete feed cannot silently erase an appointment",async()=>{
 const s=createCalendarReconnect({request,initial:feed([booking("a")]),revision:1});
 await assert.rejects(s.reconnect(async()=>({revision:2,snapshot:feed([])})),/unavailable/);
 assert.equal(s.state().snapshot.appointments[0].id,"a");assert.equal(s.state().revision,1);
});
test("11.21 failed reconnect followed by valid refresh recovers",async()=>{
 const s=createCalendarReconnect({request,initial:feed([booking("a")]),revision:1});
 await assert.rejects(s.reconnect(async()=>({revision:2,snapshot:{...feed([]),businessId:"demo_other"}})),/unavailable/);
 const r=await s.reconnect(async()=>({revision:3,snapshot:feed([booking("a","cancelled")])}));
 assert.equal(r.changed.length,1);assert.equal(s.state().attempts,2);assert.equal(s.state().lastError,null);
});
test("11.21 module cannot be reached through production Firebase entrypoint",()=>{
 const entry=fs.readFileSync(path.join(__dirname,"index.js"),"utf8");
 assert.doesNotMatch(entry,/phase1121CalendarReconnect/);
});
test.after(()=>{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
