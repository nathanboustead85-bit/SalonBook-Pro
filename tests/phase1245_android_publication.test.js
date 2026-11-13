"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const admin=require("../functions/node_modules/firebase-admin");
const {initializeTestEnvironment,assertSucceeds,assertFails}=
 require("../functions/node_modules/@firebase/rules-unit-testing");
const {reconcileAndroid,guard,TTL}=require("../functions/phase1245AndroidPublisher");
const projectId="demo-boustio-phase1245",emulatorHost="127.0.0.1:8080",businessId="demo-owner";
if(process.env.GCLOUD_PROJECT!==projectId||process.env.FIRESTORE_EMULATOR_HOST!==emulatorHost)
 throw Error("REFUSING: isolated emulator required");
admin.initializeApp({projectId});const db=admin.firestore();
const root=db.collection("phase1245Owners").doc(businessId);
const pub=db.collection("phase1245PublicAvailability").doc(businessId);
const profile={businessId,name:"Demo Salon",slug:"demo-salon",published:true,
 acceptingBookings:false,schemaVersion:1,phone:"PRIVATE PHONE"};
const services=[{id:"cut",name:"Haircut",price:"20.00",duration:30,publicVisible:true},
 {id:"hidden",name:"Secret treatment",price:"50",duration:60,publicVisible:false}];
const staff=[{id:"alex",name:"Alex",publicVisible:true,serviceIds:["cut"],
 weeklySchedule:{friday:{open:"09:00",close:"12:00"}},
 weeklyBreaks:[{day:"friday",start:"10:00",end:"10:30",reason:"PRIVATE BREAK"}],
 timeOff:[{date:"2026-11-20",start:"11:00",end:"11:30",reason:"PRIVATE REASON"}]}];
const bookings=[{id:"original-synthetic",client:"PRIVATE CLIENT",notes:"PRIVATE NOTES",
 staffId:"alex",serviceId:"cut",date:"2026-11-20",time:"09:30",duration:30}];
const args={projectId,emulatorHost,businessId,date:"2026-11-20"};
const now=Date.now(),run=delta=>reconcileAndroid(db,{...args,generatedAt:now+delta});
const doc=x=>({json:JSON.stringify(x),schemaVersion:1,updatedAt:new Date()});
async function seed(){
 await root.collection("business").doc("profile").set(profile);
 for(const [key,items] of Object.entries({services,staff,bookings}))
  await root.collection("liveData").doc(key).set(doc(items));
}
async function main(){
 const env=await initializeTestEnvironment({projectId,firestore:{
  host:"127.0.0.1",port:8080,rules:fs.readFileSync("tests/phase1245.firestore.rules","utf8")}});
 try{
  assert.throws(()=>guard({...args,generatedAt:now,projectId:"salonbook-pro-ad5ff"}),/REFUSING/);
  console.log("PASS production Firebase refused");
  assert.equal((await run(0)).status,"NOT_PUBLISHED");
  console.log("PASS missing Android cloud documents fail closed");
  await seed();
  assert.equal((await run(1)).status,"PUBLISHED");
  console.log("PASS Android v1 source published atomically");
  const guest=env.unauthenticatedContext().firestore();
  const snap=await assertSucceeds(guest.doc(pub.path).get());
  assert.equal(snap.data().bookingEnabled,false);
  assert.equal(snap.data().services.length,1);
  assert.equal(snap.data().services[0].pricePence,2000);
  console.log("PASS guest reads public service and price");
  const availability=snap.data().availability.find(x=>x.serviceId==="cut");
  for(const occupied of ["09:30","10:00","11:00"])assert.equal(availability.times.includes(occupied),false);
  console.log("PASS bookings, breaks and time off block customer slots");
  const out=JSON.stringify(snap.data());
  for(const privateText of ["PRIVATE CLIENT","PRIVATE NOTES","PRIVATE PHONE","PRIVATE BREAK","PRIVATE REASON","Secret treatment","bookings","weeklySchedule"])
   assert.equal(out.includes(privateText),false,privateText);
  console.log("PASS customer and private staff details absent");
  assert.equal(snap.data().expiresAt.toMillis(),now+1+TTL);
  console.log("PASS public snapshot expires");
  await assertFails(guest.doc(root.collection("liveData").doc("bookings").path).get());
  await assertFails(guest.doc(pub.path).update({bookingEnabled:true}));
  await assertFails(guest.collection("phase1245PublicAvailability").get());
  console.log("PASS guests cannot read owner bookings, modify or list");
  await root.collection("business").doc("profile").set({...profile,published:false});
  assert.equal((await run(2)).status,"WITHDRAWN");
  await assertFails(guest.doc(pub.path).get());
  console.log("PASS unpublish withdraws public availability");
  assert.equal((await run(1)).status,"SKIPPED_STALE");
  assert.equal((await pub.get()).exists,false);
  console.log("PASS stale job cannot resurrect withdrawn data");
  await root.collection("business").doc("profile").set(profile);
  assert.equal((await run(3)).status,"PUBLISHED");
  console.log("PASS republish restores safe snapshot");
  await root.collection("liveData").doc("bookings").set({json:"broken",schemaVersion:1});
  assert.equal((await run(4)).status,"WITHDRAWN");
  console.log("PASS corrupted Android JSON withdraws public availability");
  await root.collection("liveData").doc("bookings").set(doc(bookings));
  assert.equal((await run(5)).status,"PUBLISHED");
  await pub.update({expiresAt:new Date(Date.now()-60000)});
  await assertFails(guest.doc(pub.path).get());
  console.log("PASS server-side rules block expired snapshot");
  assert.equal((await run(4)).status,"SKIPPED_STALE");
  console.log("PASS generation watermark blocks stale replay");
 }finally{await env.cleanup();await admin.app().delete()}
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
