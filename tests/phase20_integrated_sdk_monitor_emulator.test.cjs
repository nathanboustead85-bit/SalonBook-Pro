"use strict";
// Phase 20.9: actual Auth/Firestore SDK events connected to the Phase 20.8 monitor.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {pathToFileURL}=require("node:url");
const {initializeApp,deleteApp}=require("firebase/app");
const {initializeAuth,inMemoryPersistence,connectAuthEmulator,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut,onAuthStateChanged,onIdTokenChanged,getIdTokenResult}=require("firebase/auth");
const {getFirestore,connectFirestoreEmulator,doc,onSnapshot,setDoc,disableNetwork,enableNetwork,terminate}=require("firebase/firestore");
const {initializeTestEnvironment}=require("@firebase/rules-unit-testing");
const projectId=process.env.GCLOUD_PROJECT,authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST,firestoreHost=process.env.FIRESTORE_EMULATOR_HOST;
if(projectId!=="demo-boustio-phase20"||!authHost||!firestoreHost)throw Error("Only demo Firebase emulators are permitted");
const [host,port]=firestoreHost.split(":");
const password="EmulatorOnly!12345";
let env,makeController,makeMonitor,serial=0;
function client(){
 const app=initializeApp({apiKey:"fake-api-key",projectId,appId:"phase20-9",authDomain:projectId+".firebaseapp.com"},"phase20-9-"+(++serial));
 const auth=initializeAuth(app,{persistence:inMemoryPersistence});connectAuthEmulator(auth,"http://"+authHost,{disableWarnings:true});
 const db=getFirestore(app);connectFirestoreEmulator(db,host,Number(port));return {app,auth,db};
}
async function cleanup(c){await terminate(c.db);await signOut(c.auth);await deleteApp(c.app);}
async function api(endpoint,body){
 const response=await fetch("http://"+authHost+"/identitytoolkit.googleapis.com/v1/"+endpoint+"?key=fake-api-key",{
  method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 const data=await response.json();assert.equal(response.ok,true,JSON.stringify(data));return data;
}
async function owner(c,label){
 const email="phase20-9-"+label+"-"+Date.now()+"-"+serial+"@example.invalid";
 const credential=await createUserWithEmailAndPassword(c.auth,email,password);
 await api("accounts:sendOobCode",{requestType:"VERIFY_EMAIL",idToken:await credential.user.getIdToken()});
 const response=await fetch("http://"+authHost+"/emulator/v1/projects/"+projectId+"/oobCodes");
 assert.equal(response.ok,true);const codes=await response.json();
 const matching=codes.oobCodes.filter(x=>x.email===email&&x.requestType==="VERIFY_EMAIL");
 assert.equal(matching.length,1);
 await api("accounts:update",{oobCode:matching[0].oobCode});
 await credential.user.reload();await credential.user.getIdToken(true);
 assert.equal(credential.user.emailVerified,true);return {uid:credential.user.uid,email};
}
async function seed(uid,name){
 await env.withSecurityRulesDisabled(async admin=>setDoc(doc(admin.firestore(),"users/"+uid+"/business/profile"),{
 businessId:uid,name,slug:"phase20-9",category:"Hair",email:"test@example.invalid",
 phone:"",address:"",description:"",acceptingBookings:false,schemaVersion:1,updatedAt:new Date()}));
}
function integrated(c){
 const views=[],statuses=[],listeners=[],timers=new Map();let timerId=0,networkCallback,viewCallback;
 const dashboard=makeController({
  onAuthStateChanged,onIdTokenChanged,getIdTokenResult,
  doc:uid=>doc(c.db,"users/"+uid+"/business/profile"),
  onSnapshot:(ref,next,error)=>{
   const unsubscribe=onSnapshot(ref,{includeMetadataChanges:true},next,error);
   const entry={active:true};listeners.push(entry);
   return()=>{entry.active=false;unsubscribe();};
  },
  onView:view=>{views.push(view);viewCallback?.(view);}
 });
 // Real Auth callbacks are active; the monitor receives actual Firestore listener states.
 dashboard.start(c.auth);
 const monitor=makeMonitor({
  dashboard,getCurrentUser:()=>c.auth.currentUser,
  subscribeConnectivity:fn=>{networkCallback=fn;return()=>{networkCallback=null;};},
  subscribeDashboard:fn=>{viewCallback=fn;return()=>{viewCallback=null;};},
  schedule:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id;},
  cancel:id=>timers.delete(id),
  onStatus:v=>statuses.push(v),maxAttempts:3,baseDelayMs:100,maxDelayMs:400
 });
 monitor.start();
 return {dashboard,monitor,views,statuses,listeners,timers,
  network:online=>networkCallback(online),
  tick(){const first=timers.entries().next().value;assert.ok(first,"Expected retry timer");timers.delete(first[0]);first[1].fn();},
  stop(){monitor.stop();dashboard.stop();}
 };
}
async function until(predicate,label){
 for(let i=0;i<160;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,50));}
 throw Error("Timeout: "+label);
}
test.before(async()=>{
 makeController=(await import(pathToFileURL(path.resolve("website/business/dashboard/session-integration-foundation.mjs")).href)).createDashboardSessionController;
 makeMonitor=(await import(pathToFileURL(path.resolve("website/business/dashboard/connection-monitor-foundation.mjs")).href)).createDashboardConnectionMonitor;
 env=await initializeTestEnvironment({projectId,firestore:{host,port:Number(port),rules:fs.readFileSync("firestore.rules","utf8")}});
});
test.after(async()=>{if(env)await env.cleanup();});
test("Real Firebase offline/online events coordinate monitor and recover server-confirmed owner profile",{timeout:30000},async()=>{
 const c=client();let h;
 try{
  const a=await owner(c,"recovery");await seed(a.uid,"Before outage");
  h=integrated(c);h.network(true);
  await until(()=>h.dashboard.view.status==="ready","initial verified profile");
  assert.equal(h.dashboard.view.profile.name,"Before outage");
  await disableNetwork(c.db);h.network(false);
  assert.equal(h.dashboard.view.profile,null);
  await seed(a.uid,"After outage");
  assert.equal(h.dashboard.view.profile,null);
  await enableNetwork(c.db);h.network(true);
  await until(()=>h.dashboard.view.status==="ready"&&h.dashboard.view.profile.name==="After outage","fresh recovered profile");
  assert.equal(h.monitor.status,"connected");
  assert.equal(h.timers.size,0);
  assert.equal(h.listeners[0].active,false);
 }finally{h?.stop();await cleanup(c);}
});
test("Real Firebase Auth switch during offline period never restores previous owner's profile",{timeout:30000},async()=>{
 const c=client(),other=client();let h;
 try{
  const a=await owner(c,"switch-a"),b=await owner(other,"switch-b");
  await seed(a.uid,"Owner A");await seed(b.uid,"Owner B");
  h=integrated(c);h.network(true);
  await until(()=>h.dashboard.view.status==="ready"&&h.dashboard.view.ownerUid===a.uid,"owner A");
  await disableNetwork(c.db);h.network(false);
  assert.equal(h.dashboard.view.profile,null);
  await signOut(c.auth);
  await signInWithEmailAndPassword(c.auth,b.email,password);
  assert.equal(h.dashboard.view.profile,null);
  await enableNetwork(c.db);h.network(true);
  await until(()=>h.dashboard.view.status==="ready"&&h.dashboard.view.ownerUid===b.uid,"owner B");
  assert.equal(h.dashboard.view.profile.businessId,b.uid);
  assert.equal(h.views.some(v=>v.ownerUid===b.uid&&v.profile?.businessId===a.uid),false);
 }finally{h?.stop();await cleanup(c);await cleanup(other);}
});
test("Repeated offline transitions cancel retry timers and keep private profile hidden",{timeout:30000},async()=>{
 const c=client();let h;
 try{
  const a=await owner(c,"repeat");await seed(a.uid,"Owner A");
  h=integrated(c);h.network(true);
  await until(()=>h.dashboard.view.status==="ready","owner online");
  await disableNetwork(c.db);h.network(false);h.network(false);
  assert.equal(h.timers.size,0);
  assert.equal(h.dashboard.view.profile,null);
  await enableNetwork(c.db);h.network(true);
  await until(()=>h.dashboard.view.status==="ready","recovered");
  assert.equal(h.timers.size,0);
  assert.equal(h.monitor.status,"connected");
 }finally{h?.stop();await cleanup(c);}
});
