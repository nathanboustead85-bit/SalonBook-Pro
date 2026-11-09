"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const admin=require("firebase-admin");
const {evaluateSchedule,createVerifiedCustomer,localDay}=require("./phase114UkSchedule");
const {createDemoBookingEngine}=require("./phase113DemoBookingEngine");
const PROJECT="demo-boustio-legacy-init";
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw Error("emulators required");
process.env.GCLOUD_PROJECT=PROJECT;process.env.GOOGLE_CLOUD_PROJECT=PROJECT;
if(!admin.apps.length)admin.initializeApp({projectId:PROJECT});
const db=admin.firestore(),auth=admin.auth();
const schedule={active:true,serviceIds:["haircut"],weeklyHours:{"1":[[540,1020]],"2":[[540,1020]],"3":[[540,1020]],"4":[[540,1020]],"5":[[540,1020]]},breaks:{"2":[[720,780]]},holidays:["2026-11-18"]};
const check=(start,duration=30,staff=schedule,closures=[])=>evaluateSchedule({startMs:Date.parse(start),durationMinutes:duration,staff,closures});
test("11.4 winter UK schedule accepts 10:00 UTC as 10:00 GMT",()=>assert.equal(check("2026-11-10T10:00:00Z").startMinute,600));
test("11.4 summer UK schedule accepts 09:00 UTC as 10:00 BST",()=>assert.equal(check("2026-07-07T09:00:00Z").startMinute,600));
test("11.4 summer 08:00 UTC is outside 09:00 BST opening",()=>assert.throws(()=>check("2026-07-07T07:30:00Z"),/outside staff/));
test("11.4 staff lunch break rejects overlapping booking",()=>assert.throws(()=>check("2026-11-10T12:00:00Z",30,{...schedule,breaks:{"2":[[720,780]]}}),/staff break/));
test("11.4 adjacent appointment ending at break start allowed",()=>assert.equal(check("2026-11-10T11:30:00Z").endMinute,720));
test("11.4 staff holiday rejects booking",()=>assert.throws(()=>check("2026-11-18T10:00:00Z"),/holiday/));
test("11.4 business closure rejects booking",()=>assert.throws(()=>check("2026-11-10T10:00:00Z",30,schedule,["2026-11-10"]),/holiday/));
test("11.4 closed Sunday rejects booking",()=>assert.throws(()=>check("2026-11-15T10:00:00Z"),/staff unavailable/));
test("11.4 spring-forward DST gap is rejected",()=>{const open={...schedule,weeklyHours:{"0":[[0,240]]}};assert.throws(()=>check("2027-03-28T00:30:00Z",90,open),/DST transition/);});
test("11.4 autumn fold interval rejected",()=>{const open={...schedule,weeklyHours:{"0":[[0,240]]}};assert.throws(()=>check("2027-10-31T00:30:00Z",90,open),/DST fold|DST transition/);});
test("11.4 local day uses Europe/London date",()=>assert.equal(localDay(Date.parse("2026-07-06T23:30:00Z")),"2026-07-07"));
test("11.4 invalid staff break schedule fails closed",()=>assert.throws(()=>check("2026-11-10T10:00:00Z",30,{...schedule,breaks:{"2":[[800,700]]}}),/invalid breaks/));
let seq=0;
async function fixture(){
 const businessId="demo_uk_"+process.pid+"_"+(++seq);
 const business=db.collection("phase113DemoBusinesses").doc(businessId);
 await Promise.all([business.set({closures:[]}),business.collection("services").doc("haircut").set({active:true,durationMinutes:30}),business.collection("staff").doc("barber").set({...schedule,weeklyHours:Object.fromEntries(Object.entries(schedule.weeklyHours).map(([day,intervals])=>[day,intervals.map(([start,end])=>({start,end}))])),breaks:Object.fromEntries(Object.entries(schedule.breaks).map(([day,intervals])=>[day,intervals.map(([start,end])=>({start,end}))]))})]);
 const engine=createDemoBookingEngine({db,verifyCustomer:async t=>t==="verified"?{uid:"customer_uk",verified:true}:null,scheduleValidator:evaluateSchedule});
 return {business,engine,req:{businessId,serviceId:"haircut",staffId:"barber",startAt:"2026-07-07T09:00:00.000Z",idempotencyKey:"request_uk",customerAccessToken:"verified"}};
}
test("11.4 UK schedule enforced in Firestore transaction",async()=>{
 const f=await fixture(),r=await f.engine.book(f.req);assert.equal(r.status,"confirmed");
 assert.equal((await f.business.collection("bookings").get()).size,1);
});
test("11.4 UK schedule rejects outside hours without creating booking",async()=>{
 const f=await fixture();
 await assert.rejects(f.engine.book({...f.req,startAt:"2026-07-07T07:30:00.000Z"}),/outside staff/);
 assert.equal((await f.business.collection("bookings").get()).size,0);
});
test("11.4 staff holiday blocks transaction",async()=>{
 const f=await fixture();
 await assert.rejects(f.engine.book({...f.req,startAt:"2026-11-18T10:00:00.000Z"}),/holiday/);
});
test("11.4 real Auth emulator rejects invalid token",async()=>{
 const verify=createVerifiedCustomer({auth});
 await assert.rejects(verify("not-a-firebase-id-token"));
});
test("11.4 real Auth emulator verifies email-verified customer ID token",async()=>{
 const uid="demo_user_"+process.pid+"_"+(++seq),email=uid+"@example.test";
 await auth.createUser({uid,email,password:"ExampleOnly123!",emailVerified:true});
 const custom=await auth.createCustomToken(uid);
 const host=process.env.FIREBASE_AUTH_EMULATOR_HOST;
 const response=await fetch("http://"+host+"/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-emulator-key",{
  method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:custom,returnSecureToken:true})
 });
 assert.equal(response.ok,true);
 const body=await response.json();
 const verify=createVerifiedCustomer({auth});
 const customer=await verify(body.idToken);
 assert.equal(customer.uid,uid);assert.equal(customer.verified,true);
});
