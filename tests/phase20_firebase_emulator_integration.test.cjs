"use strict";
// Runs only inside Firebase Auth + Firestore emulators via firebase emulators:exec.
// Synthetic identities and data only; never touches production or Android bookings.
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,getDoc,setDoc,deleteDoc}=require("firebase/firestore");
const projectId=process.env.GCLOUD_PROJECT||"demo-boustio-phase20";
const host=process.env.FIRESTORE_EMULATOR_HOST;
const authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST;
if(!host||!authHost||!projectId.startsWith("demo-"))throw new Error("Phase 20.1 requires isolated demo-project Auth and Firestore emulators.");
const [firestoreHost,firestorePort]=host.split(":");
let env;
test.before(async()=>{env=await initializeTestEnvironment({
 projectId,firestore:{host:firestoreHost,port:Number(firestorePort),rules:fs.readFileSync("firestore.rules","utf8")}
});});
test.after(async()=>{if(env)await env.cleanup();});
const db=(uid,verified)=>env.authenticatedContext(uid,{email_verified:verified}).firestore();
const anonymous=()=>env.unauthenticatedContext().firestore();
const profile=uid=>({businessId:uid,name:"Test Salon",slug:"test-salon",category:"Hair",email:"test@example.invalid",phone:"",address:"",description:"",acceptingBookings:false,schemaVersion:1,updatedAt:new Date()});
test("Firestore emulator: verified owner can read own private profile; unverified, anonymous and cross-owner denied",async()=>{
 const ref=doc(db("owner-a",true),"users/owner-a/business/profile");
 await env.withSecurityRulesDisabled(async context=>setDoc(doc(context.firestore(),"users/owner-a/business/profile"),profile("owner-a")));
 await assertSucceeds(getDoc(ref));
 await assertFails(getDoc(doc(db("owner-a",false),"users/owner-a/business/profile")));
 await assertFails(getDoc(doc(db("owner-b",true),"users/owner-a/business/profile")));
 await assertFails(getDoc(doc(anonymous(),"users/owner-a/business/profile")));
});
test("Firestore emulator: safe owner profile write allowed; booking enable and cross-owner writes denied",async()=>{
 await assertSucceeds(setDoc(doc(db("owner-c",true),"users/owner-c/business/profile"),profile("owner-c")));
 await assertFails(setDoc(doc(db("owner-c",false),"users/owner-c/business/profile"),profile("owner-c")));
 await assertFails(setDoc(doc(db("owner-b",true),"users/owner-c/business/profile"),profile("owner-c")));
 await assertFails(setDoc(doc(db("owner-c",true),"users/owner-c/business/profile"),{...profile("owner-c"),acceptingBookings:true}));
 await assertFails(deleteDoc(doc(db("owner-c",true),"users/owner-c/business/profile")));
});
test("Firestore emulator: onboarding and customer booking collections deny all client access",async()=>{
 for(const path of ["users/owner-a/onboardingDrafts/draft","users/owner-a/onboardingCompletion/marker",
 "users/owner-a/customerBookingReservations/reservation","users/owner-a/customerBookingRequests/request",
 "businesses/owner-a/bookingLocks/lock","businesses/owner-a/customerBookingGuards/guard"]){
  await assertFails(getDoc(doc(db("owner-a",true),path)));
  await assertFails(setDoc(doc(db("owner-a",true),path),{test:true}));
 }
});
test("Auth emulator: new email/password account signs in, but email remains unverified",async()=>{
 const base="http://"+authHost+"/identitytoolkit.googleapis.com/v1/accounts:";
 const email="phase20-"+Date.now()+"@example.invalid",password="EmulatorTest!123456";
 const request=async(action,body)=>{
  const response=await fetch(base+action+"?key=fake-api-key",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  const data=await response.json();
  assert.equal(response.ok,true,JSON.stringify(data));
  return data;
 };
 const signup=await request("signUp",{email,password,returnSecureToken:true});
 assert.equal(signup.registered,undefined);
 assert.ok(signup.localId);
 const login=await request("signInWithPassword",{email,password,returnSecureToken:true});
 assert.equal(login.localId,signup.localId);
 const lookup=await request("lookup",{idToken:login.idToken});
 assert.equal(lookup.users[0].emailVerified,false);
});