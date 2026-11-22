"use strict";
// Phase 37.2: bundled browser SDK integration. This entry MUST ONLY run on loopback emulator.
const {initializeApp}=require("firebase/app");
const {getAuth,connectAuthEmulator,onIdTokenChanged,getIdTokenResult,signInWithEmailAndPassword,signOut}=require("firebase/auth");
const {getFirestore,connectFirestoreEmulator,doc,runTransaction}=require("firebase/firestore");
const {createAuditedDashboard}=require("../phase36/final-integration-audit-36-5");
const {createDashboardRenderer}=require("./dashboard-37-1-renderer.mjs");
const {createSessionGuard}=require("./session-guard-37-4");
(async()=>{
 const hostname=window.location.hostname;
 if(!["127.0.0.1","localhost"].includes(hostname))throw Error("phase37_2_loopback_only");
 const app=initializeApp({apiKey:"emulator-only",projectId:"demo-boustio-phase37-2",appId:"isolated-browser-dashboard",authDomain:"localhost"},"phase37-2-browser");
 const auth=getAuth(app),db=getFirestore(app);
 connectAuthEmulator(auth,"http://127.0.0.1:19099",{disableWarnings:true});
 connectFirestoreEmulator(db,"127.0.0.1",18080);
 const session=createAuditedDashboard({auth,db,doc,runTransaction,getIdTokenResult,onIdTokenChanged});
 const guarded=createSessionGuard({session,auth});
 const renderer=createDashboardRenderer(document);
 let current="SIGNED_OUT",lastUser=null;
 function sync(){
  const s=renderer.sync();current=s.view;
  document.getElementById("login-panel").hidden=!!auth.currentUser;
  document.getElementById("signout").hidden=!auth.currentUser;
  return s;
 }
 renderer.connect(guarded);sync();
 const stopViewSubscription=guarded.subscribe(()=>sync());
 // Phase 37.3: state is delivered by the audited subscription, never by polling.
 window.addEventListener("pagehide",()=>{stopViewSubscription();renderer.disconnect()},{once:true});
 window.addEventListener("offline",()=>{guarded.networkUnavailable();sync()});
 window.addEventListener("online",async()=>{await guarded.networkRestored();sync()});
 onIdTokenChanged(auth,user=>{if(user!==lastUser){lastUser=user;guarded.userChanged(user);if(user)void guarded.networkRestored()}sync()});
 document.getElementById("login-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const email=document.getElementById("email").value,password=document.getElementById("password").value;
  document.getElementById("password").value="";
  renderer.render({view:"LOADING",message:"Signing in securely.",business:null,services:[],staff:[],canBook:false,canEdit:false,canMessage:false,canPay:false});
  try{await signInWithEmailAndPassword(auth,email,password)}catch{renderer.render({view:"UNAVAILABLE",message:"Sign-in failed.",business:null,services:[],staff:[],canBook:false,canEdit:false,canMessage:false,canPay:false})}
 });
 document.getElementById("signout").addEventListener("click",async()=>{guarded.signOut();renderer.render({view:"SIGNED_OUT",message:"Signed out.",business:null,services:[],staff:[],canBook:false,canEdit:false,canMessage:false,canPay:false});await signOut(auth);await guarded.completeSignOut();sync()});
 window.__phase37_2_test=Object.freeze({view:()=>current,signOut:()=>signOut(auth),refresh:()=>guarded.revalidate(),forceTokenRefresh:()=>auth.currentUser?.getIdToken(true),networkUnavailable:()=>{guarded.networkUnavailable();sync()},networkRestored:()=>guarded.networkRestored(),subscriptionMode:"reactive"});
})().catch(()=>{document.getElementById("status").textContent="Isolated dashboard unavailable."});
