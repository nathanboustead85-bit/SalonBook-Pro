"use strict";
// Phase 37.2: bundled browser SDK integration. This entry MUST ONLY run on loopback emulator.
const {initializeApp}=require("firebase/app");
const {getAuth,connectAuthEmulator,onIdTokenChanged,getIdTokenResult,signInWithEmailAndPassword,signOut}=require("firebase/auth");
const {getFirestore,connectFirestoreEmulator,doc,runTransaction}=require("firebase/firestore");
const {createAuditedDashboard}=require("../phase36/final-integration-audit-36-5");
const {createDashboardRenderer}=require("./dashboard-37-1-renderer.mjs");
(async()=>{
 const hostname=window.location.hostname;
 if(!["127.0.0.1","localhost"].includes(hostname))throw Error("phase37_2_loopback_only");
 const app=initializeApp({apiKey:"emulator-only",projectId:"demo-boustio-phase37-2",appId:"isolated-browser-dashboard",authDomain:"localhost"},"phase37-2-browser");
 const auth=getAuth(app),db=getFirestore(app);
 connectAuthEmulator(auth,"http://127.0.0.1:19099",{disableWarnings:true});
 connectFirestoreEmulator(db,"127.0.0.1",18080);
 const session=createAuditedDashboard({auth,db,doc,runTransaction,getIdTokenResult,onIdTokenChanged});
 const renderer=createDashboardRenderer(document);
 let current="SIGNED_OUT",lastUser=null;
 function sync(){
  const s=renderer.sync();current=s.view;
  document.getElementById("login-panel").hidden=!!auth.currentUser;
  document.getElementById("signout").hidden=!auth.currentUser;
  return s;
 }
 renderer.connect(session);sync();
 // The Phase 36 controller does not emit state notifications. Poll only while this local preview is open.
 const interval=setInterval(sync,80);
 window.addEventListener("pagehide",()=>{clearInterval(interval);session.stop()},{once:true});
 window.addEventListener("offline",()=>{session.networkUnavailable();sync()});
 window.addEventListener("online",async()=>{await session.networkRestored();sync()});
 onIdTokenChanged(auth,user=>{if(user!==lastUser){lastUser=user;renderer.render({view:user?"LOADING":"SIGNED_OUT",message:user?"Verifying your account.":"Signed out.",business:null,services:[],staff:[],canBook:false,canEdit:false,canMessage:false,canPay:false})}sync()});
 document.getElementById("login-form").addEventListener("submit",async e=>{
  e.preventDefault();
  const email=document.getElementById("email").value,password=document.getElementById("password").value;
  document.getElementById("password").value="";
  renderer.render({view:"LOADING",message:"Signing in securely.",business:null,services:[],staff:[],canBook:false,canEdit:false,canMessage:false,canPay:false});
  try{await signInWithEmailAndPassword(auth,email,password)}catch{renderer.render({view:"UNAVAILABLE",message:"Sign-in failed.",business:null,services:[],staff:[],canBook:false,canEdit:false,canMessage:false,canPay:false})}
 });
 document.getElementById("signout").addEventListener("click",async()=>{session.networkUnavailable();renderer.render({view:"SIGNED_OUT",message:"Signed out.",business:null,services:[],staff:[],canBook:false,canEdit:false,canMessage:false,canPay:false});await signOut(auth);await session.networkRestored();sync()});
 window.__phase37_2_test=Object.freeze({view:()=>current,signOut:()=>signOut(auth),refresh:()=>session.retry(),networkUnavailable:()=>{session.networkUnavailable();sync()},networkRestored:()=>session.networkRestored()});
})().catch(()=>{document.getElementById("status").textContent="Isolated dashboard unavailable."});
