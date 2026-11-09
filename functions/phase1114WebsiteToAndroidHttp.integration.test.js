"use strict";
/** Phase 11.14: website-to-Android-calendar HTTP contract, emulators only. */
const test=require("node:test"),assert=require("node:assert/strict"),admin=require("firebase-admin");
const {createDemoAndroidCalendarServer}=require("./phase118DemoAndroidCalendarServer");
const {createDemoJourney}=require("./phase115DemoJourney");
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST||process.env.GOOGLE_APPLICATION_CREDENTIALS)throw Error("Emulators required");
const PROJECT="demo-boustio-legacy-init";
process.env.GCLOUD_PROJECT=PROJECT;process.env.GOOGLE_CLOUD_PROJECT=PROJECT;
if(!admin.apps.length)admin.initializeApp({projectId:PROJECT});
const db=admin.firestore(),auth=admin.auth();
async function token(uid){
 const custom=await auth.createCustomToken(uid);
 const r=await fetch("http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST+"/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:custom,returnSecureToken:true})});
 assert.equal(r.status,200);return (await r.json()).idToken;
}
async function setup(){
 const suffix=process.pid+"_"+Math.random().toString(36).slice(2,10),id="demo_http_"+suffix,owner="owner_"+suffix,other="other_"+suffix,customer="customer_"+suffix;
 for(const uid of [owner,other,customer])await auth.createUser({uid,email:uid+"@example.test",emailVerified:true});
 const business=db.collection("phase113DemoBusinesses").doc(id);
 await business.set({ownerUid:owner,closures:[]});
 await business.collection("services").doc("cut").set({name:"Cut",durationMinutes:30,active:true});
 await business.collection("staff").doc("barber").set({name:"Barber",active:true,serviceIds:["cut"],weeklyHours:{"2":[{start:540,end:1020}]},breaks:{},holidays:[]});
 return {id,business,ownerToken:await token(owner),otherToken:await token(other),customerToken:await token(customer)};
}
test("11.14 customer website booking reaches authenticated Android HTTP feed once; cancellation reflected",async()=>{
 const f=await setup(),server=createDemoAndroidCalendarServer({db,auth});
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{
  const url="http://127.0.0.1:"+server.address().port+"/api/owner-calendar";
  const post=async(body)=>{const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
  const query={businessId:f.id,date:"2026-11-10",ownerToken:f.ownerToken};
  let r=await post(query);assert.equal(r.status,200);assert.equal(r.data.appointments.length,0);
  const journey=createDemoJourney({db,auth});
  const request={businessId:f.id,serviceId:"cut",staffId:"barber",startAt:"2026-11-10T10:00:00.000Z",idempotencyKey:"phase1114_key",customerAccessToken:f.customerToken};
  const booking=await journey.book(request);
  await journey.book(request);
  r=await post(query);assert.equal(r.status,200);assert.equal(r.data.appointments.length,1);
  assert.equal(r.data.appointments[0].id,booking.bookingId);
  assert.equal(r.data.appointments[0].status,"confirmed");
  assert.equal(r.data.appointments[0].source,"demo_customer_web");
  assert.equal((await post({...query,ownerToken:f.otherToken})).status,403);
  assert.equal((await post({...query,ownerToken:f.customerToken})).status,403);
  assert.equal((await post({...query,businessId:"salonbook-pro-ad5ff"})).status,403);
  await f.business.collection("bookings").doc(booking.bookingId).update({status:"cancelled"});
  r=await post(query);assert.equal(r.status,200);assert.equal(r.data.appointments.length,1);
  assert.equal(r.data.appointments[0].status,"cancelled");
  r=await post({...query,date:"2026-11-11"});assert.equal(r.status,200);assert.equal(r.data.appointments.length,0);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
