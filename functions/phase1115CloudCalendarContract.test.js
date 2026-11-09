"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const source=fs.readFileSync(path.join(__dirname,"phase1115CloudCalendarContract.js"),"utf8");
const website=fs.readFileSync(path.join(root,"website/book/index.html"),"utf8");
test("11.15 cloud contract has no deployment, endpoint, credentials, or production references",()=>{
 assert.doesNotMatch(source,/https?:\/\/|salonbook-pro-ad5ff|\.listen\(|firebase-functions|process\.env\.GOOGLE_APPLICATION_CREDENTIALS\s*=/);
 assert.match(source,/guard\(\)/);
 assert.match(website,/Booking unavailable — preview only/);
 assert.doesNotMatch(fs.readFileSync(path.join(__dirname,"index.js"),"utf8"),/phase1115CloudCalendarContract/);
});
test("11.15 synthetic owner-only calendar projection and deduplication",()=>{
 const old={FIRESTORE_EMULATOR_HOST:process.env.FIRESTORE_EMULATOR_HOST,FIREBASE_AUTH_EMULATOR_HOST:process.env.FIREBASE_AUTH_EMULATOR_HOST,GCLOUD_PROJECT:process.env.GCLOUD_PROJECT,GOOGLE_CLOUD_PROJECT:process.env.GOOGLE_CLOUD_PROJECT,GOOGLE_APPLICATION_CREDENTIALS:process.env.GOOGLE_APPLICATION_CREDENTIALS};
 Object.assign(process.env,{FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080",FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:9099",GCLOUD_PROJECT:"demo-boustio-legacy-init",GOOGLE_CLOUD_PROJECT:"demo-boustio-legacy-init"});delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
 const {createCloudReadinessAdapter}=require("./phase1115CloudCalendarContract");
 const appointment={id:"booking1",source:"demo_customer_web",serviceId:"cut",staffId:"barber",startAt:"2026-11-10T10:00:00.000Z",endAt:"2026-11-10T10:30:00.000Z",status:"confirmed"};
 const request={businessId:"demo_barber",date:"2026-11-10",ownerToken:"verified-owner"};
 const adapter=createCloudReadinessAdapter({authorizeOwner:async ({ownerToken})=>ownerToken==="verified-owner",snapshot:async()=>({businessId:"demo_barber",date:"2026-11-10",appointments:[appointment]})});
 return (async()=>{
  assert.equal((await adapter.read(request)).appointments.length,1);
  await assert.rejects(adapter.read({...request,ownerToken:"forged"}),/owner access denied/);
  await assert.rejects(adapter.read({...request,businessId:"salonbook-pro-ad5ff"}),/synthetic business only/);
  await assert.rejects(adapter.read({...request,date:"2026-02-30"}),/invalid UK date/);
  const dup=createCloudReadinessAdapter({authorizeOwner:async()=>true,snapshot:async()=>({businessId:request.businessId,date:request.date,appointments:[appointment,appointment]})});
  await assert.rejects(dup.read(request),/invalid booking/);
 })().finally(()=>{for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
});
