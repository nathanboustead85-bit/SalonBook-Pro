"use strict";
// Phase 20.2: isolated Auth emulator lifecycle + Firestore rules emulator isolation.
// No production Firebase credentials, live registration, booking writes or deployment.
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {initializeTestEnvironment,assertFails,assertSucceeds}=require("@firebase/rules-unit-testing");
const {doc,getDoc,setDoc}=require("firebase/firestore");
const projectId=process.env.GCLOUD_PROJECT;
const authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost=process.env.FIRESTORE_EMULATOR_HOST;
if(projectId!=="demo-boustio-phase20"||!authHost||!firestoreHost)
 throw new Error("Phase 20.2 requires isolated demo-project Auth and Firestore emulators.");
const [host,port]=firestoreHost.split(":");
const base="http://"+authHost+"/identitytoolkit.googleapis.com/v1/";
async function api(endpoint,body){
 const response=await fetch(base+endpoint+"?key=fake-api-key",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 const result=await response.json();
 if(!response.ok)throw new Error("Auth emulator request failed: "+JSON.stringify(result));
 return result;
}
const password="EmulatorOnly!12345";
async function register(suffix){
 const email="phase20-2-"+suffix+"-"+Date.now()+"@example.invalid";
 return api("accounts:signUp",{email,password,returnSecureToken:true});
}
async function lookup(idToken){
 const result=await api("accounts:lookup",{idToken});
 assert.equal(result.users.length,1);
 return result.users[0];
}
async function refresh(refreshToken){
 const response=await fetch("http://"+authHost+"/securetoken.googleapis.com/v1/token?key=fake-api-key",{
  method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({grant_type:"refresh_token",refresh_token:refreshToken})});
 const result=await response.json();
 assert.equal(response.ok,true,JSON.stringify(result));
 return result;
}
let env;
test.before(async()=>{env=await initializeTestEnvironment({projectId,firestore:{
 host,port:Number(port),rules:fs.readFileSync("firestore.rules","utf8")}});});
test.after(async()=>{if(env)await env.cleanup();});
const context=(uid,verified)=>env.authenticatedContext(uid,{email_verified:verified}).firestore();
const profile=uid=>({businessId:uid,name:"Emulator Salon",slug:"emulator-salon",category:"Hair",
 email:"test@example.invalid",phone:"",address:"",description:"",acceptingBookings:false,
 schemaVersion:1,updatedAt:new Date()});
test("Auth emulator: registration remains unverified until explicit emulator-only verification; refreshed token reflects verification",async()=>{
 const account=await register("verify");
 assert.notEqual((await lookup(account.idToken)).emailVerified,true);
 const before=await refresh(account.refreshToken);
 assert.notEqual((await lookup(before.id_token)).emailVerified,true);
 // Request a verification email through the emulator. The emulator stores
 // the out-of-band code locally instead of sending an actual email.
 await api("accounts:sendOobCode",{requestType:"VERIFY_EMAIL",idToken:account.idToken});
 const oobResponse=await fetch("http://"+authHost+"/emulator/v1/projects/"+projectId+"/oobCodes");
 assert.equal(oobResponse.ok,true,"Auth emulator OOB-code listing must be available");
 const codes=await oobResponse.json();
 const matching=codes.oobCodes.filter(item=>item.email===account.email&&item.requestType==="VERIFY_EMAIL");
 assert.equal(matching.length,1,"Expected exactly one synthetic verification email");
 await api("accounts:update",{oobCode:matching[0].oobCode});
 const after=await refresh(account.refreshToken);
 assert.equal((await lookup(after.id_token)).emailVerified,true);
});
test("Auth emulator: token refresh preserves UID and account switching changes identity",async()=>{
 const first=await register("first"),second=await register("second");
 const refreshed=await refresh(first.refreshToken);
 assert.equal((await lookup(refreshed.id_token)).localId,first.localId);
 assert.equal((await lookup(second.idToken)).localId,second.localId);
 assert.notEqual(first.localId,second.localId);
});
test("Auth emulator: invalid and expired-style sessions fail closed; fresh login recovers",async()=>{
 const account=await register("expiry");
 await assert.rejects(lookup("invalid-expired-token"));
 await assert.rejects(refresh("invalid-expired-refresh-token"));
 const signedIn=await api("accounts:signInWithPassword",{email:(await lookup(account.idToken)).email,password,returnSecureToken:true});
 assert.equal((await lookup(signedIn.idToken)).localId,account.localId);
});
test("Firestore emulator: verified owner isolation and unverified denial across switched accounts",async()=>{
 const a=await register("owner-a"),b=await register("owner-b");
 await env.withSecurityRulesDisabled(async admin=>{
  await setDoc(doc(admin.firestore(),"users/"+a.localId+"/business/profile"),profile(a.localId));
  await setDoc(doc(admin.firestore(),"users/"+b.localId+"/business/profile"),profile(b.localId));
 });
 await assertSucceeds(getDoc(doc(context(a.localId,true),"users/"+a.localId+"/business/profile")));
 await assertSucceeds(getDoc(doc(context(b.localId,true),"users/"+b.localId+"/business/profile")));
 await assertFails(getDoc(doc(context(a.localId,false),"users/"+a.localId+"/business/profile")));
 await assertFails(getDoc(doc(context(a.localId,true),"users/"+b.localId+"/business/profile")));
 await assertFails(getDoc(doc(context(b.localId,true),"users/"+a.localId+"/business/profile")));
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),"users/"+a.localId+"/business/profile")));
 await assertFails(setDoc(doc(context(a.localId,true),"users/"+b.localId+"/business/profile"),profile(b.localId)));
 await assertFails(setDoc(doc(context(a.localId,true),"users/"+a.localId+"/business/profile"),{...profile(a.localId),acceptingBookings:true}));
});
test("Firestore emulator: onboarding, customer booking and booking locks remain server-only",async()=>{
 const a=await register("deny");
 for(const p of ["users/"+a.localId+"/onboardingDrafts/draft",
  "users/"+a.localId+"/onboardingCompletion/marker",
  "users/"+a.localId+"/customerBookingReservations/reservation",
  "users/"+a.localId+"/customerBookingRequests/request",
  "businesses/"+a.localId+"/bookingLocks/lock"]){
  await assertFails(getDoc(doc(context(a.localId,true),p)));
  await assertFails(setDoc(doc(context(a.localId,true),p),{test:true}));
 }
});
