"use strict";
// Phase 26.2: emulator-only Firestore access matrix; no production credentials or writes.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {initializeTestEnvironment,assertFails,assertSucceeds}=require("@firebase/rules-unit-testing");
const {doc,getDoc,setDoc,deleteDoc,getDocs,collection,serverTimestamp}=require("firebase/firestore");
if(process.env.GCLOUD_PROJECT!=="demo-boustio-phase26"||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080"||process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9099")throw Error("Isolated Phase 26 emulator environment required");
let env;const owner="audit-owner-a",other="audit-owner-b";
const db=(uid,verified=true)=>uid?env.authenticatedContext(uid,{email_verified:verified}).firestore():env.unauthenticatedContext().firestore();
const ref=(d,p)=>doc(d,p);
const paths={
 backup:`users/${owner}/backups/latest`,
 live:`users/${owner}/liveData/bookings`,
 profile:`users/${owner}/business/profile`,
 client:`users/${owner}/clientProfiles/${"a".repeat(64)}`,
 appointment:`businesses/${owner}/appointments/appt1`,
 mode:`businesses/${owner}/settings/bookingMode`,
 migration:`businesses/${owner}/migrations/android-bookings-v1`,
 locks:`businesses/${owner}/bookingLocks/lock1`,
 conversation:`businesses/${owner}/conversations/convo1`,
 message:`businesses/${owner}/conversations/convo1/messages/msg1`,
 reservation:`users/${owner}/customerBookingReservations/res1`,
 request:`users/${owner}/customerBookingRequests/req1`,
 guard:`businesses/${owner}/customerBookingGuards/guard1`,
 onboarding:`users/${owner}/onboardingDrafts/draft1`,
 completion:`users/${owner}/onboardingCompletion/marker1`,
 public:"publicBusinesses/audit-public"
};
test.before(async()=>{
 env=await initializeTestEnvironment({projectId:"demo-boustio-phase26",firestore:{host:"127.0.0.1",port:8080,rules:fs.readFileSync(path.resolve("firestore.rules"),"utf8")}});
 await env.withSecurityRulesDisabled(async context=>{
  const d=context.firestore();
  for(const [key,p] of Object.entries(paths)){
   const data=key==="public"?{published:true,name:"Synthetic Public"}:key==="mode"?{mode:"frozen"}:{audit:true};
   await setDoc(ref(d,p),data);
  }
 });
});
test.after(async()=>{await env?.cleanup();});
for(const key of ["backup","live","profile","client","appointment","mode","conversation","message"]){
 test(`Anonymous denied private read: ${key}`,async()=>assertFails(getDoc(ref(db(),paths[key]))));
 test(`Cross-owner denied private read: ${key}`,async()=>assertFails(getDoc(ref(db(other),paths[key]))));
}
for(const key of ["live","profile","client","appointment","mode","conversation","message"]){
 test(`Unverified owner denied private read: ${key}`,async()=>assertFails(getDoc(ref(db(owner,false),paths[key]))));
}
for(const key of ["backup","live","profile","client","appointment","mode","conversation","message"]){
 test(`Owner allowed private read: ${key}`,async()=>assertSucceeds(getDoc(ref(db(owner),paths[key]))));
}
test("Legacy backup permits own unverified access (documented risk)",async()=>assertSucceeds(getDoc(ref(db(owner,false),paths.backup))));
for(const key of ["appointment","mode","migration","locks","conversation","message","reservation","request","guard","onboarding","completion"]){
 test(`Owner cannot write server-only collection: ${key}`,async()=>assertFails(setDoc(ref(db(owner),paths[key]),{audit:true})));
}
for(const key of ["reservation","request","guard","onboarding","completion","migration","locks"]){
 test(`Owner cannot read server-only collection: ${key}`,async()=>assertFails(getDoc(ref(db(owner),paths[key]))));
}
for(const key of ["appointment","conversation","message","reservation","request","guard","onboarding","completion"]){
 test(`Anonymous cannot create: ${key}`,async()=>assertFails(setDoc(ref(db(),paths[key]),{audit:true})));
}
test("Cross-owner cannot modify business profile",async()=>assertFails(setDoc(ref(db(other),paths.profile),{businessId:other})));
test("Unverified owner cannot modify business profile",async()=>assertFails(setDoc(ref(db(owner,false),paths.profile),{businessId:owner})));
test("Owner cannot enable acceptingBookings in business profile",async()=>assertFails(setDoc(ref(db(owner),paths.profile),{businessId:owner,acceptingBookings:true})));
test("Booking-mode frozen prevents legacy liveData booking write",async()=>assertFails(setDoc(ref(db(owner),paths.live),{json:"[]",schemaVersion:1,updatedAt:serverTimestamp()})));
test("Owner cannot delete liveData",async()=>assertFails(deleteDoc(ref(db(owner),paths.live))));
test("Public published business get allowed",async()=>assertSucceeds(getDoc(ref(db(),paths.public))));
test("Public business directory list denied",async()=>assertFails(getDocs(collection(db(),"publicBusinesses"))));
test("Public publishing client write denied",async()=>assertFails(setDoc(ref(db(owner),paths.public),{published:true})));
test("Public unpublish client delete denied",async()=>assertFails(deleteDoc(ref(db(owner),paths.public))));
test("Default unknown collection denies access",async()=>assertFails(getDoc(ref(db(owner),"unknownAudit/doc1"))));
