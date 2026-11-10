"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const keys=["FIRESTORE_EMULATOR_HOST","FIREBASE_AUTH_EMULATOR_HOST","GCLOUD_PROJECT","GOOGLE_CLOUD_PROJECT","GOOGLE_APPLICATION_CREDENTIALS"];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
Object.assign(process.env,{FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080",FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:9099",GCLOUD_PROJECT:"demo-boustio-legacy-init",GOOGLE_CLOUD_PROJECT:"demo-boustio-legacy-init"});
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
const {createRestartJournal}=require("./phase1129RestartJournal");
const request={businessId:"demo_barber",date:"2026-11-10",ownerToken:"synthetic-owner"};
const appt=(id,start="09:00",end="09:30",status="confirmed")=>({id,source:"demo_customer_web",serviceId:"cut",staffId:"barber",startAt:"2026-11-10T"+start+":00Z",endAt:"2026-11-10T"+end+":00Z",status});
const a=appt("a"),b=appt("b","10:00","10:30"),c=appt("c","11:00","11:30");
const feed=appointments=>({businessId:request.businessId,date:request.date,appointments});
const memory=()=>{let bytes=null;return {read:()=>bytes===null?null:JSON.parse(bytes),write:v=>{bytes=JSON.stringify(v);},tamper:v=>{bytes=JSON.stringify(v);}};};
const start=storage=>createRestartJournal({request,storage,initial:feed([a]),revision:1});
const op=(id,revision,appointments)=>({deviceId:"phone",operationId:id,baseRevision:revision,snapshot:feed(appointments)});
test("11.29 queued offline appointment survives process restart",()=>{
 const storage=memory();start(storage).queue(op("offline",1,[a,b]));
 const restarted=start(storage);assert.equal(restarted.status().pending.length,1);
 assert.deepEqual(restarted.recover({revision:1,snapshot:feed([a])}).outcomes,["applied"]);
 assert.deepEqual(start(storage).status().snapshot.appointments.map(x=>x.id),["a","b"]);
});
test("11.29 repeated restart never resubmits acknowledged operation",()=>{
 const storage=memory(),journal=start(storage);journal.queue(op("one",1,[a,b]));
 assert.equal(journal.recover({revision:1,snapshot:feed([a])}).applied,1);
 const restarted=start(storage);assert.equal(restarted.status().pending.length,0);
 assert.equal(restarted.recover({revision:2,snapshot:feed([a,b])}).applied,0);
});
test("11.29 stale device operation remains pending for manual reconciliation",()=>{
 const storage=memory(),journal=start(storage);journal.queue(op("stale",1,[a,c]));
 const result=journal.recover({revision:2,snapshot:feed([a,b])});
 assert.deepEqual(result.outcomes,["stale"]);assert.equal(result.pending,1);
 assert.deepEqual(start(storage).status().snapshot.appointments.map(x=>x.id),["a","b"]);
});
test("11.29 rejected overlap remains queued and confirmed booking is preserved",()=>{
 const storage=memory(),journal=start(storage),overlap=appt("overlap","09:15","09:45");
 journal.queue(op("overlap",1,[a,overlap]));
 assert.deepEqual(journal.recover({revision:1,snapshot:feed([a])}).outcomes,["conflict"]);
 assert.equal(start(storage).status().pending.length,1);
 assert.deepEqual(journal.status().snapshot.appointments.map(x=>x.id),["a"]);
});
test("11.29 explicit cancellation survives restart",()=>{
 const storage=memory(),journal=start(storage),cancelled={...a,status:"cancelled"};
 journal.queue(op("cancel",1,[cancelled]));
 assert.equal(start(storage).recover({revision:1,snapshot:feed([a])}).applied,1);
 assert.equal(start(storage).status().snapshot.appointments[0].status,"cancelled");
});
test("11.29 duplicate offline operation cannot be silently changed",()=>{
 const storage=memory(),journal=start(storage);
 assert.equal(journal.queue(op("one",1,[a,b])),"queued");
 assert.equal(journal.queue(op("one",1,[a,b])),"duplicate");
 assert.throws(()=>journal.queue(op("one",1,[a,c])),/operation replay conflict/);
 assert.equal(start(storage).status().pending.length,1);
});
test("11.29 persisted checkpoint cannot be restored for another business",()=>{
 const storage=memory();start(storage);
 assert.throws(()=>createRestartJournal({request:{...request,businessId:"another"},storage,initial:feed([a]),revision:1}),/invalid journal checkpoint/);
});
test("11.29 corrupted checkpoint fails closed",()=>{
 const storage=memory();start(storage);storage.tamper({version:999});
 assert.throws(()=>start(storage),/invalid journal checkpoint/);
});
test("11.29 rollback of authoritative revision is rejected",()=>{
 const storage=memory(),journal=start(storage);journal.queue(op("one",1,[a,b]));
 journal.recover({revision:1,snapshot:feed([a])});
 assert.throws(()=>start(storage).recover({revision:1,snapshot:feed([a])}),/authoritative rollback rejected/);
});
test("11.29 storage write failure does not acknowledge or drop pending operations",()=>{
 const storage=memory(),journal=start(storage);journal.queue(op("one",1,[a,b]));
 const failed={read:storage.read,write:()=>{throw Error("disk unavailable");}};
 const restarted=start(failed);
 assert.throws(()=>restarted.recover({revision:1,snapshot:feed([a])}),/disk unavailable/);
 assert.equal(start(storage).status().pending.length,1);
});
test("11.29 synthetic restart journal is not exported from production functions",()=>{
 assert.doesNotMatch(fs.readFileSync(path.join(__dirname,"index.js"),"utf8"),/phase1129RestartJournal/);
});
test.after(()=>{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
