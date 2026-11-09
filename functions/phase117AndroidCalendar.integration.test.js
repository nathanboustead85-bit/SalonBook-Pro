"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const admin=require("firebase-admin");
const {createCalendarDevServer}=require("./phase117CalendarDevServer");
const {createDemoJourney}=require("./phase115DemoJourney");
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST||process.env.GOOGLE_APPLICATION_CREDENTIALS)throw Error("emulators required");
const PROJECT="demo-boustio-legacy-init";process.env.GCLOUD_PROJECT=PROJECT;process.env.GOOGLE_CLOUD_PROJECT=PROJECT;
if(!admin.apps.length)admin.initializeApp({projectId:PROJECT});
const db=admin.firestore(),auth=admin.auth();let seq=0;
async function token(uid){
 const custom=await auth.createCustomToken(uid);
 const r=await fetch("http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST+"/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:custom,returnSecureToken:true})});
 assert.equal(r.status,200);return (await r.json()).idToken;
}
async function setup(){
 const n=++seq,id="demo_android_"+process.pid+"_"+n,owner="owner_android_"+process.pid+"_"+n,customer="customer_android_"+process.pid+"_"+n;
 await Promise.all([auth.createUser({uid:owner,email:owner+"@example.test",emailVerified:true}),auth.createUser({uid:customer,email:customer+"@example.test",emailVerified:true})]);
 const b=db.collection("phase113DemoBusinesses").doc(id);
 await Promise.all([b.set({ownerUid:owner,closures:[]}),b.collection("services").doc("cut").set({name:"Haircut",durationMinutes:30,active:true}),b.collection("staff").doc("stylist").set({name:"Stylist",active:true,serviceIds:["cut"],weeklyHours:{"2":[{start:540,end:1020}]},breaks:{},holidays:[]})]);
 const [ownerToken,customerToken]=await Promise.all([token(owner),token(customer)]);
 const server=createCalendarDevServer({db,auth});await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const url="http://127.0.0.1:"+server.address().port+"/demo/calendar";
 const query=async(overrides={})=>{const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({businessId:id,date:"2026-11-10",ownerToken,...overrides})});return {status:r.status,body:await r.json()};};
 const book=async()=>createDemoJourney({db,auth}).book({businessId:id,serviceId:"cut",staffId:"stylist",startAt:"2026-11-10T10:00:00.000Z",idempotencyKey:"android_booking",customerAccessToken:customerToken});
 return {id,b,server,query,book,ownerToken,customerToken};
}
async function withDemo(fn){const f=await setup();try{await fn(f);}finally{await new Promise(resolve=>f.server.close(resolve));}}
test("11.7 empty Android calendar feed",()=>withDemo(async f=>{const r=await f.query();assert.equal(r.status,200);assert.deepEqual(r.body.appointments,[]);}));
test("11.7 customer website booking appears on Android feed",()=>withDemo(async f=>{const booking=await f.book(),r=await f.query();assert.equal(r.status,200);assert.equal(r.body.appointments[0].id,booking.bookingId);assert.equal(r.body.appointments[0].status,"confirmed");}));
test("11.7 repeat customer request does not duplicate Android calendar",()=>withDemo(async f=>{await f.book();await f.book();assert.equal((await f.query()).body.appointments.length,1);}));
test("11.7 calendar status refresh displays cancellation",()=>withDemo(async f=>{const booked=await f.book();await f.b.collection("bookings").doc(booked.bookingId).update({status:"cancelled"});assert.equal((await f.query()).body.appointments[0].status,"cancelled");}));
test("11.7 reconnect fetch reflects bookings created while offline",()=>withDemo(async f=>{assert.equal((await f.query()).body.appointments.length,0);await f.book();assert.equal((await f.query()).body.appointments.length,1);}));
test("11.7 customer token cannot read Android owner calendar",()=>withDemo(async f=>{assert.equal((await f.query({ownerToken:f.customerToken})).status,403);}));
test("11.7 invalid owner token rejected",()=>withDemo(async f=>{assert.equal((await f.query({ownerToken:"forged"})).status,403);}));
test("11.7 production business ID rejected",()=>withDemo(async f=>{assert.equal((await f.query({businessId:"salonbook-pro-ad5ff"})).status,403);}));
test("11.7 invalid date rejected",()=>withDemo(async f=>{assert.equal((await f.query({date:"2026-11-31"})).status,403);}));
test("11.7 malformed request rejected",()=>withDemo(async f=>{assert.equal((await f.query({extra:"inject"})).status,400);}));
test("11.7 Android demo screen is isolated from production APK",()=>{
 const android=fs.readFileSync(path.join(__dirname,"../demo/phase117/DemoOwnerCalendarActivity.kt"),"utf8");
 assert.match(android,/10\.0\.2\.2:8765/);assert.match(android,/poll\(current\)/);assert.match(android,/onStop/);assert.match(android,/showSnapshot/);
 const index=fs.readFileSync(path.join(__dirname,"index.js"),"utf8");assert.ok(!index.includes("phase117CalendarDevServer"));
 const production=fs.readFileSync(path.join(__dirname,"../website/book/index.html"),"utf8");assert.match(production,/Booking unavailable — preview only/);
});
test("11.7 protected legacy bookings unchanged",()=>withDemo(async f=>{
 const legacy=db.collection("users").doc(f.id).collection("liveData").doc("bookings");
 await legacy.set({json:'[{"id":"protected"}]',schemaVersion:1});
 const before=(await legacy.get()).data();await f.book();await f.query();assert.deepEqual((await legacy.get()).data(),before);
}));
