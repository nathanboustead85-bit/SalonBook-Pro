"use strict";
// Isolated emulator ONLY. Rules tests must not contact a live Firebase project.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {initializeTestEnvironment,assertSucceeds,assertFails}=
 require("../functions/node_modules/@firebase/rules-unit-testing");
const {buildPublicSnapshot,readPublicSnapshot}=
 require("../functions/publicAvailabilityProjection");
const {SAMPLE}=require("../web/phase1238/availabilityPreview");
const projectId="demo-boustio-phase1241";
if(process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080"||
 process.env.GCLOUD_PROJECT!==projectId)
 throw Error("REFUSING: isolated Firestore emulator and demo project required");
const profile={businessId:"demo-owner",name:"Demo Salon",slug:"demo-salon",
 published:true,acceptingBookings:false,schemaVersion:1};
const snap=buildPublicSnapshot({profile,slug:"demo-salon",services:SAMPLE.services,
 staff:SAMPLE.staff,appointments:SAMPLE.appointments,date:"2026-11-20",generatedAt:1000000});
async function main(){
 const env=await initializeTestEnvironment({projectId,firestore:{
 host:"127.0.0.1",port:8080,rules:fs.readFileSync("tests/phase1241.firestore.rules","utf8")}});
 try{
  const pub="phase1241PublicAvailability/demo-owner";
  const privatePath="phase1241Private/demo-owner/appointments/private-booking";
  await env.withSecurityRulesDisabled(async ctx=>{
   await ctx.firestore().doc(pub).set(JSON.parse(JSON.stringify(snap)));
   await ctx.firestore().doc(privatePath).set({customerName:"PRIVATE CUSTOMER",phone:"PRIVATE PHONE"});
  });
  const guest=env.unauthenticatedContext().firestore();
  const owner=env.authenticatedContext("demo-owner",{email_verified:true}).firestore();
  const stranger=env.authenticatedContext("different-owner").firestore();
  const doc=await assertSucceeds(guest.doc(pub).get());
  assert.equal(doc.data().bookingEnabled,false);
  assert.equal(doc.data().availability.length>0,true);
  console.log("PASS anonymous guest reads sanitized public snapshot");
  assert.equal(readPublicSnapshot(doc.data(),{slug:"demo-salon",now:1000100}).status,"READ_ONLY");
  console.log("PASS read-only freshness gate accepts current snapshot");
  assert.equal(readPublicSnapshot(doc.data(),{slug:"demo-salon",now:1400000}).status,"UNAVAILABLE");
  console.log("PASS stale snapshot rejected by client adapter");
  await assertSucceeds(stranger.doc(pub).get());
  console.log("PASS public snapshot readable without owner identity");
  await assertFails(guest.collection("phase1241PublicAvailability").get());
  console.log("PASS public collection listing denied");
  await assertFails(guest.doc(pub).set({status:"PUBLIC_PREVIEW"}));
  await assertFails(owner.doc(pub).update({bookingEnabled:true}));
  await assertFails(owner.doc(pub).delete());
  console.log("PASS guests and owners cannot create update or delete public snapshots");
  await assertFails(guest.doc(privatePath).get());
  await assertFails(owner.doc(privatePath).get());
  console.log("PASS private appointment documents inaccessible to browser clients");
  await env.withSecurityRulesDisabled(async ctx=>{
   await ctx.firestore().doc(pub).set({...JSON.parse(JSON.stringify(snap)),bookingEnabled:true});
  });
  await assertFails(guest.doc(pub).get());
  console.log("PASS incorrectly booking-enabled public document is unreadable");
  await env.withSecurityRulesDisabled(async ctx=>{
   await ctx.firestore().doc(pub).set({...JSON.parse(JSON.stringify(snap)),businessId:"other-owner",bookingEnabled:false});
  });
  await assertFails(guest.doc(pub).get());
  console.log("PASS mismatched public business ID is unreadable");
 }finally{await env.cleanup()}
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
