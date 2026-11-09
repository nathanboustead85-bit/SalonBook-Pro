"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const keys=["FIRESTORE_EMULATOR_HOST","FIREBASE_AUTH_EMULATOR_HOST","GCLOUD_PROJECT","GOOGLE_CLOUD_PROJECT","GOOGLE_APPLICATION_CREDENTIALS"];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
Object.assign(process.env,{FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080",FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:9099",GCLOUD_PROJECT:"demo-boustio-legacy-init",GOOGLE_CLOUD_PROJECT:"demo-boustio-legacy-init"});delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
const {resolveBookingConflicts}=require("./phase1123SafeConflictResolution");
const request={businessId:"demo_barber",date:"2026-11-10",ownerToken:"synthetic-owner"};
const booking=(id,status="confirmed")=>({id,source:"demo_customer_web",serviceId:"cut",staffId:"barber",startAt:"2026-11-10T10:00:00Z",endAt:"2026-11-10T10:30:00Z",status});
const feed=appointments=>({businessId:request.businessId,date:request.date,appointments});
const merge=(base,local,remote)=>resolveBookingConflicts({request,base:feed(base),local:feed(local),remote:feed(remote)});
test("11.23 independent website and calendar changes merge without data loss",()=>{
 const a=booking("a"),b=booking("b");
 const result=merge([a,b],[booking("a","cancelled"),b],[a,booking("b","cancelled")]);
 assert.equal(result.requiresReview,false);assert.deepEqual(result.snapshot.appointments.map(x=>x.status),["cancelled","cancelled"]);
});
test("11.23 divergent edits held for review and original preserved",()=>{
 const a=booking("a");
 const result=merge([a],[{...a,staffId:"barber2"}],[{...a,serviceId:"colour"}]);
 assert.deepEqual(result.held,["a"]);assert.equal(result.requiresReview,true);
 assert.equal(result.snapshot.appointments[0].staffId,"barber");
});
test("11.23 absent booking in one or both feeds is never silently deleted",()=>{
 const a=booking("a");
 for(const result of [merge([a],[],[a]),merge([a],[],[])]){
  assert.equal(result.snapshot.appointments.length,1);
  assert.equal(result.snapshot.appointments[0].id,"a");
 }
});
test("11.23 explicit cancellation accepted when unopposed",()=>{
 const a=booking("a");
 const result=merge([a],[a],[booking("a","cancelled")]);
 assert.equal(result.snapshot.appointments[0].status,"cancelled");
});
test("11.23 competing new booking IDs held for review without choosing a winner",()=>{
 const a=booking("a"),b=booking("a","cancelled");
 const result=merge([],[a],[b]);
 assert.deepEqual(result.held,["a"]);assert.equal(result.snapshot.appointments.length,0);
});
test("11.23 malformed, cross-business, duplicate feed fails closed",()=>{
 const a=booking("a");
 assert.throws(()=>resolveBookingConflicts({request,base:feed([]),local:feed([]),remote:{...feed([]),businessId:"demo_other"}}),/invalid snapshot/);
 assert.throws(()=>merge([],[a,a],[]),/invalid booking/);
});
test("11.23 no production Firebase export",()=>{
 assert.doesNotMatch(fs.readFileSync(path.join(__dirname,"index.js"),"utf8"),/phase1123SafeConflictResolution/);
});
test.after(()=>{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
