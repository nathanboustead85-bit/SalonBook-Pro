"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const {pathToFileURL}=require("node:url"),path=require("node:path");
const {initializeApp,deleteApp}=require("firebase/app");
const authSdk=require("firebase/auth"),firestoreSdk=require("firebase/firestore");
const {initializeTestEnvironment}=require("@firebase/rules-unit-testing");
const projectId="demo-boustio-phase21";
if(process.env.GCLOUD_PROJECT!==projectId||!process.env.FIREBASE_AUTH_EMULATOR_HOST||!process.env.FIRESTORE_EMULATOR_HOST)
 throw Error("Isolated Phase 21 Auth and Firestore emulators required");
const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(":");
let adapterModule,controllerModule,rules,serial=0;
function client(){
 const app=initializeApp({apiKey:"fake-api-key",projectId,appId:"phase21-2",authDomain:projectId+".firebaseapp.com"},"phase21-2-"+(++serial));
 const auth=authSdk.initializeAuth(app,{persistence:authSdk.inMemoryPersistence});
 const firestore=firestoreSdk.getFirestore(app);
 adapterModule.configureIsolatedFirebaseEmulators({auth,firestore,authSdk,firestoreSdk,projectId,
  authUrl:"http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST,firestoreHost:host,firestorePort:Number(port)});
 const adapter=adapterModule.createFirebaseBrowserSdkAdapter({auth,firestore,authSdk,firestoreSdk,projectId,expectedProjectId:projectId});
 return {app,auth,firestore,adapter};
}
async function close(c){await authSdk.signOut(c.auth);await firestoreSdk.terminate(c.firestore);await deleteApp(c.app);}
async function verified(c){
 const email="phase21-2-"+Date.now()+"-"+serial+"@example.invalid";
 const credential=await authSdk.createUserWithEmailAndPassword(c.auth,email,"EmulatorOnly!12345");
 const base="http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST;
 async function request(endpoint,body){
  const res=await fetch(base+"/identitytoolkit.googleapis.com/v1/"+endpoint+"?key=fake-api-key",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  const data=await res.json();assert.ok(res.ok,JSON.stringify(data));return data;
 }
 await request("accounts:sendOobCode",{requestType:"VERIFY_EMAIL",idToken:await credential.user.getIdToken()});
 const response=await fetch(base+"/emulator/v1/projects/"+projectId+"/oobCodes");
 assert.ok(response.ok);
 const codes=(await response.json()).oobCodes.filter(x=>x.email===email&&x.requestType==="VERIFY_EMAIL");
 assert.equal(codes.length,1);
 await request("accounts:update",{oobCode:codes[0].oobCode});
 await credential.user.reload();await credential.user.getIdToken(true);
 return credential.user.uid;
}
async function seed(uid){
 await rules.withSecurityRulesDisabled(async admin=>firestoreSdk.setDoc(
  firestoreSdk.doc(admin.firestore(),"users",uid,"business","profile"),
  {businessId:uid,name:"Phase 21 synthetic salon",slug:"phase21-synthetic",category:"Hair",
   email:"owner@example.invalid",phone:"",address:"",description:"",acceptingBookings:false,
   schemaVersion:1,updatedAt:new Date()}));
}
async function until(fn,label){
 for(let i=0;i<150;i++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,50));}
 throw Error("Timeout: "+label);
}
test.before(async()=>{
 adapterModule=await import(pathToFileURL(path.resolve("website/business/dashboard/firebase-browser-sdk-adapter.mjs")).href);
 controllerModule=await import(pathToFileURL(path.resolve("website/business/dashboard/session-integration-foundation.mjs")).href);
 rules=await initializeTestEnvironment({projectId,firestore:{host,port:Number(port),rules:fs.readFileSync("firestore.rules","utf8")}});
});
test.after(async()=>{await rules?.cleanup();});
test("Adapter rejects production project and non-loopback emulator endpoints",()=>{
 assert.throws(()=>adapterModule.createFirebaseBrowserSdkAdapter({auth:{app:{options:{projectId:"prod"}}},firestore:{app:{options:{projectId:"prod"}}},authSdk,firestoreSdk,projectId:"prod",expectedProjectId:"prod"}));
 assert.throws(()=>adapterModule.configureIsolatedFirebaseEmulators({auth:{app:{options:{projectId}}},firestore:{app:{options:{projectId}}},authSdk,firestoreSdk,projectId,authUrl:"https://firebase.google.com",firestoreHost:"firebase.google.com",firestorePort:8080}));
});
test("Real modular Firebase SDK adapter loads verified owner then clears profile on sign-out",async()=>{
 const c=client();let controller;
 try{
  const uid=await verified(c);await seed(uid);
  controller=controllerModule.createDashboardSessionController({...c.adapter,onView:()=>{}});
  controller.start(c.auth);
  await until(()=>controller.view.status==="ready","verified owner ready");
  assert.equal(controller.view.profile.businessId,uid);
  await authSdk.signOut(c.auth);
  await until(()=>controller.view.status==="signed-out","signout");
  assert.equal(controller.view.profile,null);
 }finally{controller?.stop();await close(c);}
});
test("Real SDK adapter blocks unverified users from private profile listener",async()=>{
 const c=client();let controller;
 try{
  await authSdk.createUserWithEmailAndPassword(c.auth,"phase21-unverified-"+Date.now()+"-"+serial+"@example.invalid","EmulatorOnly!12345");
  controller=controllerModule.createDashboardSessionController({...c.adapter,onView:()=>{}});
  controller.start(c.auth);
  await until(()=>controller.view.status==="unverified","unverified");
  assert.equal(controller.view.profile,null);
 }finally{controller?.stop();await close(c);}
});
test("Real SDK adapter cannot read another verified owner's profile",async()=>{
 const a=client(),b=client();
 try{
  const uidA=await verified(a),uidB=await verified(b);await seed(uidA);await seed(uidB);
  assert.equal((await firestoreSdk.getDoc(a.adapter.doc(uidA))).exists(),true);
  await assert.rejects(firestoreSdk.getDoc(a.adapter.doc(uidB)),error=>error.code==="permission-denied");
 }finally{await close(a);await close(b);}
});
