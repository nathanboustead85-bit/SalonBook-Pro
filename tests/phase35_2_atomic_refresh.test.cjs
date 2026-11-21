"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {initializeTestEnvironment,assertFails}=require("@firebase/rules-unit-testing");
const {doc,setDoc,runTransaction,getDoc}=require("firebase/firestore");
const {paths}=require("../web/phase34/android-firestore-map-34-2");
const {createRefreshCoordinator}=require("../web/phase35/refresh-coordinator-35-2");
const PROJECT="demo-boustio-phase35-2";
if(process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:18080"||process.env.GCLOUD_PROJECT!==PROJECT)throw Error("isolated_emulator_environment_required");
const p=paths("owner"),now=Date.now(),updatedAt=new Date(now-1000);
const profile={businessId:"owner",name:"Kody Blends",slug:"kody-blends",category:"barber",email:"",phone:"",address:"",description:"",acceptingBookings:false,schemaVersion:1,updatedAt};
const services={json:JSON.stringify([{id:"cut",name:"Haircut",price:"20.00",duration:30,publicVisible:true}]),schemaVersion:1,updatedAt};
const staff={json:JSON.stringify([{id:"alex",name:"Alex",role:"Barber",serviceIds:["cut"],weeklySchedule:{},weeklyBreaks:[],timeOff:[],publicVisible:true}]),schemaVersion:1,updatedAt};
const auth={uid:"owner",emailVerified:true,expiresAt:now+600000};
let env;
test.before(async()=>{env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:"127.0.0.1",port:18080,rules:fs.readFileSync("firestore.rules","utf8")}});await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();await setDoc(doc(d,p.profile),profile);await setDoc(doc(d,p.services),services);await setDoc(doc(d,p.staff),staff)})});
test.after(async()=>{if(env)await env.cleanup()});
const database=(uid="owner",verified=true)=>env.authenticatedContext(uid,{email_verified:verified}).firestore();
function atomicReader(db){
 return async (pathsArg)=>{
  const documents=await runTransaction(db,async tx=>{
   const out={};
   // All three tx.get reads are in one read-only Firestore transaction.
   for(const path of Object.values(pathsArg)){const snap=await tx.get(doc(db,path));if(!snap.exists())throw Error("missing_document");const d=snap.data();out[path]={...d,updatedAt:{seconds:d.updatedAt.seconds,nanoseconds:d.updatedAt.nanoseconds}}}
   return out;
  },{maxAttempts:3});
  return {atomic:true,documents};
 };
}
test("atomic Firestore transaction reads all three actual documents",async()=>{const c=createRefreshCoordinator(atomicReader(database()));const s=await c.refresh(auth,Date.now());assert.equal(s.status,"READ_ONLY_READY");assert.equal(s.data.business.name,"Kody Blends")});
test("read-only transaction does not mutate business documents",async()=>{const db=database(),before=(await getDoc(doc(db,p.profile))).data().name;await createRefreshCoordinator(atomicReader(db)).refresh(auth,Date.now());assert.equal((await getDoc(doc(db,p.profile))).data().name,before)});
test("unverified owner transaction fails closed",async()=>{const c=createRefreshCoordinator(atomicReader(database("owner",false)));assert.equal((await c.refresh(auth,Date.now())).status,"UNAVAILABLE");assert.equal(c.snapshot().data,null)});
test("cross-owner transaction fails closed",async()=>{const c=createRefreshCoordinator(atomicReader(database("other",true)));assert.equal((await c.refresh(auth,Date.now())).status,"UNAVAILABLE")});
test("anonymous read of business profile is denied",async()=>assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),p.profile))));
test("injected sequential reader without atomic proof is denied",async()=>{const c=createRefreshCoordinator(async()=>({atomic:false,documents:{}}));assert.equal((await c.refresh(auth,Date.now())).reason,"atomicity_not_proven")});
test("reader error clears previously ready data",async()=>{let fail=false;const reader=atomicReader(database());const c=createRefreshCoordinator(async (...args)=>{if(fail)throw Error("offline");return reader(...args)});assert.equal((await c.refresh(auth,Date.now())).status,"READ_ONLY_READY");fail=true;assert.equal((await c.refresh(auth,Date.now())).status,"UNAVAILABLE");assert.equal(c.snapshot().data,null)});
test("sign-out during in-flight read discards late success",async()=>{let release;const reader=atomicReader(database());const c=createRefreshCoordinator(async(...args)=>{await new Promise(r=>release=r);return reader(...args)});const pending=c.refresh(auth,Date.now());assert.equal(c.signOut().status,"UNAVAILABLE");release();await pending;assert.equal(c.snapshot().reason,"signed_out");assert.equal(c.snapshot().data,null)});
test("overlapping refresh cannot overwrite newest result",async()=>{let release;let count=0;const reader=atomicReader(database());const c=createRefreshCoordinator(async(...args)=>{count++;if(count===1)await new Promise(r=>release=r);return reader(...args)});const older=c.refresh(auth,Date.now());const newer=await c.refresh(auth,Date.now());assert.equal(newer.status,"READ_ONLY_READY");release();await older;assert.equal(c.snapshot().status,"READ_ONLY_READY")});
test("owner switch discards first owner's pending response",async()=>{let release;const reader=atomicReader(database());const c=createRefreshCoordinator(async(...args)=>{await new Promise(r=>release=r);return reader(...args)});const pending=c.refresh(auth,Date.now());const changed=await c.refresh({...auth,uid:"other",emailVerified:false},Date.now());assert.equal(changed.status,"UNAVAILABLE");release();await pending;assert.equal(c.snapshot().data,null)});
test("expired session is denied before any read",async()=>{let calls=0;const c=createRefreshCoordinator(async()=>{calls++});assert.equal((await c.refresh({...auth,expiresAt:now-1},now)).status,"UNAVAILABLE");assert.equal(calls,0)});
test("unverified session is denied before any read",async()=>{let calls=0;const c=createRefreshCoordinator(async()=>{calls++});assert.equal((await c.refresh({...auth,emailVerified:false},now)).status,"UNAVAILABLE");assert.equal(calls,0)});
test("no booking documents requested in atomic reader",async()=>{const seen=[];const reader=atomicReader(database());const c=createRefreshCoordinator(async(pathsArg,uid)=>{seen.push(...Object.values(pathsArg));return reader(pathsArg,uid)});await c.refresh(auth,Date.now());assert.deepEqual(seen,Object.values(p));assert(seen.every(x=>!x.includes("/bookings")))});
test("no SDK or network dependency in coordinator",()=>{const source=fs.readFileSync(require.resolve("../web/phase35/refresh-coordinator-35-2"),"utf8");assert.doesNotMatch(source,/firebase\/|initializeApp|fetch\s*\(|setDoc\s*\(|deploy\s*\(/)});
