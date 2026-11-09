"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const old={};for(const key of ["FIRESTORE_EMULATOR_HOST","FIREBASE_AUTH_EMULATOR_HOST","GCLOUD_PROJECT","GOOGLE_CLOUD_PROJECT","GOOGLE_APPLICATION_CREDENTIALS"])old[key]=process.env[key];
Object.assign(process.env,{FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080",FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:9099",GCLOUD_PROJECT:"demo-boustio-legacy-init",GOOGLE_CLOUD_PROJECT:"demo-boustio-legacy-init"});delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
const {createStagingCalendarTransport}=require("./phase1117StagingTransport");
const input={businessId:"demo_barber",date:"2026-11-10",ownerToken:"synthetic-owner-token"};
const origin="https://staging-calendar.example.test/";
test("11.17 only synthetic staging HTTPS hosts allowed; no live endpoint",()=>{
 for(const url of ["http://staging-calendar.example.test/","https://boustio.co.uk/","https://staging-calendar.example.test.evil.com/","https://staging-calendar.example.test:444/","https://user:pass@staging-calendar.example.test/","https://staging-calendar.example.test/path","https://staging-calendar.example.test/?token=1"]){
  assert.throws(()=>createStagingCalendarTransport({fetchImpl:async()=>{},approvedOrigin:url}));
 }
 assert.doesNotMatch(fs.readFileSync(path.join(__dirname,"index.js"),"utf8"),/phase1117StagingTransport/);
});
test("11.17 authenticated request shape, no redirects, safe projection",async()=>{
 let called=0;
 const adapter=createStagingCalendarTransport({approvedOrigin:origin,fetchImpl:async(url,options)=>{
  called++;assert.equal(url,origin+"api/owner-calendar");assert.equal(options.redirect,"error");
  assert.equal(options.method,"POST");assert.deepEqual(JSON.parse(options.body),input);
  return {status:200,headers:{get:()=> "application/json"},text:async()=>JSON.stringify({businessId:input.businessId,date:input.date,appointments:[{id:"booking1",source:"demo_customer_web",serviceId:"cut",staffId:"barber",startAt:"2026-11-10T10:00:00.000Z",endAt:"2026-11-10T10:30:00.000Z",status:"confirmed"}]})};
 }});
 const data=await adapter.read(input);assert.equal(data.appointments.length,1);assert.equal(called,1);
});
test("11.17 rejects unauthorised response, mismatched owner feed, and invalid input",async()=>{
 const adapter=createStagingCalendarTransport({approvedOrigin:origin,fetchImpl:async()=>({status:403,headers:{get:()=> "application/json"},text:async()=> "{}"})});
 await assert.rejects(adapter.read(input),/unavailable/);
 await assert.rejects(adapter.read({...input,businessId:"salonbook-pro-ad5ff"}),/synthetic business only/);
 const forged=createStagingCalendarTransport({approvedOrigin:origin,fetchImpl:async()=>({status:200,headers:{get:()=> "application/json"},text:async()=>JSON.stringify({businessId:"demo_other",date:input.date,appointments:[]})})});
 await assert.rejects(forged.read(input),/invalid snapshot/);
});
test.after(()=>{for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
