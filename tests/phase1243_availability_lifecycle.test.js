"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const admin=require("../functions/node_modules/firebase-admin");
const {initializeTestEnvironment,assertSucceeds,assertFails}=
 require("../functions/node_modules/@firebase/rules-unit-testing");
const {SAMPLE}=require("../web/phase1238/availabilityPreview");
const {reconcile,scope,TTL}=require("../functions/phase1243AvailabilityLifecycle");
const projectId="demo-boustio-phase1243",emulatorHost="127.0.0.1:8080",businessId="demo-owner";
if(process.env.GCLOUD_PROJECT!==projectId||process.env.FIRESTORE_EMULATOR_HOST!==emulatorHost)
 throw Error("REFUSING: emulator-only test");
admin.initializeApp({projectId});const db=admin.firestore();
const root=db.collection("phase1243Private").doc(businessId);
const pub=db.collection("phase1243PublicAvailability").doc(businessId);
const profile={businessId,name:"Demo Salon",slug:"demo-salon",published:true,
 acceptingBookings:false,schemaVersion:1,phone:"SECRET PHONE"};
const args={projectId,emulatorHost,businessId,date:"2026-11-20"};
const base=Date.now(),run=(delta)=>reconcile(db,{...args,generatedAt:base+delta});
async function seed(){
 const data={profile,services:{items:SAMPLE.services},
 staff:{items:SAMPLE.staff.map(({workingHours,...rest})=>({...rest,workingHoursJson:JSON.stringify(workingHours)}))},
 appointments:{items:SAMPLE.appointments.map(a=>({...a,customerName:"SECRET CLIENT"}))}};
 for(const [k,v] of Object.entries(data))await root.collection("source").doc(k).set(v);
}
async function main(){
 const env=await initializeTestEnvironment({projectId,firestore:{host:"127.0.0.1",port:8080,
 rules:fs.readFileSync("tests/phase1243.firestore.rules","utf8")}});
 try{
  assert.throws(()=>scope({...args,projectId:"salonbook-pro-ad5ff"}),/REFUSING/);
  console.log("PASS production project rejected");
  assert.equal((await run(0)).status,"NOT_PUBLISHED");
  console.log("PASS absent source not published");
  await seed();
  assert.equal((await run(1)).status,"PUBLISHED");
  const guest=env.unauthenticatedContext().firestore();
  const published=await assertSucceeds(guest.doc(pub.path).get());
  assert.equal(published.data().bookingEnabled,false);
  assert.equal(JSON.stringify(published.data()).includes("SECRET"),false);
  console.log("PASS private source published without customer information");
  assert.equal(published.data().expiresAt.toMillis(),base+1+TTL);
  console.log("PASS publication has fixed short expiry");
  await assertFails(guest.doc(pub.path).update({bookingEnabled:true}));
  await assertFails(guest.doc(root.collection("source").doc("profile").path).get());
  console.log("PASS client write and private reads denied");
  await root.collection("source").doc("profile").set({...profile,published:false});
  assert.equal((await run(2)).status,"WITHDRAWN");
  await assertFails(guest.doc(pub.path).get());
  console.log("PASS unpublishing removes previously visible snapshot");
  assert.equal((await run(1)).status,"SKIPPED_STALE");
  assert.equal((await pub.get()).exists,false);
  console.log("PASS older publisher cannot resurrect withdrawn snapshot");
  await root.collection("source").doc("profile").set(profile);
  assert.equal((await run(3)).status,"PUBLISHED");
  console.log("PASS republishing creates new safe snapshot");
  await root.collection("source").doc("appointments").delete();
  assert.equal((await run(4)).status,"WITHDRAWN");
  await assertFails(guest.doc(pub.path).get());
  console.log("PASS missing private appointments withdraws existing snapshot");
  assert.equal((await run(3)).status,"SKIPPED_STALE");
  console.log("PASS stale worker blocked after missing-data withdrawal");
  await seed();
  assert.equal((await run(5)).status,"PUBLISHED");
  // Force an already-expired record using trusted Admin, then prove rules deny access.
  await pub.update({expiresAt:new Date(Date.now()-60000)});
  await assertFails(guest.doc(pub.path).get());
  console.log("PASS Firestore rules deny expired public snapshot");
  await assertFails(guest.collection("phase1243PublicAvailability").get());
  console.log("PASS public listing remains denied");
 }finally{await env.cleanup();await admin.app().delete()}
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
