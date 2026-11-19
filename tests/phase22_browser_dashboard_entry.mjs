// Phase 22.2: isolated Chromium harness only. Never imported by deployed pages.
import {initializeApp} from "firebase/app";
import * as authSdk from "firebase/auth";
import * as firestoreSdk from "firebase/firestore";
import {configureIsolatedFirebaseEmulators} from "../website/business/dashboard/firebase-browser-sdk-adapter.mjs";
import {createBusinessDashboardFirebaseFoundation} from "../website/business/dashboard/firebase-integration-foundation.mjs";
const projectId="demo-boustio-phase21";
const app=initializeApp({apiKey:"fake-api-key",projectId,appId:"phase22-2-browser",authDomain:projectId+".firebaseapp.com"});
const auth=authSdk.getAuth(app),firestore=firestoreSdk.getFirestore(app);
configureIsolatedFirebaseEmulators({auth,firestore,authSdk,firestoreSdk,projectId,
 authUrl:"http://127.0.0.1:9099",firestoreHost:"127.0.0.1",firestorePort:8080});
const status=document.getElementById("status"),name=document.getElementById("business-name"),category=document.getElementById("category");
const foundation=createBusinessDashboardFirebaseFoundation({auth,firestore,authSdk,firestoreSdk,projectId,expectedProjectId:projectId,
 onState:state=>{
  status.textContent=state.status;
  name.textContent=state.profile?.name??"";
  category.textContent=state.profile?.category??"";
  document.getElementById("owner").textContent=state.profile?.businessId??"";
  window.__phase22State=state;
 }});
window.__phase22State={status:"initializing",profile:null};
foundation.start();
window.__phase22={
 signIn:(email,password)=>authSdk.signInWithEmailAndPassword(auth,email,password).then(()=>true),
 signOut:()=>authSdk.signOut(auth),
 stop:()=>foundation.stop(),
 getState:()=>foundation.state
};
