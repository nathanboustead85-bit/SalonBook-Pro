"use strict";
// Phase 20.5: real Firebase SDK + emulator dashboard controller integration.
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {initializeApp,deleteApp}=require("firebase/app");
const {initializeAuth,inMemoryPersistence,connectAuthEmulator,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,onAuthStateChanged,onIdTokenChanged,getIdTokenResult}=require("firebase/auth");
const {getFirestore,connectFirestoreEmulator,doc,onSnapshot,setDoc,terminate}=require("firebase/firestore");
const {initializeTestEnvironment}=require("@firebase/rules-unit-testing");
const projectId=process.env.GCLOUD_PROJECT,authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST,firestoreHost=process.env.FIRESTORE_EMULATOR_HOST;
if(projectId!=="demo-boustio-phase20"||!authHost||!firestoreHost)throw Error("Demo Firebase emulators required");
const [host,port]=firestoreHost.split(":");
let rules,createDashboardSessionController,serial=0;
const password="EmulatorOnly!12345";
function client(){
 const app=initializeApp({apiKey:"fake-api-key",projectId,appId:"phase20-5",authDomain:projectId+".firebaseapp.com"},"phase20-5-"+(++serial));
 const auth=initializeAuth(app,{persistence:inMemoryPersistence});
 connectAuthEmulator(auth,"http://"+authHost,{disableWarnings:true});
 const db=getFirestore(app);connectFirestoreEmulator(db,host,Number(port));
 return {app,auth,db};
}
async function cleanup(c){await signOut(c.auth);await terminate(c.db);await deleteApp(c.app);}
async function api(endpoint,body){
 const response=await fetch("http://"+authHost+"/identitytoolkit.googleapis.com/v1/"+endpoint+"?key=fake-api-key",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 const result=await response.json();assert.equal(response.ok,true,JSON.stringify(result));return result;
}
async function verified(c,suffix){
 const email="phase20-5-"+suffix+"-"+Date.now()+"-"+serial+"@example.invalid";
 const cred=await createUserWithEmailAndPassword(c.auth,email,password);
 await api("accounts:sendOobCode",{requestType:"VERIFY_EMAIL",idToken:await cred.user.getIdToken()});
 const response=await fetch("http://"+authHost+"/emulator/v1/projects/"+projectId+"/oobCodes");
 assert.equal(response.ok,true);
 const codes=await response.json();
 const matches=codes.oobCodes.filter(x=>x.email===email&&x.requestType==="VERIFY_EMAIL");
 assert.equal(matches.length,1);
 await api("accounts:update",{oobCode:matches[0].oobCode});
 await cred.user.reload();await cred.user.getIdToken(true);
 assert.equal(cred.user.emailVerified,true);
 return {uid:cred.user.uid,email};
}
async function seed(uid){
 await rules.withSecurityRulesDisabled(async admin=>setDoc(doc(admin.firestore(),"users/"+uid+"/business/profile"),{
  businessId:uid,name:"Phase 20.5 "+uid,slug:"phase20-5",category:"Hair",email:"test@example.invalid",
  phone:"",address:"",description:"",acceptingBookings:false,schemaVersion:1,updatedAt:new Date()}));
}
function dashboard(c){
 const views=[],unsubs=[];
 const controller=createDashboardSessionController({
  onAuthStateChanged,onIdTokenChanged,getIdTokenResult,
  onSnapshot:(ref,success,error)=>{
   const stop=onSnapshot(ref,{includeMetadataChanges:true},success,error);let active=true;
   const wrapped=()=>{active=false;stop();};
   unsubs.push({get active(){return active;},stop:wrapped});
   return wrapped;
  },
  doc:uid=>doc(c.db,"users/"+uid+"/business/profile"),
  onView:view=>views.push(view)
 });
 controller.start(c.auth);return {controller,views,unsubs};
}
async function until(predicate,label){
 for(let i=0;i<120;i++){
  if(predicate())return;
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 throw Error("Timed out waiting for "+label);
}
test.before(async()=>{
 createDashboardSessionController=(await import(pathToFileURL(path.resolve("website/business/dashboard/session-integration-foundation.mjs")).href)).createDashboardSessionController;
 rules=await initializeTestEnvironment({projectId,firestore:{host,port:Number(port),rules:fs.readFileSync("firestore.rules","utf8")}});
});
test.after(async()=>{if(rules)await rules.cleanup();});
test("Real SDK dashboard: verified owner profile loads; sign-out clears data and listener",async()=>{
 const c=client();let d;
 try{
  const a=await verified(c,"signout");await seed(a.uid);
  d=dashboard(c);
  await until(()=>d.controller.view.status==="ready","owner dashboard ready");
  assert.equal(d.controller.view.ownerUid,a.uid);
  await signOut(c.auth);
  await until(()=>d.controller.view.status==="signed-out","dashboard signed out");
  assert.equal(d.controller.view.profile,null);
  assert.equal(d.unsubs.every(x=>!x.active),true);
 }finally{d?.controller.stop();await cleanup(c);}
});
test("Real SDK dashboard: account switching never shows previous owner's profile",async()=>{
 const c=client(),other=client();let d;
 try{
  const a=await verified(c,"switch-a"),b=await verified(other,"switch-b");
  await seed(a.uid);await seed(b.uid);
  d=dashboard(c);
  await until(()=>d.controller.view.status==="ready","owner A ready");
  await signOut(c.auth);
  await until(()=>d.controller.view.status==="signed-out","owner A signed out");
  await signInWithEmailAndPassword(c.auth,b.email,password);
  await until(()=>d.controller.view.status==="ready"&&d.controller.view.ownerUid===b.uid,"owner B ready");
  assert.equal(d.controller.view.profile.businessId,b.uid);
  const firstB=d.views.findIndex(v=>v.ownerUid===b.uid);
  assert.equal(d.views.slice(firstB).some(v=>v.profile?.businessId===a.uid),false);
  assert.equal(d.unsubs[0].active,false);
 }finally{d?.controller.stop();await cleanup(c);await cleanup(other);}
});
test("Real SDK dashboard: listener teardown and explicit reconnect restore owner-only profile",async()=>{
 const c=client();let d;
 try{
  const a=await verified(c,"reconnect");await seed(a.uid);
  d=dashboard(c);
  await until(()=>d.controller.view.status==="ready","initial ready");
  const first=d.unsubs[0];
  assert.equal(d.controller.reconnect(),true);
  await until(()=>d.unsubs.length>=2&&d.controller.view.status==="ready","reconnected ready");
  assert.equal(first.active,false);
  assert.equal(d.controller.view.profile.businessId,a.uid);
  d.controller.clear();
  assert.equal(d.controller.view.profile,null);
  assert.equal(d.unsubs.every(x=>!x.active),true);
 }finally{d?.controller.stop();await cleanup(c);}
});
test("Real SDK dashboard: unverified account never starts private profile listener",async()=>{
 const c=client();let d;
 try{
  await createUserWithEmailAndPassword(c.auth,"phase20-5-unverified-"+Date.now()+"-"+serial+"@example.invalid",password);
  d=dashboard(c);
  await until(()=>d.controller.view.status==="unverified","unverified blocked");
  assert.equal(d.unsubs.length,0);
  assert.equal(d.controller.view.profile,null);
 }finally{d?.controller.stop();await cleanup(c);}
});
