"use strict";
// Phase 20.7: actual Firestore SDK disableNetwork/enableNetwork against demo emulators.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {pathToFileURL}=require("node:url");
const {initializeApp,deleteApp}=require("firebase/app");
const {initializeAuth,inMemoryPersistence,connectAuthEmulator,createUserWithEmailAndPassword,signOut,onAuthStateChanged,onIdTokenChanged,getIdTokenResult}=require("firebase/auth");
const {getFirestore,connectFirestoreEmulator,doc,setDoc,onSnapshot,disableNetwork,enableNetwork,terminate}=require("firebase/firestore");
const {initializeTestEnvironment}=require("@firebase/rules-unit-testing");
const projectId=process.env.GCLOUD_PROJECT,authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST,firestoreHost=process.env.FIRESTORE_EMULATOR_HOST;
if(projectId!=="demo-boustio-phase20"||!authHost||!firestoreHost)throw Error("Isolated demo emulators required");
const [host,port]=firestoreHost.split(":");
let env,createDashboardSessionController,serial=0;
const password="EmulatorOnly!12345";
function client(){
 const app=initializeApp({apiKey:"fake-api-key",projectId,appId:"phase20-7",authDomain:projectId+".firebaseapp.com"},"phase20-7-"+(++serial));
 const auth=initializeAuth(app,{persistence:inMemoryPersistence});connectAuthEmulator(auth,"http://"+authHost,{disableWarnings:true});
 const db=getFirestore(app);connectFirestoreEmulator(db,host,Number(port));return {app,auth,db};
}
async function cleanup(c){await enableNetwork(c.db).catch(()=>{});await signOut(c.auth);await terminate(c.db);await deleteApp(c.app);}
async function api(endpoint,body){
 const response=await fetch("http://"+authHost+"/identitytoolkit.googleapis.com/v1/"+endpoint+"?key=fake-api-key",{
 method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 const result=await response.json();assert.equal(response.ok,true,JSON.stringify(result));return result;
}
async function owner(c,label){
 const email="phase20-7-"+label+"-"+Date.now()+"-"+serial+"@example.invalid";
 const credential=await createUserWithEmailAndPassword(c.auth,email,password);
 await api("accounts:sendOobCode",{requestType:"VERIFY_EMAIL",idToken:await credential.user.getIdToken()});
 const response=await fetch("http://"+authHost+"/emulator/v1/projects/"+projectId+"/oobCodes");
 assert.equal(response.ok,true);const codes=await response.json();
 const matching=codes.oobCodes.filter(x=>x.email===email&&x.requestType==="VERIFY_EMAIL");
 assert.equal(matching.length,1);
 await api("accounts:update",{oobCode:matching[0].oobCode});
 await credential.user.reload();await credential.user.getIdToken(true);
 assert.equal(credential.user.emailVerified,true);return credential.user.uid;
}
async function seed(uid,name){
 await env.withSecurityRulesDisabled(async admin=>setDoc(doc(admin.firestore(),"users/"+uid+"/business/profile"),{
 businessId:uid,name,slug:"phase20-7",category:"Hair",email:"test@example.invalid",
 phone:"",address:"",description:"",acceptingBookings:false,schemaVersion:1,updatedAt:new Date()}));
}
function dashboard(c){
 const views=[],subs=[];
 const controller=createDashboardSessionController({
  onAuthStateChanged,onIdTokenChanged,getIdTokenResult,
  doc:uid=>doc(c.db,"users/"+uid+"/business/profile"),
  onSnapshot:(ref,success,error)=>{
   const stop=onSnapshot(ref,success,error,{includeMetadataChanges:true});
   const record={active:true};subs.push(record);
   return()=>{record.active=false;stop();};
  },
  onView:v=>views.push(v)
 });controller.start(c.auth);return {controller,views,subs};
}
async function until(fn,label){
 for(let i=0;i<160;i++){if(fn())return;await new Promise(r=>setTimeout(r,50));}
 throw Error("Timeout: "+label);
}
test.before(async()=>{
 createDashboardSessionController=(await import(pathToFileURL(path.resolve("website/business/dashboard/session-integration-foundation.mjs")).href)).createDashboardSessionController;
 env=await initializeTestEnvironment({projectId,firestore:{host,port:Number(port),rules:fs.readFileSync("firestore.rules","utf8")}});
});
test.after(async()=>{if(env)await env.cleanup();});
test("Real SDK disableNetwork hides cached dashboard profile; enableNetwork and fresh listener recover",async()=>{
 const c=client();let d;
 try{
  const uid=await owner(c,"offline");await seed(uid,"Before outage");
  d=dashboard(c);await until(()=>d.controller.view.status==="ready","initial online profile");
  assert.equal(d.controller.view.profile.name,"Before outage");
  await disableNetwork(c.db);
  await until(()=>d.controller.view.status==="interrupted","cached snapshot rejected");
  assert.equal(d.controller.view.profile,null);
  await seed(uid,"After outage");
  assert.equal(d.controller.view.profile,null,"Remote updates cannot leak into offline dashboard");
  d.controller.clear();
  await enableNetwork(c.db);
  assert.equal(d.controller.resume(c.auth.currentUser),true);
  await until(()=>d.controller.view.status==="ready"&&d.controller.view.profile.name==="After outage","fresh post-outage profile");
  assert.equal(d.subs[0].active,false);
 }finally{d?.controller.stop();await cleanup(c);}
});
test("Real SDK offline owner switch clears stale profile and reconnect reads only new owner",async()=>{
 const c=client(),other=client();let d;
 try{
  const a=await owner(c,"switch-a"),b=await owner(other,"switch-b");
  await seed(a,"Owner A");await seed(b,"Owner B");
  d=dashboard(c);await until(()=>d.controller.view.status==="ready","A ready");
  await disableNetwork(c.db);
  await until(()=>d.controller.view.status==="interrupted","A offline");
  d.controller.clear();await signOut(c.auth);
  // Sign in as B while Firestore is disconnected: no old profile can appear.
  const {signInWithEmailAndPassword}=require("firebase/auth");
  const email=other.auth.currentUser.email;
  await signInWithEmailAndPassword(c.auth,email,password);
  assert.equal(d.controller.view.profile,null);
  await enableNetwork(c.db);
  d.controller.clear();d.controller.resume(c.auth.currentUser);
  await until(()=>d.controller.view.status==="ready"&&d.controller.view.ownerUid===b,"B online");
  assert.equal(d.controller.view.profile.name,"Owner B");
  assert.equal(d.views.some(v=>v.ownerUid===b&&v.profile?.businessId===a),false);
 }finally{d?.controller.stop();await cleanup(c);await cleanup(other);}
});
