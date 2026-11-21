"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {initializeTestEnvironment,assertFails}=require("@firebase/rules-unit-testing");
const {doc,setDoc,getDoc,runTransaction}=require("firebase/firestore");
const {initializeApp,deleteApp}=require("firebase/app");
const {getAuth,connectAuthEmulator,createUserWithEmailAndPassword,signOut,getIdTokenResult,reload}=require("firebase/auth");
const {createVerifiedOwnerSession}=require("../web/phase36/verified-owner-session-36-2");
const {paths}=require("../web/phase34/android-firestore-map-34-2");
const PROJECT="demo-boustio-phase36-2";
if(process.env.GCLOUD_PROJECT!==PROJECT||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:18080"||process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:19099")throw Error("isolated_auth_firestore_emulators_required");
const now=Date.now(),updatedAt=new Date(now-1000);
let env,app,auth,owner,other;
const p=uid=>paths(uid);
const seed=async(uid,name)=>env.withSecurityRulesDisabled(async c=>{const db=c.firestore(),q=p(uid);await setDoc(doc(db,q.profile),{businessId:uid,name,slug:"demo-"+uid,category:"barber",email:"",phone:"",address:"",description:"",acceptingBookings:false,schemaVersion:1,updatedAt});await setDoc(doc(db,q.services),{json:JSON.stringify([{id:"cut",name:"Haircut",price:"20.00",duration:30,publicVisible:true}]),schemaVersion:1,updatedAt});await setDoc(doc(db,q.staff),{json:JSON.stringify([{id:"alex",name:"Alex",role:"Barber",serviceIds:["cut"],weeklySchedule:{},weeklyBreaks:[],timeOff:[],publicVisible:true}]),schemaVersion:1,updatedAt})});
const context=(uid,verified)=>env.authenticatedContext(uid,{email_verified:verified}).firestore();
const bridge=(db=context(owner.uid,true),sdkAuth=auth)=>createVerifiedOwnerSession({auth:sdkAuth,db,doc,runTransaction,getIdTokenResult});
async function verifyInAuthEmulator(user){
 // Firebase Auth emulator privileged admin API; localhost demo project only.
 // The regular Identity Toolkit accounts:update endpoint does not elevate emailVerified.
 const response=await fetch("http://127.0.0.1:19099/emulator/v1/projects/"+PROJECT+"/accounts",{
  method:"PATCH",headers:{"content-type":"application/json"},
  body:JSON.stringify({emailVerified:true})
 });
 assert.equal(response.status,200,"emulator verification update failed: "+await response.text().catch(()=>""));
 await reload(user);
 const token=await getIdTokenResult(user,true);
 assert.equal(user.emailVerified,true,"emulator account must be verified");
 assert.equal(token.claims.email_verified,true,"refreshed token must reflect verification");
}
test.before(async()=>{
 env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:"127.0.0.1",port:18080,rules:fs.readFileSync("firestore.rules","utf8")}});
 app=initializeApp({apiKey:"fake-api-key",projectId:PROJECT,authDomain:"localhost",appId:"phase36-2-test"},"phase36-2-isolated");
 auth=getAuth(app);connectAuthEmulator(auth,"http://127.0.0.1:19099",{disableWarnings:true});
 owner=(await createUserWithEmailAndPassword(auth,"owner36-2@example.test","TestPassword123!")).user;
 await seed(owner.uid,"Kody Blends");await verifyInAuthEmulator(owner);
});
test.after(async()=>{if(auth)await signOut(auth);if(app)await deleteApp(app);if(env)await env.cleanup()});
test("real Auth emulator refreshes verified owner ID token",async()=>{const token=await getIdTokenResult(owner,true);assert.equal(token.claims.email_verified,true);assert.equal(token.claims.user_id,owner.uid)});
test("verified real Auth user plus owner Firestore test context reads actual schema",async()=>{const c=bridge();c.authChanged(owner);const s=await c.refresh(Date.now());assert.equal(s.status,"READ_ONLY_READY");assert.equal(s.data.business.name,"Kody Blends")});
test("unverified Auth user denied before Firestore read",async()=>{const fake={uid:owner.uid,emailVerified:false};const sdk={currentUser:fake};let calls=0;const c=createVerifiedOwnerSession({auth:sdk,db:context(owner.uid,true),doc,runTransaction:async()=>{calls++},getIdTokenResult:async()=>({claims:{user_id:owner.uid,email_verified:false},expirationTime:new Date(now+600000).toISOString()})});c.authChanged(fake);assert.equal((await c.refresh(now)).status,"UNAVAILABLE");assert.equal(calls,0)});
test("wrong token uid denied before Firestore read",async()=>{const fake={uid:owner.uid,emailVerified:true};let calls=0;const c=createVerifiedOwnerSession({auth:{currentUser:fake},db:context(owner.uid,true),doc,runTransaction:async()=>{calls++},getIdTokenResult:async()=>({claims:{user_id:"other",email_verified:true},expirationTime:new Date(now+600000).toISOString()})});c.authChanged(fake);assert.equal((await c.refresh(now)).status,"UNAVAILABLE");assert.equal(calls,0)});
test("expired ID token denied before Firestore read",async()=>{const fake={uid:owner.uid,emailVerified:true};let calls=0;const c=createVerifiedOwnerSession({auth:{currentUser:fake},db:context(owner.uid,true),doc,runTransaction:async()=>{calls++},getIdTokenResult:async()=>({claims:{user_id:owner.uid,email_verified:true},expirationTime:new Date(now-1).toISOString()})});c.authChanged(fake);assert.equal((await c.refresh(now)).status,"UNAVAILABLE");assert.equal(calls,0)});
test("actual Firestore rules deny unverified owner",async()=>assertFails(getDoc(doc(context(owner.uid,false),p(owner.uid).profile))));
test("actual Firestore rules deny cross-owner",async()=>assertFails(getDoc(doc(context("other",true),p(owner.uid).profile))));
test("real Auth sign-out invalidates session and clears private data",async()=>{const c=bridge();c.authChanged(owner);await c.refresh(Date.now());await signOut(auth);c.authChanged(auth.currentUser);assert.equal(c.snapshot().data,null);assert.equal((await c.refresh(Date.now())).status,"UNAVAILABLE")});
test("account switching clears data and prevents stale session",async()=>{const fake={uid:owner.uid,emailVerified:true},sdk={currentUser:fake};const c=createVerifiedOwnerSession({auth:sdk,db:context(owner.uid,true),doc,runTransaction,getIdTokenResult:async()=>({claims:{user_id:fake.uid,email_verified:true},expirationTime:new Date(now+600000).toISOString()})});c.authChanged(fake);assert.equal((await c.refresh(now)).status,"READ_ONLY_READY");sdk.currentUser={uid:"other",emailVerified:true};c.authChanged(sdk.currentUser);assert.equal(c.snapshot().data,null);assert.equal((await c.refresh(now)).status,"UNAVAILABLE")});
test("token fetch rejection fails closed",async()=>{const fake={uid:owner.uid,emailVerified:true};const c=createVerifiedOwnerSession({auth:{currentUser:fake},db:context(owner.uid,true),doc,runTransaction,getIdTokenResult:async()=>{throw Error("offline")}});c.authChanged(fake);assert.equal((await c.refresh(now)).reason,"token_refresh_failed")});
test("sign-out during pending token refresh discards late token",async()=>{let release;const fake={uid:owner.uid,emailVerified:true};const c=createVerifiedOwnerSession({auth:{currentUser:fake},db:context(owner.uid,true),doc,runTransaction,getIdTokenResult:async()=>new Promise(r=>release=r)});c.authChanged(fake);const pending=c.refresh(now);c.signOut();release({claims:{user_id:owner.uid,email_verified:true},expirationTime:new Date(now+600000).toISOString()});await pending;assert.equal(c.snapshot().data,null)});
test("sign-out during pending transaction discards late result",async()=>{let release;const fake={uid:owner.uid,emailVerified:true};const c=createVerifiedOwnerSession({auth:{currentUser:fake},db:context(owner.uid,true),doc,runTransaction:async(...args)=>{await new Promise(r=>release=r);return runTransaction(...args)},getIdTokenResult:async()=>({claims:{user_id:owner.uid,email_verified:true},expirationTime:new Date(now+600000).toISOString()})});c.authChanged(fake);const pending=c.refresh(now);await new Promise(r=>setImmediate(r));c.signOut();if(release)release();await pending;assert.equal(c.snapshot().data,null)});
test("network outage clears private data",async()=>{const fake={uid:owner.uid,emailVerified:true};const c=createVerifiedOwnerSession({auth:{currentUser:fake},db:context(owner.uid,true),doc,runTransaction,getIdTokenResult:async()=>({claims:{user_id:owner.uid,email_verified:true},expirationTime:new Date(now+600000).toISOString()})});c.authChanged(fake);await c.refresh(now);assert.equal(c.offline().data,null)});
test("never requests booking paths or writes",async()=>{const seen=[];const fake={uid:owner.uid,emailVerified:true};const wrapped=async(db,fn,options)=>runTransaction(db,tx=>fn({get:ref=>{seen.push(ref.path);return tx.get(ref)}}),options);const c=createVerifiedOwnerSession({auth:{currentUser:fake},db:context(owner.uid,true),doc,runTransaction:wrapped,getIdTokenResult:async()=>({claims:{user_id:owner.uid,email_verified:true},expirationTime:new Date(now+600000).toISOString()})});c.authChanged(fake);await c.refresh(now);assert.deepEqual(seen,Object.values(p(owner.uid)))});
test("all states disable live booking and editing",async()=>{const fake={uid:owner.uid,emailVerified:true};const c=createVerifiedOwnerSession({auth:{currentUser:fake},db:context(owner.uid,true),doc,runTransaction,getIdTokenResult:async()=>({claims:{user_id:owner.uid,email_verified:true},expirationTime:new Date(now+600000).toISOString()})});c.authChanged(fake);const s=await c.refresh(now);assert.equal(s.bookingEnabled,false);assert.equal(s.editingEnabled,false)});
test("module does not initialize Firebase or deploy",()=>{const s=fs.readFileSync(require.resolve("../web/phase36/verified-owner-session-36-2"),"utf8");assert.doesNotMatch(s,/initializeApp\(|connectAuthEmulator\(|setDoc\(|deploy\(/)});
