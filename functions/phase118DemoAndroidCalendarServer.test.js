"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const admin=require("firebase-admin");
const {createDemoAndroidCalendarServer}=require("./phase118DemoAndroidCalendarServer");
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST||process.env.GOOGLE_APPLICATION_CREDENTIALS)throw Error("Emulators only");
const PROJECT="demo-boustio-legacy-init";
process.env.GCLOUD_PROJECT=PROJECT;process.env.GOOGLE_CLOUD_PROJECT=PROJECT;
if(!admin.apps.length)admin.initializeApp({projectId:PROJECT});
const db=admin.firestore(),auth=admin.auth();
test("11.8 isolated Android debug package and loopback-only network policy",()=>{
 const root=path.join(__dirname,"../demo/phase118");
 const gradle=fs.readFileSync(path.join(root,"demoapp/build.gradle.kts"),"utf8");
 const network=fs.readFileSync(path.join(root,"demoapp/src/main/res/xml/demo_network_security.xml"),"utf8");
 const java=fs.readFileSync(path.join(root,"demoapp/src/main/java/uk/co/boustio/calendar/demo/DemoCalendarActivity.java"),"utf8");
 assert.match(gradle,/uk\.co\.boustio\.calendar\.demo/);assert.doesNotMatch(gradle,/com\.salonbook\.pro/);
 assert.match(network,/base-config cleartextTrafficPermitted="false"/);assert.match(network,/<domain>127\.0\.0\.1<\/domain>/);
 assert.match(java,/Europe\/London/);assert.match(java,/Reconnecting/);assert.match(java,/generation/);
 assert.equal(fs.existsSync(path.join(root,"demoapp/google-services.json")),false);
});
test("11.8 local endpoint rejects anonymous, forged and non-demo business access",async()=>{
 const server=createDemoAndroidCalendarServer({db,auth});
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{
  const url="http://127.0.0.1:"+server.address().port+"/api/owner-calendar";
  const post=async body=>{const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});return r.status;};
  assert.equal(await post({businessId:"demo_testowner",date:"2026-11-10",ownerToken:"forged"}),403);
  assert.equal(await post({businessId:"salonbook-pro-ad5ff",date:"2026-11-10",ownerToken:"forged"}),403);
  assert.equal(await post({businessId:"demo_testowner",date:"2026-11-10"}),400);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test("11.8 demo server and Android Activity not included in production entrypoints",()=>{
 const root=path.join(__dirname,"..");
 assert.equal(fs.readFileSync(path.join(__dirname,"index.js"),"utf8").includes("phase118DemoAndroidCalendarServer"),false);
 assert.equal(fs.readFileSync(path.join(root,"settings.gradle.kts"),"utf8").includes("phase118"),false);
 assert.match(fs.readFileSync(path.join(root,"website/book/index.html"),"utf8"),/Booking unavailable — preview only/);
});
