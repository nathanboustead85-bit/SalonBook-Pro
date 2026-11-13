"use strict";
const assert=require("node:assert/strict");
const admin=require("../functions/node_modules/firebase-admin");
const fs=require("node:fs");
const {initializeTestEnvironment,assertSucceeds,assertFails}=
 require("../functions/node_modules/@firebase/rules-unit-testing");
const {SAMPLE}=require("../web/phase1238/availabilityPreview");
const {publishFromTrustedFixtures,validateScope}=
 require("../functions/phase1242TrustedPublisher");
const projectId="demo-boustio-phase1242",host="127.0.0.1:8080";
if(process.env.GCLOUD_PROJECT!==projectId||process.env.FIRESTORE_EMULATOR_HOST!==host)
 throw Error("REFUSING: Phase 12.42 requires isolated emulator");
admin.initializeApp({projectId});const db=admin.firestore();
const owner="demo-owner",root=db.collection("phase1242Private").doc(owner);
const pub=db.collection("phase1241PublicAvailability").doc(owner);
const profile={businessId:owner,name:"Demo Salon",slug:"demo-salon",published:true,
 acceptingBookings:false,schemaVersion:1,phone:"PRIVATE PHONE"};
const input={projectId,emulatorHost:host,businessId:owner,date:"2026-11-20",generatedAt:1000000};
async function seed(){
 for(const [key,data] of Object.entries({profile,services:{items:SAMPLE.services},
 staff:{items:SAMPLE.staff.map(({workingHours,...s})=>({...s,workingHoursJson:JSON.stringify(workingHours)}))},appointments:{items:SAMPLE.appointments.map((a,i)=>({
 ...a,customerName:"PRIVATE CUSTOMER "+i,phone:"PRIVATE PHONE",notes:"SECRET NOTES"
 }))}}))await root.collection("source").doc(key).set(data);
}
async function main(){
 const env=await initializeTestEnvironment({projectId,firestore:{
  host:"127.0.0.1",port:8080,rules:fs.readFileSync("tests/phase1242.firestore.rules","utf8")}});
 try{
  assert.throws(()=>validateScope({...input,projectId:"salonbook-pro-ad5ff"}),/REFUSING/);
  console.log("PASS production project refused");
  assert.throws(()=>validateScope({...input,emulatorHost:"remote:8080"}),/REFUSING/);
  console.log("PASS non-local emulator refused");
  assert.equal((await publishFromTrustedFixtures(db,input)).status,"NOT_PUBLISHED");
  assert.equal((await pub.get()).exists,false);
  console.log("PASS missing private source cannot publish");
  await seed();
  assert.equal((await publishFromTrustedFixtures(db,input)).status,"PUBLISHED");
  console.log("PASS trusted publisher writes sanitized snapshot");
  const guest=env.unauthenticatedContext().firestore();
  const publicDoc=await assertSucceeds(guest.doc(pub.path).get());
  assert.equal(publicDoc.data().bookingEnabled,false);
  assert.equal(publicDoc.data().services.length,2);
  console.log("PASS guest reads published service and availability snapshot");
  const output=JSON.stringify(publicDoc.data());
  for(const secret of ["PRIVATE CUSTOMER","PRIVATE PHONE","SECRET NOTES","customerName","appointments","workingHours"])
   assert.equal(output.includes(secret),false,secret);
  console.log("PASS customer and private source data not leaked");
  assert.equal(publicDoc.data().availability.find(x=>x.serviceId==="cut").times.includes("09:30"),false);
  console.log("PASS occupied times not advertised");
  await assertFails(guest.doc(root.collection("source").doc("appointments").path).get());
  await assertFails(guest.doc(pub.path).update({bookingEnabled:true}));
  await assertFails(guest.collection("phase1241PublicAvailability").get());
  console.log("PASS guests cannot read private data, modify snapshot or list businesses");
  assert.equal((await publishFromTrustedFixtures(db,{...input,generatedAt:999999})).status,"SKIPPED_STALE");
  assert.equal((await pub.get()).get("generatedAt"),1000000);
  console.log("PASS older publisher cannot overwrite newer snapshot");
  await root.collection("source").doc("profile").set({...profile,published:false});
  assert.equal((await publishFromTrustedFixtures(db,{...input,generatedAt:1000001})).status,"NOT_PUBLISHED");
  console.log("PASS unpublished source rejected");
  // No claim of automatic revocation: previously published snapshot remains until
  // an explicit deletion/expiry strategy is implemented.
  assert.equal((await pub.get()).get("generatedAt"),1000000);
  console.log("PASS no accidental mutation after failed publish");
 }finally{await env.cleanup();await admin.app().delete()}
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
