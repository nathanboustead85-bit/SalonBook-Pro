"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {initializeTestEnvironment,assertFails,assertSucceeds}=require("@firebase/rules-unit-testing");
const {doc,setDoc,getDoc,runTransaction}=require("firebase/firestore");
const {initializeApp,deleteApp}=require("firebase/app");
const {getAuth,connectAuthEmulator,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,getIdTokenResult,reload}=require("firebase/auth");
const {createAuthLifecycle}=require("../web/phase35/auth-lifecycle-35-3");
const {paths}=require("../web/phase34/android-firestore-map-34-2");
const PROJECT="demo-boustio-phase35-3";
if(process.env.GCLOUD_PROJECT!==PROJECT||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:18080"||process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:19099")throw Error("isolated_auth_and_firestore_emulators_required");
const now=Date.now(),updatedAt=new Date(now-1000),p=paths("owner");
const seed={
 [p.profile]:{businessId:"owner",name:"Kody Blends",slug:"kody-blends",category:"barber",email:"",phone:"",address:"",description:"",acceptingBookings:false,schemaVersion:1,updatedAt},
 [p.services]:{json:JSON.stringify([{id:"cut",name:"Haircut",price:"20.00",duration:30,publicVisible:true}]),schemaVersion:1,updatedAt},
 [p.staff]:{json:JSON.stringify([{id:"alex",name:"Alex",role:"Barber",serviceIds:["cut"],weeklySchedule:{},weeklyBreaks:[],timeOff:[]}]),schemaVersion:1,updatedAt}
};
let env,app,authSdk;
const owner={uid:"owner",emailVerified:true,expiresAt:now+600000};
test.before(async()=>{
 env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:"127.0.0.1",port:18080,rules:fs.readFileSync("firestore.rules","utf8")}});
 await env.withSecurityRulesDisabled(async c=>{for(const [path,data] of Object.entries(seed))await setDoc(doc(c.firestore(),path),data)});
 app=initializeApp({apiKey:"fake-api-key",authDomain:"localhost",projectId:PROJECT,appId:"phase35-3-test"},"phase35-3-isolated");
 authSdk=getAuth(app);connectAuthEmulator(authSdk,"http://127.0.0.1:19099",{disableWarnings:true});
});
test.after(async()=>{if(authSdk)await signOut(authSdk);if(app)await deleteApp(app);if(env)await env.cleanup()});
const db=(uid="owner",verified=true)=>env.authenticatedContext(uid,{email_verified:verified}).firestore();
function reader(database=db()){
 return async pths=>({atomic:true,documents:await runTransaction(database,async tx=>{
  const result={};
  for(const path of Object.values(pths)){const snap=await tx.get(doc(database,path));if(!snap.exists())throw Error("missing");const data=snap.data();result[path]={...data,updatedAt:{seconds:data.updatedAt.seconds,nanoseconds:data.updatedAt.nanoseconds}}}
  return result;
 },{maxAttempts:3})});
}
test("real Auth emulator creates user and signs in",async()=>{
 const email="owner35-3@example.test",password="SafeTestPassword123!";
 const created=await createUserWithEmailAndPassword(authSdk,email,password);
 assert.equal(created.user.emailVerified,false);
 await signOut(authSdk);
 const signed=await signInWithEmailAndPassword(authSdk,email,password);
 assert.equal(signed.user.email,email);
 const token=await getIdTokenResult(signed.user);assert.equal(token.claims.email_verified,false);
});
test("real Auth emulator token starts unverified; private Firestore rules deny",async()=>{await assertFails(getDoc(doc(db("owner",false),p.profile)))});
test("verified test auth context reads actual owner profile",async()=>{assert.equal((await assertSucceeds(getDoc(doc(db(),p.profile)))).data().name,"Kody Blends")});
test("real Auth emulator sign-out clears current user",async()=>{await signOut(authSdk);assert.equal(authSdk.currentUser,null)});
test("session begins unavailable and only becomes ready after explicit verified transition",async()=>{const c=createAuthLifecycle(reader());assert.equal(c.snapshot().data,null);c.transition(owner,now);assert.equal((await c.refresh(now)).status,"READ_ONLY_READY")});
test("unverified session denied before reading",async()=>{let calls=0;const c=createAuthLifecycle(async()=>{calls++});c.transition({...owner,emailVerified:false},now);assert.equal((await c.refresh(now)).status,"UNAVAILABLE");assert.equal(calls,0)});
test("expired token denied before reading",async()=>{let calls=0;const c=createAuthLifecycle(async()=>{calls++});c.transition({...owner,expiresAt:now-1},now);assert.equal((await c.refresh(now)).status,"UNAVAILABLE");assert.equal(calls,0)});
test("expiry after initial successful refresh clears private data",async()=>{const c=createAuthLifecycle(reader());c.transition({...owner,expiresAt:now+100},now);assert.equal((await c.refresh(now)).status,"READ_ONLY_READY");assert.equal((await c.refresh(now+101)).status,"UNAVAILABLE");assert.equal(c.snapshot().data,null)});
test("sign-out during pending read discards late response",async()=>{let release;const actual=reader();const c=createAuthLifecycle(async (...args)=>{await new Promise(r=>release=r);return actual(...args)});c.transition(owner,now);const pending=c.refresh(now);c.signOut();release();await pending;assert.equal(c.snapshot().reason,"signed_out");assert.equal(c.snapshot().data,null)});
test("account switch during pending read discards old owner's data",async()=>{let release;const actual=reader();const c=createAuthLifecycle(async (...args)=>{await new Promise(r=>release=r);return actual(...args)});c.transition(owner,now);const pending=c.refresh(now);c.transition({...owner,uid:"other"},now);release();await pending;assert.equal(c.snapshot().data,null)});
test("other account cannot read first owner's documents",async()=>assertFails(getDoc(doc(db("other",true),p.profile))));
test("email verification revocation clears previously loaded data",async()=>{const c=createAuthLifecycle(reader());c.transition(owner,now);await c.refresh(now);c.transition({...owner,emailVerified:false},now);assert.equal(c.snapshot().data,null);assert.equal((await c.refresh(now)).status,"UNAVAILABLE")});
test("network interruption clears data and requires explicit new verified session",async()=>{const c=createAuthLifecycle(reader());c.transition(owner,now);await c.refresh(now);c.networkUnavailable();assert.equal(c.snapshot().data,null);assert.equal((await c.refresh(now)).status,"UNAVAILABLE");c.transition(owner,now);assert.equal((await c.refresh(now)).status,"READ_ONLY_READY")});
test("permission denial from emulator fails closed",async()=>{const c=createAuthLifecycle(reader(db("other",true)));c.transition(owner,now);assert.equal((await c.refresh(now)).status,"UNAVAILABLE");assert.equal(c.snapshot().data,null)});
test("atomic reader failure fails closed",async()=>{const c=createAuthLifecycle(async()=>{throw Error("offline")});c.transition(owner,now);assert.equal((await c.refresh(now)).status,"UNAVAILABLE")});
test("all states retain booking and editing disabled",async()=>{const c=createAuthLifecycle(reader());assert.equal(c.snapshot().bookingEnabled,false);c.transition(owner,now);const s=await c.refresh(now);assert.equal(s.bookingEnabled,false);assert.equal(s.editingEnabled,false);assert.equal(c.signOut().bookingEnabled,false)});
test("only three read-only business paths are requested",async()=>{const seen=[];const actual=reader();const c=createAuthLifecycle(async(pths,uid)=>{seen.push(...Object.values(pths));return actual(pths,uid)});c.transition(owner,now);await c.refresh(now);assert.deepEqual(seen,Object.values(p));assert(seen.every(x=>!x.includes("/bookings")))});
test("no Firebase SDK or network in lifecycle coordinator",()=>{const source=fs.readFileSync(require.resolve("../web/phase35/auth-lifecycle-35-3"),"utf8");assert.doesNotMatch(source,/firebase\/|initializeApp|fetch\s*\(|setDoc\s*\(|deploy\s*\(/)});
