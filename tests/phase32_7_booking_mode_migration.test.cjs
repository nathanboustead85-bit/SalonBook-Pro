"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {initializeTestEnvironment,assertSucceeds,assertFails}=require("@firebase/rules-unit-testing");
const {doc,getDoc,setDoc,updateDoc,deleteDoc,Timestamp}=require("firebase/firestore");
const root=path.resolve(__dirname,".."),projectId="demo-boustio-phase32-staging";
const rules=fs.readFileSync(path.join(root,"firestore.rules"),"utf8");
const config=JSON.parse(fs.readFileSync(path.join(root,"firebase.phase32-4.json"),"utf8"));
const payload=()=>({json:"[]",schemaVersion:1,updatedAt:Timestamp.now()});
test("Phase 32.7 real booking mode and migration security",async t=>{
 assert.equal(process.env.GCLOUD_PROJECT,projectId);
 assert.equal(process.env.FIRESTORE_EMULATOR_HOST,"127.0.0.1:18080");
 assert.equal(config.firestore.rules,"firestore.rules");
 assert.equal(config.emulators.firestore.host,"127.0.0.1");
 const env=await initializeTestEnvironment({projectId,firestore:{host:"127.0.0.1",port:18080,rules}});
 t.after(async()=>{await env.cleanup()});
 const cases=[
  {id:"missing-mode",mode:null,migrated:false,allowed:true},
  {id:"explicit-legacy",mode:"legacy",migrated:false,allowed:true},
  {id:"frozen",mode:"frozen",migrated:false,allowed:false},
  {id:"cloud",mode:"cloud",migrated:false,allowed:false},
  {id:"invalid",mode:"invalid",migrated:false,allowed:false},
  {id:"legacy-migrated",mode:"legacy",migrated:true,allowed:false},
  {id:"missing-migrated",mode:null,migrated:true,allowed:false},
  {id:"frozen-migrated",mode:"frozen",migrated:true,allowed:false},
  {id:"cloud-migrated",mode:"cloud",migrated:true,allowed:false}
 ];
 const users=cases.map((c,i)=>({...c,uid:"phase327owner"+i}));
 await env.withSecurityRulesDisabled(async ctx=>{
  const admin=ctx.firestore();
  for(const c of users){
   if(c.mode!==null)await setDoc(doc(admin,"businesses",c.uid,"settings","bookingMode"),{mode:c.mode});
   if(c.migrated)await setDoc(doc(admin,"businesses",c.uid,"migrations","android-bookings-v1"),{completed:true});
   await setDoc(doc(admin,"users",c.uid,"liveData","bookings"),payload());
  }
 });
 for(const c of users){
  await t.test(c.id+" booking writes match existing compatibility policy",async sub=>{
   const verified=env.authenticatedContext(c.uid,{email_verified:true}).firestore();
   const unverified=env.authenticatedContext(c.uid,{email_verified:false}).firestore();
   const foreign=env.authenticatedContext("phase327outsider",{email_verified:true}).firestore();
   const anonymous=env.unauthenticatedContext().firestore();
   const booking=doc(verified,"users",c.uid,"liveData","bookings");
   const service=doc(verified,"users",c.uid,"liveData","services");
   const mode=doc(verified,"businesses",c.uid,"settings","bookingMode");
   const marker=doc(verified,"businesses",c.uid,"migrations","android-bookings-v1");
   const update=()=>setDoc(booking,payload());
   if(c.allowed)await sub.test("verified owner legacy booking update allowed",()=>assertSucceeds(update()));
   else await sub.test("verified owner booking update denied",()=>assertFails(update()));
   await sub.test("unverified owner booking update denied",()=>assertFails(setDoc(doc(unverified,"users",c.uid,"liveData","bookings"),payload())));
   await sub.test("other owner booking update denied",()=>assertFails(setDoc(doc(foreign,"users",c.uid,"liveData","bookings"),payload())));
   await sub.test("anonymous booking update denied",()=>assertFails(setDoc(doc(anonymous,"users",c.uid,"liveData","bookings"),payload())));
   await sub.test("verified owner can read existing bookings",()=>assertSucceeds(getDoc(booking)));
   await sub.test("verified owner cannot delete bookings",()=>assertFails(deleteDoc(booking)));
   await sub.test("services writes unaffected by booking mode",()=>assertSucceeds(setDoc(service,payload())));
   await sub.test("owner cannot create or modify booking mode",()=>assertFails(setDoc(mode,{mode:"legacy"})));
   await sub.test("owner cannot delete booking mode",()=>assertFails(deleteDoc(mode)));
   await sub.test("owner cannot create or modify migration marker",()=>assertFails(setDoc(marker,{completed:false})));
   await sub.test("owner cannot delete migration marker",()=>assertFails(deleteDoc(marker)));
   await sub.test("owner cannot read migration marker",()=>assertFails(getDoc(marker)));
   if(c.mode!==null)await sub.test("verified owner can read own booking mode",()=>assertSucceeds(getDoc(mode)));
   await sub.test("other owner cannot read booking mode",()=>assertFails(getDoc(doc(foreign,"businesses",c.uid,"settings","bookingMode"))));
   await sub.test("unverified owner cannot read booking mode",()=>assertFails(getDoc(doc(unverified,"businesses",c.uid,"settings","bookingMode"))));
  });
 }
 await t.test("malformed booking payload denied even in legacy mode",async()=>{
  const uid=users[1].uid,db=env.authenticatedContext(uid,{email_verified:true}).firestore();
  await assertFails(setDoc(doc(db,"users",uid,"liveData","bookings"),{json:"[]",schemaVersion:2,updatedAt:Timestamp.now()}));
 });
 await t.test("server-only mode transition immediately blocks subsequent legacy uploads",async()=>{
  const uid=users[1].uid,db=env.authenticatedContext(uid,{email_verified:true}).firestore();
  await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),"businesses",uid,"settings","bookingMode"),{mode:"frozen"}));
  await assertFails(setDoc(doc(db,"users",uid,"liveData","bookings"),payload()));
  await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),"businesses",uid,"settings","bookingMode"),{mode:"cloud"}));
  await assertFails(setDoc(doc(db,"users",uid,"liveData","bookings"),payload()));
  await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),"businesses",uid,"settings","bookingMode"),{mode:"legacy"}));
  await assertSucceeds(setDoc(doc(db,"users",uid,"liveData","bookings"),payload()));
  await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),"businesses",uid,"migrations","android-bookings-v1"),{completed:true}));
  await assertFails(setDoc(doc(db,"users",uid,"liveData","bookings"),payload()));
 });
});
