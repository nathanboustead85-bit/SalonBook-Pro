"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const keys=["FIRESTORE_EMULATOR_HOST","FIREBASE_AUTH_EMULATOR_HOST","GCLOUD_PROJECT","GOOGLE_CLOUD_PROJECT","GOOGLE_APPLICATION_CREDENTIALS"];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
Object.assign(process.env,{FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080",FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:9099",GCLOUD_PROJECT:"demo-boustio-legacy-init",GOOGLE_CLOUD_PROJECT:"demo-boustio-legacy-init"});delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
const {detectBookingConflicts}=require("./phase1122BookingConflicts");
const request={businessId:"demo_barber",date:"2026-11-10",ownerToken:"synthetic-owner"};
const booking=(id,status="confirmed",startAt="2026-11-10T10:00:00Z")=>({id,source:"demo_customer_web",serviceId:"cut",staffId:"barber",startAt,endAt:"2026-11-10T11:00:00Z",status});
const feed=appointments=>({businessId:request.businessId,date:request.date,appointments});
test("11.22 divergent offline and website edits flag a conflict",()=>{
 const b=booking("a");
 const r=detectBookingConflicts({request,base:feed([b]),local:feed([{...b,staffId:"barber2"}]),remote:feed([{...b,serviceId:"colour"}])});
 assert.equal(r.safe,false);assert.deepEqual(r.conflicts,["a"]);
});
test("11.22 matching edits do not conflict",()=>{
 const b=booking("a"),c=booking("a","cancelled");
 const r=detectBookingConflicts({request,base:feed([b]),local:feed([c]),remote:feed([c])});
 assert.equal(r.safe,true);assert.deepEqual(r.conflicts,[]);
});
test("11.22 independent bookings can change without conflict",()=>{
 const a=booking("a"),b=booking("b");
 const r=detectBookingConflicts({request,base:feed([a,b]),local:feed([booking("a","cancelled"),b]),remote:feed([a,booking("b","cancelled")])});
 assert.equal(r.safe,true);
});
test("11.22 simultaneous booking creation with same ID but different data conflicts",()=>{
 const r=detectBookingConflicts({request,base:feed([]),local:feed([booking("a")]),remote:feed([booking("a","cancelled")])});
 assert.deepEqual(r.conflicts,["a"]);
});
test("11.22 forged feed and duplicate booking IDs rejected",()=>{
 assert.throws(()=>detectBookingConflicts({request,base:feed([]),local:feed([]),remote:{...feed([]),businessId:"demo_other"}}),/invalid snapshot/);
 assert.throws(()=>detectBookingConflicts({request,base:feed([]),local:feed([booking("a"),booking("a")]),remote:feed([])}),/invalid booking/);
});
test("11.22 isolated from production Firebase exports",()=>{
 assert.doesNotMatch(fs.readFileSync(path.join(__dirname,"index.js"),"utf8"),/phase1122BookingConflicts/);
});
test.after(()=>{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
