"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const envKeys=["FIRESTORE_EMULATOR_HOST","FIREBASE_AUTH_EMULATOR_HOST","GCLOUD_PROJECT","GOOGLE_CLOUD_PROJECT","GOOGLE_APPLICATION_CREDENTIALS"];
const saved=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
Object.assign(process.env,{FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080",FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:9099",GCLOUD_PROJECT:"demo-boustio-legacy-init",GOOGLE_CLOUD_PROJECT:"demo-boustio-legacy-init"});
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
const {createMultiDeviceCalendar}=require("./phase1127MultiDeviceCalendar");
const request={businessId:"demo_barber",date:"2026-11-10",ownerToken:"synthetic-owner"};
const booking=(id,start,end,staffId="barber",status="confirmed")=>({id,source:"demo_customer_web",serviceId:"cut",staffId,startAt:"2026-11-10T"+start+":00Z",endAt:"2026-11-10T"+end+":00Z",status});
const a=booking("a","09:00","09:30"),b=booking("b","10:00","10:30"),c=booking("c","11:00","11:30");
const feed=appointments=>({businessId:request.businessId,date:request.date,appointments});
const make=()=>createMultiDeviceCalendar({request,initial:feed([a]),revision:1});
const op=(deviceId,operationId,baseRevision,appointments)=>({deviceId,operationId,baseRevision,snapshot:feed(appointments)});
test("11.28 concurrent phone and tablet edits require refresh before second commit",async()=>{
 const cal=make();
 const results=await Promise.all([Promise.resolve().then(()=>cal.submit(op("phone","p1",1,[a,b]))),Promise.resolve().then(()=>cal.submit(op("tablet","t1",1,[a,c])))]);
 assert.deepEqual(results.map(r=>r.outcome),["applied","stale"]);
 assert.equal(cal.submit(op("tablet","t2",2,[a,b,c])).outcome,"applied");
 assert.deepEqual(cal.state().snapshot.appointments.map(x=>x.id),["a","b","c"]);
});
test("11.28 lost response retries are idempotent and cannot duplicate bookings",()=>{
 const cal=make(),change=op("phone","network_timeout",1,[a,b]);
 assert.equal(cal.submit(change).outcome,"applied");
 for(let i=0;i<5;i++)assert.equal(cal.submit(change).outcome,"duplicate");
 assert.equal(cal.state().revision,2);
 assert.equal(cal.state().snapshot.appointments.filter(x=>x.id==="b").length,1);
});
test("11.28 stale offline snapshot cannot erase newer tablet bookings",()=>{
 const cal=make();
 assert.equal(cal.submit(op("tablet","fresh",1,[a,b])).outcome,"applied");
 assert.equal(cal.submit(op("phone","offline",1,[a,c])).outcome,"stale");
 assert.deepEqual(cal.state().snapshot.appointments.map(x=>x.id),["a","b"]);
});
test("11.28 overlapping appointments rejected after device reconnect",()=>{
 const cal=make();
 assert.equal(cal.submit(op("tablet","book",1,[a,b])).outcome,"applied");
 const overlap=booking("overlap","10:15","10:45");
 assert.equal(cal.submit(op("phone","reconnect",2,[a,b,overlap])).outcome,"conflict");
 assert.equal(cal.state().revision,2);
});
test("11.28 cancellation tombstone survives stale device replay",()=>{
 const cal=make(),cancelled={...a,status:"cancelled"};
 assert.equal(cal.submit(op("phone","cancel",1,[cancelled])).outcome,"applied");
 assert.equal(cal.submit(op("tablet","old",1,[a,b])).outcome,"stale");
 assert.equal(cal.state().snapshot.appointments[0].status,"cancelled");
 assert.equal(cal.submit(op("tablet","remove",2,[b])).outcome,"incomplete");
 assert.equal(cal.state().snapshot.appointments[0].status,"cancelled");
});
test("11.28 same operation identifier with altered payload fails closed",()=>{
 const cal=make();
 cal.submit(op("phone","retry",1,[a,b]));
 assert.throws(()=>cal.submit(op("phone","retry",1,[a,c])),/operation replay conflict/);
 assert.equal(cal.state().revision,2);
});
test("11.28 separate staff can book at identical times",()=>{
 const cal=make(),other=booking("other","09:00","09:30","stylist");
 assert.equal(cal.submit(op("tablet","different_staff",1,[a,other])).outcome,"applied");
});
test("11.28 malformed cross-business device feed never changes calendar",()=>{
 const cal=make(),bad=op("phone","invalid",1,[a,b]);
 bad.snapshot.businessId="other";
 assert.throws(()=>cal.submit(bad),/invalid snapshot/);
 assert.equal(cal.state().revision,1);
});
test("11.28 scenario suite remains isolated from production functions",()=>{
 assert.doesNotMatch(fs.readFileSync(path.join(__dirname,"index.js"),"utf8"),/phase1128MultiDeviceReliability/);
});
test.after(()=>{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
