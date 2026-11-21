"use strict";
// Phase 35.1: REAL local Firestore emulator rules evaluation, never production.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {initializeTestEnvironment,assertFails,assertSucceeds}=require("@firebase/rules-unit-testing");
const {doc,getDoc,setDoc,collection,getDocs}=require("firebase/firestore");
const {paths}=require("../web/phase34/android-firestore-map-34-2");
const {validateDocumentFreshness}=require("../web/phase34/document-freshness-34-3");
const PROJECT="demo-boustio-phase35-1";
if(process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:18080"||process.env.GCLOUD_PROJECT!==PROJECT)throw Error("isolated_emulator_environment_required");
const now=Date.now(),timestamp=new Date(now-1000);
const service={id:"cut",name:"Haircut",price:"20.00",duration:30,publicVisible:true};
const staff={id:"alex",name:"Alex",role:"Stylist",serviceIds:["cut"],weeklySchedule:{monday:{open:"09:00",close:"17:00"}},weeklyBreaks:[],timeOff:[],publicVisible:true};
const p=paths("owner");
const seed={
 [p.profile]:{businessId:"owner",name:"Kody Blends",slug:"kody-blends",category:"barber",email:"",phone:"",address:"",description:"",acceptingBookings:false,schemaVersion:1,updatedAt:timestamp},
 [p.services]:{json:JSON.stringify([service]),schemaVersion:1,updatedAt:timestamp},
 [p.staff]:{json:JSON.stringify([staff]),schemaVersion:1,updatedAt:timestamp}
};
let env;
test.before(async()=>{
 env=await initializeTestEnvironment({projectId:PROJECT,firestore:{host:"127.0.0.1",port:18080,rules:fs.readFileSync("firestore.rules","utf8")}});
 await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();for(const [path,data] of Object.entries(seed))await setDoc(doc(db,path),data)});
});
test.after(async()=>{if(env)await env.cleanup()});
const db=(uid,verified)=>env.authenticatedContext(uid,{email_verified:verified}).firestore();
test("verified owner can get all three actual Firestore documents",async()=>{for(const path of Object.values(p))assert.equal((await assertSucceeds(getDoc(doc(db("owner",true),path)))).exists(),true)});
test("owner receives real timestamp and Android envelope fields",async()=>{const snapshot=await assertSucceeds(getDoc(doc(db("owner",true),p.services)));assert.equal(snapshot.data().schemaVersion,1);assert.equal(JSON.parse(snapshot.data().json)[0].name,"Haircut");assert.equal(typeof snapshot.data().updatedAt.seconds,"number")});
test("actual emulator documents map through Phase 34.3 offline validator",async()=>{
 const database=db("owner",true),documents={};
 for(const path of Object.values(p)){const snapshot=await assertSucceeds(getDoc(doc(database,path)));const data=snapshot.data();documents[path]={...data,updatedAt:{seconds:data.updatedAt.seconds,nanoseconds:data.updatedAt.nanoseconds}}}
 const result=validateDocumentFreshness({uid:"owner",emailVerified:true,expiresAt:Date.now()+60000},documents,Date.now(),{consistentRead:true});
 assert.equal(result.status,"FRESH_ANDROID_READ_ONLY");
 // This flag is a test fixture assertion, NOT a proven atomic multi-document snapshot.
});
test("unverified owner denied private profile",async()=>assertFails(getDoc(doc(db("owner",false),p.profile))));
test("unverified owner denied services",async()=>assertFails(getDoc(doc(db("owner",false),p.services))));
test("unverified owner denied staff",async()=>assertFails(getDoc(doc(db("owner",false),p.staff))));
test("other verified owner denied private profile",async()=>assertFails(getDoc(doc(db("other",true),p.profile))));
test("other verified owner denied services",async()=>assertFails(getDoc(doc(db("other",true),p.services))));
test("other verified owner denied staff",async()=>assertFails(getDoc(doc(db("other",true),p.staff))));
test("anonymous user denied private profile",async()=>assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),p.profile))));
test("anonymous user denied services",async()=>assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),p.services))));
test("anonymous user denied staff",async()=>assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),p.staff))));
test("owner cannot list private business documents",async()=>assertFails(getDocs(collection(db("owner",true),"users/owner/business"))));
test("owner can read own bookings under existing legacy rules (known launch blocker)",async()=>{
 // Existing rules allow verified-owner reads of liveData/bookings. Do not claim a universal booking read denial.
 await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),"users/owner/liveData/bookings"),{json:"[]",schemaVersion:1,updatedAt:timestamp}));
 assert.equal((await assertSucceeds(getDoc(doc(db("owner",true),"users/owner/liveData/bookings")))).exists(),true);
});
test("owner cannot read other owner's booking document",async()=>assertFails(getDoc(doc(db("other",true),"users/owner/liveData/bookings"))));
test("owner cannot write protected appointment documents",async()=>assertFails(setDoc(doc(db("owner",true),"businesses/owner/appointments/new"),{foo:"bar"})));
test("owner cannot write customer booking reservations",async()=>assertFails(setDoc(doc(db("owner",true),"users/owner/customerBookingReservations/new"),{foo:"bar"})));
test("owner cannot write customer booking requests",async()=>assertFails(setDoc(doc(db("owner",true),"users/owner/customerBookingRequests/new"),{foo:"bar"})));
test("owner cannot write booking mode settings",async()=>assertFails(setDoc(doc(db("owner",true),"businesses/owner/settings/bookingMode"),{mode:"cloud"})));
test("owner cannot delete private profile",async()=>{const {deleteDoc}=require("firebase/firestore");await assertFails(deleteDoc(doc(db("owner",true),p.profile)))});
test("no production config or deployment is used",()=>{const config=JSON.parse(fs.readFileSync("firebase.phase32-4.json","utf8"));assert.equal(config.emulators.firestore.host,"127.0.0.1");assert.equal(config.emulators.firestore.port,18080);assert.equal(config.emulators.auth.port,19099)});
