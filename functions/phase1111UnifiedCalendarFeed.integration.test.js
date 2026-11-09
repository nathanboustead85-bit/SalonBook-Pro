"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),admin=require("firebase-admin");
const {createUnifiedCalendarFeed}=require("./phase1111UnifiedCalendarFeed");
const {createDemoOwnerAuthorizer}=require("./phase116OwnerAuthorizer");
const {createDemoJourney}=require("./phase115DemoJourney");
const PROJECT="demo-boustio-legacy-init";
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST||process.env.GOOGLE_APPLICATION_CREDENTIALS)throw Error("emulator required");
process.env.GCLOUD_PROJECT=PROJECT;process.env.GOOGLE_CLOUD_PROJECT=PROJECT;
if(!admin.apps.length)admin.initializeApp({projectId:PROJECT});
const db=admin.firestore(),auth=admin.auth();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function token(uid){
 const custom=await auth.createCustomToken(uid);
 const r=await fetch("http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST+"/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:custom,returnSecureToken:true})});
 assert.equal(r.status,200);return (await r.json()).idToken;
}
async function setup(){
 const suffix=process.pid+"_"+Math.random().toString(36).slice(2,10),id="demo_unified_"+suffix,owner="owner_"+suffix,customer="customer_"+suffix;
 await auth.createUser({uid:owner,email:owner+"@example.test",emailVerified:true});
 await auth.createUser({uid:customer,email:customer+"@example.test",emailVerified:true});
 const business=db.collection("phase113DemoBusinesses").doc(id);
 await business.set({ownerUid:owner,closures:[]});
 await business.collection("services").doc("cut").set({name:"Cut",durationMinutes:30,active:true});
 await business.collection("staff").doc("barber").set({name:"Barber",active:true,serviceIds:["cut"],weeklyHours:{"2":[{start:540,end:1020}]},breaks:{},holidays:[]});
 return {id,business,ownerToken:await token(owner),customerToken:await token(customer)};
}
async function until(fn){for(let i=0;i<40;i++){if(fn())return;await sleep(100);}throw Error("timed out waiting for Firestore snapshot");}
test("11.11 authenticated emulator website booking updates unified calendar and cancellation",async()=>{
 const f=await setup(),updates=[],errors=[];
 const feed=createUnifiedCalendarFeed({db,authorizeOwner:createDemoOwnerAuthorizer({db,auth})});
 const close=await feed.connect({businessId:f.id,ownerToken:f.ownerToken,date:"2026-11-10",onUpdate:v=>updates.push(v),onError:e=>errors.push(e)});
 await until(()=>updates.length>0);
 const journey=createDemoJourney({db,auth});
 const req={businessId:f.id,serviceId:"cut",staffId:"barber",startAt:"2026-11-10T10:00:00.000Z",idempotencyKey:"unified_1111",customerAccessToken:f.customerToken};
 const booked=await journey.book(req);
 await until(()=>updates.some(v=>v.items.some(a=>a.id===booked.bookingId)));
 await journey.book(req);
 await sleep(150);
 assert.equal(updates.at(-1).items.length,1);
 assert.equal(updates.at(-1).items[0].status,"confirmed");
 await f.business.collection("bookings").doc(booked.bookingId).update({status:"cancelled"});
 await until(()=>updates.at(-1).items[0]?.status==="cancelled");
 assert.equal(errors.length,0);
 close();feed.disconnect();
});
test("11.11 unauthorised customer cannot subscribe to owner calendar",async()=>{
 const f=await setup(),feed=createUnifiedCalendarFeed({db,authorizeOwner:createDemoOwnerAuthorizer({db,auth})});
 await assert.rejects(feed.connect({businessId:f.id,ownerToken:f.customerToken,date:"2026-11-10",onUpdate:()=>{},onError:()=>{}}),/owner access denied/);
 feed.disconnect();
});
test("11.11 closing subscription stops calendar changes",async()=>{
 const f=await setup(),updates=[],feed=createUnifiedCalendarFeed({db,authorizeOwner:createDemoOwnerAuthorizer({db,auth})});
 const close=await feed.connect({businessId:f.id,ownerToken:f.ownerToken,date:"2026-11-10",onUpdate:v=>updates.push(v),onError:()=>{}});
 await until(()=>updates.length>0);
 close();const before=updates.length;
 await f.business.collection("bookings").doc("later").set({startAt:"2026-11-10T10:00:00.000Z",endAt:"2026-11-10T10:30:00.000Z",serviceId:"cut",staffId:"barber",status:"confirmed"});
 await sleep(250);assert.equal(updates.length,before);
 feed.disconnect();
});
