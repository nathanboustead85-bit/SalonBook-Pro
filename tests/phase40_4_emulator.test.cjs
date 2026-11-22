"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {initializeTestEnvironment,assertFails}=require("@firebase/rules-unit-testing");
const {doc,setDoc,getDoc,runTransaction}=require("firebase/firestore");
const {paths}=require("../web/phase34/android-firestore-map-34-2");
const {createUnifiedSession}=require("../web/phase39/unified-session-39-2");
const {createDashboardViewModel}=require("../web/phase39/dashboard-view-model-39-3");
const {createSecureRecovery}=require("../web/phase40/secure-recovery-40-4");
const PROJECT="demo-boustio-phase40-4";
if(process.env.GCLOUD_PROJECT!==PROJECT||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:18080"||process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:19099")throw Error("isolated_emulators_required");
let env;const now=Date.now(),uid="owner40secure",other="other40secure",p=paths(uid);
const user=id=>({uid:id,emailVerified:true,async getIdTokenResult(){return {claims:{user_id:id,email_verified:true},expirationTime:new Date(now+600000).toISOString()}}});
test.before(async()=>{env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:"127.0.0.1",port:18080,rules:fs.readFileSync("firestore.rules","utf8")}});await env.withSecurityRulesDisabled(async c=>{const db=c.firestore(),updatedAt=new Date(now-1000);await setDoc(doc(db,p.profile),{businessId:uid,name:"Isolated Secure Salon",schemaVersion:1,acceptingBookings:false,updatedAt});await setDoc(doc(db,p.services),{schemaVersion:1,json:JSON.stringify([{id:"cut",name:"Cut",price:"20.00",duration:30}]),updatedAt});await setDoc(doc(db,p.staff),{schemaVersion:1,json:JSON.stringify([{id:"alex",name:"Alex",role:"Barber",serviceIds:["cut"],weeklySchedule:{monday:{open:"09:00",close:"17:00"}},weeklyBreaks:[],timeOff:[]}]),updatedAt})})});
test.after(async()=>{if(env)await env.cleanup()});
function setup(id=uid,verified=true,verifyRevocation=async()=>true){const auth={currentUser:user(uid)},db=env.authenticatedContext(id,{email_verified:verified}).firestore();const vm=createDashboardViewModel({session:createUnifiedSession({auth,db,doc,runTransaction,now:()=>now})});return {auth,guard:createSecureRecovery({auth,viewModel:vm,verifyRevocation,now:()=>now})}}
test("verified owner reads synthetic dashboard only after trusted verification",async()=>{const {guard}=setup();assert.equal((await guard.refresh()).state,"READY");guard.stop()});
test("revocation failure clears previously visible synthetic dashboard",async()=>{let allowed=true;const {guard}=setup(uid,true,async()=>allowed);assert.equal((await guard.refresh()).state,"READY");allowed=false;assert.equal((await guard.refresh()).state,"UNAVAILABLE");assert.equal(guard.snapshot().business,null);guard.stop()});
test("cross-owner and unverified emulator identities fail closed",async()=>{for(const [id,verified] of [[other,true],[uid,false]]){const {guard}=setup(id,verified);assert.equal((await guard.refresh()).state,"UNAVAILABLE");guard.stop()}});
test("direct cross-owner and unverified Firestore reads denied",async()=>{for(const [id,verified] of [[other,true],[uid,false]]){const db=env.authenticatedContext(id,{email_verified:verified}).firestore();for(const key of Object.values(p))await assertFails(getDoc(doc(db,key)))}});
