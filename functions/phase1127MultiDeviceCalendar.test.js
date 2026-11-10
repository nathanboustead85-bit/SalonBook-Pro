"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const keys=["FIRESTORE_EMULATOR_HOST","FIREBASE_AUTH_EMULATOR_HOST","GCLOUD_PROJECT","GOOGLE_CLOUD_PROJECT","GOOGLE_APPLICATION_CREDENTIALS"];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
Object.assign(process.env,{FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080",FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:9099",GCLOUD_PROJECT:"demo-boustio-legacy-init",GOOGLE_CLOUD_PROJECT:"demo-boustio-legacy-init"});
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
const {createMultiDeviceCalendar}=require("./phase1127MultiDeviceCalendar");
const request={businessId:"demo_barber",date:"2026-11-10",ownerToken:"synthetic-owner"};
const appt=(id,start,end,staffId="barber",status="confirmed")=>({id,source:"demo_customer_web",serviceId:"cut",staffId,startAt:"2026-11-10T"+start+":00Z",endAt:"2026-11-10T"+end+":00Z",status});
const a=appt("a","09:00","09:30");
const feed=appointments=>({businessId:request.businessId,date:request.date,appointments});
const create=()=>createMultiDeviceCalendar({request,initial:feed([a]),revision:1});
const send=(deviceId,operationId,baseRevision,appointments)=>({deviceId,operationId,baseRevision,snapshot:feed(appointments)});
test("11.27 first device wins and stale second device cannot overwrite",()=>{
 const c=create();
 assert.equal(c.submit(send("phone","one",1,[a,appt("b","10:00","10:30")])).outcome,"applied");
 assert.equal(c.submit(send("tablet","one",1,[a,appt("c","11:00","11:30")])).outcome,"stale");
 assert.equal(c.state().revision,2);assert.deepEqual(c.state().snapshot.appointments.map(x=>x.id),["a","b"]);
});
test("11.27 rejected device can refresh revision and resubmit complete snapshot",()=>{
 const c=create();c.submit(send("phone","one",1,[a,appt("b","10:00","10:30")]));
 assert.equal(c.submit(send("tablet","one",1,[a,appt("c","11:00","11:30")])).outcome,"stale");
 assert.equal(c.submit(send("tablet","two",2,[a,appt("b","10:00","10:30"),appt("c","11:00","11:30")])).outcome,"applied");
 assert.equal(c.state().snapshot.appointments.length,3);
});
test("11.27 repeated same device operation is idempotent",()=>{
 const c=create(),u=send("phone","one",1,[a,appt("b","10:00","10:30")]);
 assert.equal(c.submit(u).outcome,"applied");assert.equal(c.submit(u).outcome,"duplicate");
 assert.equal(c.state().revision,2);
});
test("11.27 same operation identifier with changed contents fails closed",()=>{
 const c=create();c.submit(send("phone","one",1,[a,appt("b","10:00","10:30")]));
 assert.throws(()=>c.submit(send("phone","one",1,[a,appt("c","11:00","11:30")])),/operation replay conflict/);
 assert.equal(c.state().snapshot.appointments[1].id,"b");
});
test("11.27 overlapping same-staff bookings are blocked",()=>{
 const c=create();
 assert.equal(c.submit(send("phone","one",1,[a,appt("b","09:15","09:45")])).outcome,"conflict");
 assert.equal(c.state().revision,1);
});
test("11.27 simultaneous different staff appointments are permitted",()=>{
 const c=create();
 assert.equal(c.submit(send("phone","one",1,[a,appt("b","09:15","09:45","other")])).outcome,"applied");
});
test("11.27 omitted booking cannot be deleted by partial device feed",()=>{
 const c=create();assert.equal(c.submit(send("phone","one",1,[appt("b","10:00","10:30")])).outcome,"incomplete");
 assert.equal(c.state().snapshot.appointments[0].id,"a");
});
test("11.27 explicit cancellation is preserved",()=>{
 const c=create();const cancelled={...a,status:"cancelled"};
 assert.equal(c.submit(send("phone","one",1,[cancelled])).outcome,"applied");
 assert.equal(c.state().snapshot.appointments[0].status,"cancelled");
});
test("11.27 cross-business snapshots rejected",()=>{
 const c=create(),u=send("phone","one",1,[a]);u.snapshot.businessId="other";
 assert.throws(()=>c.submit(u),/invalid snapshot/);assert.equal(c.state().revision,1);
});
test("11.27 prototype not exported from production Firebase functions",()=>{
 assert.doesNotMatch(fs.readFileSync(path.join(__dirname,"index.js"),"utf8"),/phase1127MultiDeviceCalendar/);
});
test.after(()=>{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
