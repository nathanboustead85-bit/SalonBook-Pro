"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {initializeTestEnvironment}=require("@firebase/rules-unit-testing");
const {doc,setDoc,runTransaction}=require("firebase/firestore");
const {paths}=require("../web/phase34/android-firestore-map-34-2");
const {createAndroidBusinessReader}=require("../web/phase36/android-business-adapter-36-1");
const {createOwnerAuthorizationGate}=require("../web/phase38/owner-authorization-38-3");
const {createDashboardRecovery}=require("../web/phase38/dashboard-recovery-38-4");
const PROJECT="demo-boustio-phase38-4";
if(process.env.GCLOUD_PROJECT!==PROJECT||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:18080"||process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:19099")throw Error("isolated_emulators_required");
let env;const now=Date.now(),uid="owner38recovery";
test.before(async()=>{env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:"127.0.0.1",port:18080,rules:fs.readFileSync("firestore.rules","utf8")}});const p=paths(uid),updatedAt=new Date(now-1000);await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();await setDoc(doc(db,p.profile),{businessId:uid,name:"Recovery Salon",acceptingBookings:false,schemaVersion:1,updatedAt});await setDoc(doc(db,p.services),{schemaVersion:1,json:JSON.stringify([{id:"cut",name:"Cut",price:"20.00",duration:30}]),updatedAt});await setDoc(doc(db,p.staff),{schemaVersion:1,json:JSON.stringify([{id:"alex",name:"Alex",role:"Barber",serviceIds:["cut"],weeklySchedule:{},weeklyBreaks:[],timeOff:[]}]),updatedAt})})});
test.after(async()=>{if(env)await env.cleanup()});
const auth=()=>({user:{uid,emailVerified:true},token:{claims:{user_id:uid,email_verified:true},expirationTime:new Date(now+600000).toISOString()}});
function setup(verified=true){const db=env.authenticatedContext(uid,{email_verified:verified}).firestore(),gate=createOwnerAuthorizationGate({readAtomic:createAndroidBusinessReader({db,doc,runTransaction}),now:()=>now});return createDashboardRecovery({gate,credentials:async()=>auth()})}
test("emulator owner read recovers safely after network and foreground transitions",async()=>{const c=setup();assert.equal((await c.refresh()).business.name,"Recovery Salon");c.networkUnavailable();assert.equal(c.snapshot().business,null);assert.equal((await c.networkRestored()).business.name,"Recovery Salon");c.background();assert.equal(c.snapshot().business,null);assert.equal((await c.foreground()).business.name,"Recovery Salon");c.signOut();assert.equal(c.snapshot().business,null)});
test("emulator unverified owner is denied even with client-side verified token",async()=>{const c=setup(false);assert.equal((await c.refresh()).status,"UNAVAILABLE");assert.equal(c.snapshot().business,null)});
test("emulator cross-owner context cannot recover private business data",async()=>{const db=env.authenticatedContext("other38",{email_verified:true}).firestore(),gate=createOwnerAuthorizationGate({readAtomic:createAndroidBusinessReader({db,doc,runTransaction}),now:()=>now}),c=createDashboardRecovery({gate,credentials:async()=>auth()});assert.equal((await c.refresh()).status,"UNAVAILABLE");assert.equal(c.snapshot().business,null)});
