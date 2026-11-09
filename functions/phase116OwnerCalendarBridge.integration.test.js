"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const admin=require("firebase-admin");
const {createDemoJourney}=require("./phase115DemoJourney");
const {createOwnerCalendarBridge}=require("./phase116OwnerCalendarBridge");
const {createDemoOwnerAuthorizer}=require("./phase116OwnerAuthorizer");
const PROJECT="demo-boustio-legacy-init";
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST||process.env.GOOGLE_APPLICATION_CREDENTIALS)throw Error("isolated emulators required");
process.env.GCLOUD_PROJECT=PROJECT;process.env.GOOGLE_CLOUD_PROJECT=PROJECT;
if(!admin.apps.length)admin.initializeApp({projectId:PROJECT});
const db=admin.firestore(),auth=admin.auth();
let seq=0;
async function idToken(uid){
 const custom=await auth.createCustomToken(uid);
 const response=await fetch("http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST+"/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:custom,returnSecureToken:true})});
 assert.equal(response.status,200);return (await response.json()).idToken;
}
async function fixture(){
 const n=++seq,id="demo_calendar_"+process.pid+"_"+n,ownerUid="demo_owner_"+process.pid+"_"+n,customerUid="demo_customer_"+process.pid+"_"+n;
 await Promise.all([auth.createUser({uid:ownerUid,email:ownerUid+"@example.test",emailVerified:true}),auth.createUser({uid:customerUid,email:customerUid+"@example.test",emailVerified:true})]);
 const b=db.collection("phase113DemoBusinesses").doc(id);
 await Promise.all([b.set({ownerUid,closures:[]}),b.collection("services").doc("cut").set({name:"Cut",durationMinutes:30,active:true}),b.collection("staff").doc("barber").set({name:"Barber",active:true,serviceIds:["cut"],weeklyHours:{"2":[{start:540,end:1020}]},breaks:{},holidays:[]})]);
 const [ownerToken,customerToken]=await Promise.all([idToken(ownerUid),idToken(customerUid)]);
 const bridge=createOwnerCalendarBridge({db,authorizeOwner:createDemoOwnerAuthorizer({db,auth})});
 const journey=createDemoJourney({db,auth});
 const request={businessId:id,serviceId:"cut",staffId:"barber",startAt:"2026-11-10T10:00:00.000Z",idempotencyKey:"demo_request_116",customerAccessToken:customerToken};
 return {id,b,ownerToken,customerToken,bridge,journey,request};
}
const calendar=f=>({businessId:f.id,ownerToken:f.ownerToken,date:"2026-11-10"});
test("11.6 empty demo calendar returns no appointments",async()=>{const f=await fixture();assert.deepEqual((await f.bridge.snapshot(calendar(f))).appointments,[]);});
test("11.6 customer website booking appears in owner calendar",async()=>{
 const f=await fixture(),booked=await f.journey.book(f.request),view=await f.bridge.snapshot(calendar(f));
 assert.equal(view.appointments.length,1);assert.equal(view.appointments[0].id,booked.bookingId);
 assert.equal(view.appointments[0].status,"confirmed");assert.equal(view.appointments[0].localDate,"2026-11-10");
});
test("11.6 idempotent web retry does not duplicate Android calendar item",async()=>{
 const f=await fixture();await f.journey.book(f.request);await f.journey.book(f.request);
 assert.equal((await f.bridge.snapshot(calendar(f))).appointments.length,1);
});
test("11.6 second independent appointment appears exactly once",async()=>{
 const f=await fixture();await f.journey.book(f.request);
 await f.journey.book({...f.request,startAt:"2026-11-10T11:00:00.000Z",idempotencyKey:"demo_request_117"});
 const items=(await f.bridge.snapshot(calendar(f))).appointments;assert.equal(items.length,2);assert.notEqual(items[0].id,items[1].id);
});
test("11.6 owner token is required and customer token cannot read calendar",async()=>{
 const f=await fixture();await assert.rejects(f.bridge.snapshot({...calendar(f),ownerToken:""}),/owner token required/);
 await assert.rejects(f.bridge.snapshot({...calendar(f),ownerToken:f.customerToken}),/owner access denied/);
});
test("11.6 owner of different business cannot read calendar",async()=>{
 const f=await fixture(),other=await fixture();
 await assert.rejects(f.bridge.snapshot({...calendar(f),ownerToken:other.ownerToken}),/owner access denied/);
});
test("11.6 forged token and production business ID are rejected",async()=>{
 const f=await fixture();await assert.rejects(f.bridge.snapshot({...calendar(f),ownerToken:"forged"}),/owner access denied/);
 await assert.rejects(f.bridge.snapshot({...calendar(f),businessId:"salonbook-pro-ad5ff"}),/owner access denied|synthetic business required/);
});
test("11.6 real-time listener emits booking creation and status updates",async()=>{
 const f=await fixture();let unsubscribe=()=>{};
 try{
  const events=[],next=()=>new Promise((resolve,reject)=>{
   const started=Date.now();
   const timer=setInterval(()=>{if(events.length&&events[events.length-1].appointments.length>=1){clearInterval(timer);resolve(events[events.length-1]);}else if(Date.now()-started>8000){clearInterval(timer);reject(Error("calendar listener timeout"));}},25);
  });
  unsubscribe=await f.bridge.subscribe({...calendar(f),onChange:v=>events.push(v),onError:e=>{throw e;}});
  const booked=await f.journey.book(f.request),first=await next();
  assert.equal(first.appointments[0].id,booked.bookingId);
  const booking=f.b.collection("bookings").doc(booked.bookingId);
  await booking.update({status:"cancelled"});
  const updated=await new Promise((resolve,reject)=>{const t=setInterval(()=>{const v=events.at(-1);if(v?.appointments[0]?.status==="cancelled"){clearInterval(t);resolve(v);} },25);setTimeout(()=>{clearInterval(t);reject(Error("status update timeout"));},8000);});
  assert.equal(updated.appointments[0].status,"cancelled");
 }finally{unsubscribe();}
});
test("11.6 invalid local date fails closed",async()=>{const f=await fixture();await assert.rejects(f.bridge.snapshot({...calendar(f),date:"2026-11-31"}),/invalid local date/);});
test("11.6 calendar bridge never writes protected legacy bookings",async()=>{
 const f=await fixture(),legacy=db.collection("users").doc(f.id).collection("liveData").doc("bookings");
 await legacy.set({json:'[{"id":"protected"}]',schemaVersion:1});
 const before=(await legacy.get()).data();
 await f.journey.book(f.request);await f.bridge.snapshot(calendar(f));
 assert.deepEqual((await legacy.get()).data(),before);
});
test("11.6 demo bridge not exported from production functions",()=>{
 const index=fs.readFileSync(path.join(__dirname,"index.js"),"utf8");
 for(const moduleName of ["phase116OwnerCalendarBridge","phase116OwnerAuthorizer"])assert.equal(index.includes(moduleName),false);
 const page=fs.readFileSync(path.join(__dirname,"../website/book/index.html"),"utf8");
 assert.match(page,/Booking unavailable — preview only/);
});
