"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const admin=require("firebase-admin");
const {createDemoServer}=require("./phase115LocalServer");
const {createDemoJourney}=require("./phase115DemoJourney");
const PROJECT="demo-boustio-legacy-init";
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw Error("Emulators required");
process.env.GCLOUD_PROJECT=PROJECT;process.env.GOOGLE_CLOUD_PROJECT=PROJECT;
if(!admin.apps.length)admin.initializeApp({projectId:PROJECT});
const db=admin.firestore(),auth=admin.auth();
let seq=0;
async function fixture(){
 const id="demo_web_"+process.pid+"_"+(++seq),b=db.collection("phase113DemoBusinesses").doc(id);
 await Promise.all([b.set({closures:[]}),b.collection("services").doc("cut").set({name:"Haircut",durationMinutes:30,active:true}),b.collection("staff").doc("stylist").set({name:"Stylist",active:true,serviceIds:["cut"],weeklyHours:{"2":[{start:540,end:1020}]},breaks:{"2":[{start:720,end:780}]},holidays:[]})]);
 return {id,b,journey:createDemoJourney({db,auth})};
}
test("11.5 demo catalogue lists service and qualified staff",async()=>{const f=await fixture(),c=await f.journey.catalogue(f.id);assert.equal(c.services[0].name,"Haircut");assert.deepEqual(c.staff[0].serviceIds,["cut"]);});
test("11.5 availability uses UK hours and excludes lunch break",async()=>{const f=await fixture(),a=await f.journey.availability({businessId:f.id,serviceId:"cut",staffId:"stylist",date:"2026-11-10"});assert.ok(a.includes("2026-11-10T10:00:00.000Z"));assert.ok(!a.includes("2026-11-10T12:00:00.000Z"));assert.ok(!a.includes("2026-11-10T08:00:00.000Z"));});
test("11.5 live availability excludes booked slots",async()=>{const f=await fixture();await f.b.collection("staffDays").doc("stylist_2026-11-10").set({slots:[{start:Date.parse("2026-11-10T10:00:00Z"),end:Date.parse("2026-11-10T10:30:00Z"),bookingId:"existing"}]});const a=await f.journey.availability({businessId:f.id,serviceId:"cut",staffId:"stylist",date:"2026-11-10"});assert.ok(!a.includes("2026-11-10T10:00:00.000Z"));assert.ok(a.includes("2026-11-10T10:30:00.000Z"));});
test("11.5 business closure produces no slots",async()=>{const f=await fixture();await f.b.set({closures:["2026-11-10"]});assert.deepEqual(await f.journey.availability({businessId:f.id,serviceId:"cut",staffId:"stylist",date:"2026-11-10"}),[]);});
test("11.5 invalid date and production business denied",async()=>{const f=await fixture();await assert.rejects(f.journey.availability({businessId:f.id,serviceId:"cut",staffId:"stylist",date:"2026-11-31"}));await assert.rejects(f.journey.catalogue("salonbook-pro-ad5ff"));});
test("11.5 invalid customer token cannot book",async()=>{const f=await fixture();await assert.rejects(f.journey.book({businessId:f.id,serviceId:"cut",staffId:"stylist",startAt:"2026-11-10T10:00:00.000Z",idempotencyKey:"demo_req",customerAccessToken:"forged"}));assert.equal((await f.b.collection("bookings").get()).size,0);});
test("11.5 local HTTP serves separate prototype and never modifies production page",async()=>{
 const f=await fixture(),server=createDemoServer({db,auth});
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{const base="http://127.0.0.1:"+server.address().port;
  const page=await fetch(base+"/");assert.equal(page.status,200);assert.match(await page.text(),/EMULATOR DEMO ONLY/);
  const response=await fetch(base+"/api/catalogue",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({businessId:f.id})});
  assert.equal(response.status,200);assert.equal((await response.json()).services[0].name,"Haircut");
  const forbidden=await fetch(base+"/api/book",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({businessId:f.id})});assert.equal(forbidden.status,400);
 }finally{await new Promise(resolve=>server.close(resolve));}
 const production=fs.readFileSync(path.join(__dirname,"../website/book/index.html"),"utf8");
 assert.match(production,/Booking unavailable — preview only/);
});
test("11.5 prototype not exported from deployed functions entrypoint",()=>{const index=fs.readFileSync(path.join(__dirname,"index.js"),"utf8");for(const name of ["phase115DemoJourney","phase115LocalServer"])assert.equal(index.includes(name),false);});
