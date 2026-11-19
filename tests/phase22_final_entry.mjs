// Phase 22.2: isolated Chromium harness only. Never imported by deployed pages.
import {initializeApp} from "firebase/app";
import * as authSdk from "firebase/auth";
import * as firestoreSdk from "firebase/firestore";
import {configureIsolatedFirebaseEmulators} from "../website/business/dashboard/firebase-browser-sdk-adapter.mjs";
import {createBusinessDashboardFirebaseFoundation} from "../website/business/dashboard/firebase-integration-foundation.mjs";
import {createSecureBusinessDashboardInterface} from "../website/business/dashboard/secure-interface-foundation.mjs";
import {createDashboardPreviewNavigation} from "../website/business/dashboard/preview-navigation-foundation.mjs";
import {createDashboardReadOnlySummaries} from "../website/business/dashboard/read-only-availability-foundation.mjs";
import {createReadOnlyBusinessSettings} from "../website/business/dashboard/read-only-profile-settings-foundation.mjs";
import {createServiceStaffEditingFoundation} from "../website/business/dashboard/service-staff-editing-foundation.mjs";
const editing=createServiceStaffEditingFoundation();
const ui=createSecureBusinessDashboardInterface({root:document});
const navigation=createDashboardPreviewNavigation({root:document});
const projectId="demo-boustio-phase21";
const app=initializeApp({apiKey:"fake-api-key",projectId,appId:"phase22-2-browser",authDomain:projectId+".firebaseapp.com"});
const auth=authSdk.getAuth(app),firestore=firestoreSdk.getFirestore(app);
configureIsolatedFirebaseEmulators({auth,firestore,authSdk,firestoreSdk,projectId,
 authUrl:"http://127.0.0.1:9099",firestoreHost:"127.0.0.1",firestorePort:8080});
const summaries=createDashboardReadOnlySummaries({firestore,firestoreSdk,root:document});
const settings=createReadOnlyBusinessSettings({firestore,firestoreSdk,root:document});
let currentOwner=null;

const foundation=createBusinessDashboardFirebaseFoundation({auth,firestore,authSdk,firestoreSdk,projectId,expectedProjectId:projectId,
 onState:state=>{
  ui.render(state);
  if(state.status==="ready"&&state.profile?.businessId===state.ownerUid){
   if(currentOwner!==state.ownerUid){currentOwner=state.ownerUid;summaries.attach(state.ownerUid);settings.attach(state.ownerUid);}
  }else{currentOwner=null;summaries.clear();settings.clear();navigation.reset();}
  window.__phase22State=state;
 }});
window.__phase22State={status:"initializing",profile:null};
foundation.start();
window.__phase22={
 editing,
 signIn:(email,password)=>authSdk.signInWithEmailAndPassword(auth,email,password).then(()=>true),
 signOut:()=>authSdk.signOut(auth),
 stop:()=>{foundation.stop();ui.stop();navigation.stop();summaries.stop();settings.stop();},
 navigate:id=>navigation.navigate(id),
 activeSection:()=>navigation.active,
 getState:()=>foundation.state
};
