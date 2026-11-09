"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const admin=require("firebase-admin");
const {createDemoBookingEngine,guard}=require("./phase113DemoBookingEngine");
const PROJECT="demo-boustio-legacy-init";
process.env.GCLOUD_PROJECT=PROJECT;process.env.GOOGLE_CLOUD_PROJECT=PROJECT;
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw Error("Emulators required");
if(!admin.apps.length)admin.initializeApp({projectId:PROJECT});
const db=admin.firestore();
let counter=0;
async function fixture(){
 const businessId="demo_booking_"+process.pid+"_"+(++counter);
 const business=db.collection("phase113DemoBusinesses").doc(businessId);
 await Promise.all([
  business.collection("services").doc("haircut").set({active:true,durationMinutes:30}),
  business.collection("staff").doc("barber").set({active:true,serviceIds:["haircut"]})
 ]);
 const verifyCustomer=async token=>token==="verified-test-token"?{uid:"customer_123",verified:true}:null;
 const engine=createDemoBookingEngine({db,verifyCustomer});
 const req={businessId,serviceId:"haircut",staffId:"barber",startAt:"2026-11-10T10:00:00.000Z",idempotencyKey:"request_123",customerAccessToken:"verified-test-token"};
 return {businessId,business,engine,req};
}
test("11.3 demo booking succeeds and computes trusted end time",async()=>{
 const f=await fixture(),r=await f.engine.book(f.req);
 assert.equal(r.status,"confirmed");assert.equal(r.endAt,"2026-11-10T10:30:00.000Z");
 assert.equal((await f.business.collection("bookings").get()).size,1);
});
test("11.3 same idempotency key replays exactly one booking",async()=>{
 const f=await fixture(),a=await f.engine.book(f.req),b=await f.engine.book(f.req);
 assert.equal(a.bookingId,b.bookingId);assert.equal(b.idempotentReplay,true);
 assert.equal((await f.business.collection("bookings").get()).size,1);
});
test("11.3 reused key with different slot is rejected",async()=>{
 const f=await fixture();await f.engine.book(f.req);
 await assert.rejects(f.engine.book({...f.req,startAt:"2026-11-10T11:00:00.000Z"}),/duplicate request conflict/);
});
test("11.3 overlapping bookings rejected",async()=>{
 const f=await fixture();await f.engine.book(f.req);
 await assert.rejects(f.engine.book({...f.req,startAt:"2026-11-10T10:15:00.000Z",idempotencyKey:"request_456"}),/slot unavailable/);
});
test("11.3 adjacent booking accepted",async()=>{
 const f=await fixture();await f.engine.book(f.req);
 await f.engine.book({...f.req,startAt:"2026-11-10T10:30:00.000Z",idempotencyKey:"request_456"});
 assert.equal((await f.business.collection("bookings").get()).size,2);
});
test("11.3 concurrent requests cannot double book same staff slot",async()=>{
 const f=await fixture();
 const results=await Promise.allSettled([f.engine.book(f.req),f.engine.book({...f.req,idempotencyKey:"request_456"})]);
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(results.filter(x=>x.status==="rejected").length,1);
 assert.equal((await f.business.collection("bookings").get()).size,1);
});
test("11.3 concurrent identical retries create only one booking",async()=>{
 const f=await fixture(),results=await Promise.all([f.engine.book(f.req),f.engine.book(f.req)]);
 assert.equal(results[0].bookingId,results[1].bookingId);
 assert.equal((await f.business.collection("bookings").get()).size,1);
});
test("11.3 rejects unverified customer",async()=>{
 const f=await fixture();await assert.rejects(f.engine.book({...f.req,customerAccessToken:"invalid"}),/unauthenticated/);
});
test("11.3 rejects injected fields and production business ID",async()=>{
 const f=await fixture();
 await assert.rejects(f.engine.book({...f.req,admin:true}),/invalid request/);
 await assert.rejects(f.engine.book({...f.req,businessId:"salonbook-pro-ad5ff"}),/invalid request/);
});
test("11.3 rejects outside hours and weekends",async()=>{
 const f=await fixture();
 for(const startAt of ["2026-11-10T08:30:00.000Z","2026-11-10T16:45:00.000Z","2026-11-14T10:00:00.000Z"])
  await assert.rejects(f.engine.book({...f.req,startAt}),/outside demo working hours/);
});
test("11.3 rejects malformed timestamps",async()=>{
 const f=await fixture();
 for(const startAt of ["2026-11-10","2026-11-10T10:00:01.000Z","2026-11-31T10:00:00.000Z"])
  await assert.rejects(f.engine.book({...f.req,startAt}),/invalid start time|invalid request/);
});
test("11.3 refuses missing emulator configuration",()=>{
 const old=process.env.FIRESTORE_EMULATOR_HOST;
 try{delete process.env.FIRESTORE_EMULATOR_HOST;assert.throws(()=>guard(),/demo emulators required/);}
 finally{process.env.FIRESTORE_EMULATOR_HOST=old;}
});
test("11.3 demo module is not exported from deployed functions",()=>{
 const index=fs.readFileSync(path.join(__dirname,"index.js"),"utf8");
 assert.equal(index.includes("phase113DemoBookingEngine"),false);
});
test("11.3 booking engine does not write legacy booking source",async()=>{
 const f=await fixture();
 const legacy=db.collection("users").doc(f.businessId).collection("liveData").doc("bookings");
 await legacy.set({json:'[{"id":"protected"}]',schemaVersion:1});
 const before=(await legacy.get()).data();
 await f.engine.book(f.req);
 assert.deepEqual((await legacy.get()).data(),before);
});
