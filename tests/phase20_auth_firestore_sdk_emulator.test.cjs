"use strict";
// Phase 20.3 — actual Firebase Auth SDK credentials passed to Firestore SDK.
// Isolated demo project only. No production credentials or customer booking writes.
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {initializeApp,deleteApp}=require("firebase/app");
const {initializeAuth,inMemoryPersistence,connectAuthEmulator,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut}=require("firebase/auth");
const {getFirestore,connectFirestoreEmulator,doc,getDoc,setDoc,onSnapshot,terminate}=require("firebase/firestore");
const {initializeTestEnvironment}=require("@firebase/rules-unit-testing");
const projectId=process.env.GCLOUD_PROJECT;
const authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost=process.env.FIRESTORE_EMULATOR_HOST;
if(projectId!=="demo-boustio-phase20"||!authHost||!firestoreHost)
 throw Error("Phase 20.3 requires isolated Auth and Firestore emulators");
const [dbHost,dbPort]=firestoreHost.split(":");
const profile=uid=>({businessId:uid,name:"SDK Emulator Salon",slug:"sdk-emulator-salon",
 category:"Hair",email:"test@example.invalid",phone:"",address:"",description:"",
 acceptingBookings:false,schemaVersion:1,updatedAt:new Date()});
let rules;
let serial=0;
function client(){
 const app=initializeApp({apiKey:"fake-api-key",projectId,appId:"phase20-3-test",authDomain:projectId+".firebaseapp.com"},"phase20-3-"+(++serial));
 const auth=initializeAuth(app,{persistence:inMemoryPersistence});
 connectAuthEmulator(auth,"http://"+authHost,{disableWarnings:true});
 const db=getFirestore(app);
 connectFirestoreEmulator(db,dbHost,Number(dbPort));
 return {app,auth,db};
}
async function cleanup(c){await signOut(c.auth);await terminate(c.db);await deleteApp(c.app);}
async function verification(uid,email,token){
 const base="http://"+authHost+"/identitytoolkit.googleapis.com/v1/";
 const req=async(endpoint,body)=>{
  const response=await fetch(base+endpoint+"?key=fake-api-key",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  const data=await response.json();
  assert.equal(response.ok,true,JSON.stringify(data));return data;
 };
 await req("accounts:sendOobCode",{requestType:"VERIFY_EMAIL",idToken:token});
 const response=await fetch("http://"+authHost+"/emulator/v1/projects/"+projectId+"/oobCodes");
 assert.equal(response.ok,true);
 const codes=await response.json();
 const matching=codes.oobCodes.filter(item=>item.email===email&&item.requestType==="VERIFY_EMAIL");
 assert.equal(matching.length,1);
 await req("accounts:update",{oobCode:matching[0].oobCode});
}
async function verifiedUser(c,suffix){
 const email="phase20-3-"+suffix+"-"+Date.now()+"-"+serial+"@example.invalid";
 const credential=await createUserWithEmailAndPassword(c.auth,email,"EmulatorOnly!12345");
 const uid=credential.user.uid;
 assert.equal(credential.user.emailVerified,false);
 await verification(uid,email,await credential.user.getIdToken());
 await credential.user.reload();
 assert.equal(credential.user.emailVerified,true);
 await credential.user.getIdToken(true);
 return {uid,email};
}
async function seed(uid){
 await rules.withSecurityRulesDisabled(async admin=>setDoc(doc(admin.firestore(),"users/"+uid+"/business/profile"),profile(uid)));
}
function permissionDenied(err){return err?.code==="permission-denied";}
function waitForSnapshot(ref){
 return new Promise((resolve,reject)=>{
  let settled=false,unsub=()=>{};
  unsub=onSnapshot(ref,snapshot=>{if(!settled){settled=true;resolve(snapshot);queueMicrotask(()=>unsub());}},
   err=>{if(!settled){settled=true;reject(err);}});
 });
}
// Dashboard preview controller: detach subscriptions and invalidate queued callbacks
// before an account switch/sign-out. Never retain previous owner's profile.
function previewController(){
 let epoch=0,stop=null,profileData=null,owner=null;
 return {
  watch(db,uid,onChange){
   this.clear();
   const current=epoch;owner=uid;
   stop=onSnapshot(doc(db,"users/"+uid+"/business/profile"),
    snapshot=>{if(current!==epoch)return;profileData=snapshot.exists()?snapshot.data():null;onChange(profileData);},
    ()=>{if(current!==epoch)return;profileData=null;onChange(null);});
  },
  clear(){epoch++;if(stop){stop();stop=null;}owner=null;profileData=null;},
  get owner(){return owner;},
  get data(){return profileData;}
 };
}
test.before(async()=>{rules=await initializeTestEnvironment({projectId,firestore:{
 host:dbHost,port:Number(dbPort),rules:fs.readFileSync("firestore.rules","utf8")}});});
test.after(async()=>{if(rules)await rules.cleanup();});
test("Real Auth SDK verified identity authorizes own Firestore profile, not another business",async()=>{
 const a=client(),b=client();
 try{
  const ownerA=await verifiedUser(a,"owner-a");
  const ownerB=await verifiedUser(b,"owner-b");
  await seed(ownerA.uid);await seed(ownerB.uid);
  assert.equal((await getDoc(doc(a.db,"users/"+ownerA.uid+"/business/profile"))).exists(),true);
  assert.equal((await getDoc(doc(b.db,"users/"+ownerB.uid+"/business/profile"))).exists(),true);
  await assert.rejects(getDoc(doc(a.db,"users/"+ownerB.uid+"/business/profile")),permissionDenied);
  await assert.rejects(getDoc(doc(b.db,"users/"+ownerA.uid+"/business/profile")),permissionDenied);
  await assert.rejects(setDoc(doc(a.db,"users/"+ownerB.uid+"/business/profile"),profile(ownerB.uid)),permissionDenied);
  await assert.rejects(setDoc(doc(a.db,"users/"+ownerA.uid+"/business/profile"),{...profile(ownerA.uid),acceptingBookings:true}),permissionDenied);
 }finally{await cleanup(a);await cleanup(b);}
});
test("Real Auth SDK sign-out blocks private Firestore reads and fresh sign-in restores only own access",async()=>{
 const c=client();
 try{
  const owner=await verifiedUser(c,"signout");await seed(owner.uid);
  assert.equal((await getDoc(doc(c.db,"users/"+owner.uid+"/business/profile"))).exists(),true);
  await signOut(c.auth);
  assert.equal(c.auth.currentUser,null);
  await assert.rejects(getDoc(doc(c.db,"users/"+owner.uid+"/business/profile")),permissionDenied);
  await signInWithEmailAndPassword(c.auth,owner.email,"EmulatorOnly!12345");
  assert.equal(c.auth.currentUser.uid,owner.uid);
  assert.equal((await getDoc(doc(c.db,"users/"+owner.uid+"/business/profile"))).exists(),true);
 }finally{await cleanup(c);}
});
test("Real Auth SDK account switch invalidates previous owner's reads and clears stale dashboard listener",async()=>{
 const c=client(),other=client(),dashboard=previewController();
 try{
  const a=await verifiedUser(c,"switch-a");await seed(a.uid);
  const b=await verifiedUser(other,"switch-b");await seed(b.uid);
  const refA=doc(c.db,"users/"+a.uid+"/business/profile");
  assert.equal((await waitForSnapshot(refA)).exists(),true);
  dashboard.watch(c.db,a.uid,()=>{});
  await getDoc(refA);
  dashboard.clear();
  assert.equal(dashboard.owner,null);
  assert.equal(dashboard.data,null);
  await signOut(c.auth);
  await signInWithEmailAndPassword(c.auth,b.email,"EmulatorOnly!12345");
  assert.equal(c.auth.currentUser.uid,b.uid);
  await assert.rejects(getDoc(refA),permissionDenied);
  assert.equal((await getDoc(doc(c.db,"users/"+b.uid+"/business/profile"))).exists(),true);
  assert.equal(dashboard.data,null,"No stale previous-owner profile may be displayed");
  dashboard.watch(c.db,b.uid,()=>{});
  assert.equal(dashboard.owner,b.uid);
  dashboard.clear();
  assert.equal(dashboard.data,null);
 }finally{dashboard.clear();await cleanup(c);await cleanup(other);}
});
