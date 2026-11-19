"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const source=fs.readFileSync(path.resolve(__dirname,"../website/business/dashboard/firebase-integration-foundation.mjs"),"utf8");
const importFoundation=()=>import("../website/business/dashboard/firebase-integration-foundation.mjs");
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
function setup(){
 const projectId="demo-boustio-phase21",app={options:{projectId}},auth={app},firestore={app};
 let authListener,tokenListener,snapshotListener,unsubscribed=0;
 const authSdk={
  onAuthStateChanged:(_,fn)=>{authListener=fn;return ()=>{unsubscribed++;};},
  onIdTokenChanged:(_,fn)=>{tokenListener=fn;return ()=>{unsubscribed++;};},
  getIdTokenResult:async user=>({claims:{email_verified:user.verified}})
 };
 const firestoreSdk={
  doc:(_,a,uid,b,c)=>({uid,path:[a,uid,b,c].join("/")}),
  onSnapshot:(_,opts,fn)=>{snapshotListener=fn;return ()=>{unsubscribed++;};}
 };
 const views=[];
 const args={auth,firestore,authSdk,firestoreSdk,projectId,expectedProjectId:projectId,onState:v=>views.push(v)};
 return {args,views,authUser:u=>authListener(u),tokenUser:u=>tokenListener(u),
  snapshot:(uid,extra={},fromCache=false)=>snapshotListener({metadata:{fromCache},exists:()=>true,
   data:()=>({businessId:uid,name:"Synthetic Salon",category:"Hair",acceptingBookings:false,...extra})}),
  unsubs:()=>unsubscribed};
}
test("All activation flags remain disabled",async()=>{
 assert.match(source,/export const DASHBOARD_FIREBASE_INTEGRATION_ENABLED=false/);
 assert.match(source,/export const PUBLIC_REGISTRATION_ENABLED=false/);
 assert.match(source,/export const CUSTOMER_BOOKINGS_ENABLED=false/);
 assert.match(source,/export const LIVE_DASHBOARD_ENABLED=false/);
});
test("Fail-closed: reject production Firebase project and missing callback",async()=>{
 const {createBusinessDashboardFirebaseFoundation:create}=await importFoundation(),x=setup();
 assert.throws(()=>create({...x.args,expectedProjectId:"production-project"}),/isolated demo Firebase project/);
 assert.throws(()=>create({...x.args,onState:null}),/callback/);
});
test("Verified owner receives restricted profile only and bookings stay disabled",async()=>{
 const {createBusinessDashboardFirebaseFoundation:create}=await importFoundation(),x=setup(),f=create(x.args);
 f.start();x.authUser({uid:"owner-a",verified:true});await tick();
 x.snapshot("owner-a");await tick();
 assert.equal(f.state.status,"ready");assert.deepEqual(Object.keys(f.state.profile).sort(),["businessId","category","name"]);
 assert.equal(f.state.bookingsEnabled,false);assert.equal(f.state.registrationEnabled,false);
 f.stop();
});
test("Unverified owner never sees private profile",async()=>{
 const {createBusinessDashboardFirebaseFoundation:create}=await importFoundation(),x=setup(),f=create(x.args);
 f.start();x.authUser({uid:"owner-a",verified:false});await tick();
 assert.equal(f.state.status,"unverified");assert.equal(f.state.profile,null);f.stop();
});
test("Cached data, mismatched owner and published profile cannot reach ready state",async()=>{
 const {createBusinessDashboardFirebaseFoundation:create}=await importFoundation(),x=setup(),f=create(x.args);
 f.start();x.authUser({uid:"owner-a",verified:true});await tick();
 x.snapshot("owner-a",{},true);assert.equal(f.state.status,"interrupted");assert.equal(f.state.profile,null);
 x.snapshot("owner-b");assert.equal(f.state.status,"invalid");assert.equal(f.state.profile,null);
 x.snapshot("owner-a",{published:true});assert.equal(f.state.status,"invalid");assert.equal(f.state.profile,null);
 f.stop();
});
test("Sign-out clears profile, unsubscribes and prevents restarting stopped foundation",async()=>{
 const {createBusinessDashboardFirebaseFoundation:create}=await importFoundation(),x=setup(),f=create(x.args);
 f.start();x.authUser({uid:"owner-a",verified:true});await tick();x.snapshot("owner-a");
 x.authUser(null);assert.equal(f.state.status,"signed-out");assert.equal(f.state.profile,null);
 f.stop();assert.ok(x.unsubs()>=2);assert.throws(()=>f.start(),/already started or stopped/);
});
