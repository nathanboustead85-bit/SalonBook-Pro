// Phase 21.3: browser-only, synthetic, emulator-only test entrypoint.
// Bundled by esbuild in CI; never imported by the deployed Boustio website.
import {initializeApp} from "firebase/app";
import * as authSdk from "firebase/auth";
import * as firestoreSdk from "firebase/firestore";
import {createFirebaseBrowserSdkAdapter,configureIsolatedFirebaseEmulators} from "../website/business/dashboard/firebase-browser-sdk-adapter.mjs";
import {createDashboardSessionController} from "../website/business/dashboard/session-integration-foundation.mjs";
const projectId="demo-boustio-phase21";
const app=initializeApp({apiKey:"fake-api-key",projectId,appId:"phase21-3-browser",authDomain:projectId+".firebaseapp.com"});
const auth=authSdk.getAuth(app),firestore=firestoreSdk.getFirestore(app);
configureIsolatedFirebaseEmulators({auth,firestore,authSdk,firestoreSdk,projectId,
 authUrl:"http://127.0.0.1:9099",firestoreHost:"127.0.0.1",firestorePort:8080});
const adapter=createFirebaseBrowserSdkAdapter({auth,firestore,authSdk,firestoreSdk,projectId,expectedProjectId:projectId});
const controller=createDashboardSessionController({...adapter,onView:view=>{
 window.__phase21View={status:view.status,ownerUid:view.ownerUid,profile:view.profile?{businessId:view.profile.businessId,name:view.profile.name}:null};
}});
window.__phase21View={status:"initializing",ownerUid:null,profile:null};
controller.start(auth);
window.__phase21={
 signIn:(email,password)=>authSdk.signInWithEmailAndPassword(auth,email,password).then(()=>true),
 signOut:()=>authSdk.signOut(auth),
 currentUid:()=>auth.currentUser?.uid??null,
 stop:()=>controller.stop()
};
