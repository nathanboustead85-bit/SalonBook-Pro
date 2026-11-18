"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.join(__dirname,"..");
const load=p=>import(pathToFileURL(path.join(root,p)).href);
test("Phase 19.9 integrated offline owner dashboard security audit",async t=>{
 const [session,life,read,update,dashboard,sync,recovery]=await Promise.all([
  "account/session-foundation.mjs","account/session-lifecycle-foundation.mjs",
  "account/profile-read-foundation.mjs","account/profile-update-foundation.mjs",
  "dashboard/owner-connection-foundation.mjs","dashboard/sync-foundation.mjs",
  "dashboard/recovery-foundation.mjs"].map(p=>load("website/business/"+p)));
 const account=uid=>life.transitionAccount(life.emptyAccountState(),life.ACCOUNT_EVENTS.RESTORE,{
  user:{uid,email:uid+"@example.com",emailVerified:true},
  token:{uid,email:uid+"@example.com",email_verified:true}});
 const profile=(uid,name="Salon")=>({businessId:uid,name,schemaVersion:1,acceptingBookings:false,published:false});
 const snapshot=(uid,version,name="Salon")=>({ownerUid:uid,version,profile:profile(uid,name)});
 const doc=p=>({exists:()=>!!p,data:()=>p});
 await t.test("All live account, dashboard, registration and booking gates fail closed",async()=>{
  const modules=[session,life,read,update,dashboard,sync,recovery];
  for(const mod of modules){
   assert.equal(mod.PUBLIC_REGISTRATION_ENABLED,false);
   assert.equal(mod.CUSTOMER_BOOKINGS_ENABLED,false);
  }
  for(const [mod,key] of [[session,"LIVE_SESSION_RECOVERY_ENABLED"],[life,"LIVE_SESSION_LISTENERS_ENABLED"],
   [read,"LIVE_PROFILE_READS_ENABLED"],[update,"LIVE_PROFILE_UPDATES_ENABLED"],
   [dashboard,"LIVE_DASHBOARD_CONNECTION_ENABLED"],[sync,"LIVE_DASHBOARD_SYNC_ENABLED"],
   [recovery,"LIVE_RECOVERY_ENABLED"]])assert.equal(mod[key],false);
  assert.equal(sync.DASHBOARD_WRITES_ENABLED,false);
  await assert.rejects(session.resumeFirebaseOwnerSession(),/disabled/);
  await assert.rejects(life.subscribeToFirebaseSession(),/disabled/);
  await assert.rejects(read.readOwnerBusinessProfile(),/disabled/);
  await assert.rejects(update.updateOwnerBusinessProfile(),/disabled/);
  await assert.rejects(dashboard.connectFirebaseOwnerDashboard(),/disabled/);
  await assert.rejects(sync.subscribeToDashboardSync(),/disabled/);
  await assert.rejects(sync.commitDashboardEdit(),/disabled/);
  await assert.rejects(recovery.connectLiveDashboardRecovery(),/disabled/);
 });
 await t.test("Verified owner can read, validate update and view own dashboard offline",()=>{
  const a=account("owner_a");
  const auth={state:session.SESSION_STATES.READY,owner:a.owner};
  assert.equal(read.interpretProfileSnapshot(auth,doc(profile("owner_a"))).state,read.PROFILE_STATES.FOUND);
  const prepared=update.prepareOwnerProfileUpdate(auth,doc(profile("owner_a")),{name:"Updated Salon"});
  assert.equal(prepared.profile.name,"Updated Salon");
  assert.equal(prepared.profile.acceptingBookings,false);
  const request=dashboard.beginOwnerDashboard(a);
  const view=dashboard.resolveOwnerDashboard(a,request,doc(profile("owner_a")));
  assert.equal(view.data.business,"Salon");
  assert.equal(view.data.isDemo,false);
  assert.equal(dashboard.resolveOwnerDashboard(a,request,doc(null)).state,dashboard.DASHBOARD_STATES.EMPTY);
 });
 await t.test("Cross-owner and unverified identity denied at every boundary",()=>{
  const a=account("owner_a"),b=account("owner_b");
  const auth={state:session.SESSION_STATES.READY,owner:a.owner};
  assert.throws(()=>read.interpretProfileSnapshot(auth,doc(profile("owner_b"))));
  assert.throws(()=>update.prepareOwnerProfileUpdate(auth,doc(profile("owner_b")),{name:"Wrong"}));
  assert.throws(()=>dashboard.resolveOwnerDashboard(b,dashboard.beginOwnerDashboard(a),doc(profile("owner_b"))));
  assert.throws(()=>sync.applyDashboardSnapshot(a,sync.beginDashboardSync(a),snapshot("owner_b",1)));
  assert.throws(()=>recovery.receiveRecoverySnapshot(a,recovery.startDashboardRecovery(a),0,snapshot("owner_b",1)));
  const unverified=life.transitionAccount(life.emptyAccountState(),life.ACCOUNT_EVENTS.RESTORE,{
   user:{uid:"owner_a",email:"owner_a@example.com",emailVerified:false},
   token:{uid:"owner_a",email:"owner_a@example.com",email_verified:true}});
  assert.throws(()=>sync.beginDashboardSync(unverified));
 });
 await t.test("Multi-device update, interruption and stale recovery cannot overwrite newer data",()=>{
  const a=account("owner_a");
  const first=recovery.receiveRecoverySnapshot(a,recovery.startDashboardRecovery(a),0,snapshot("owner_a",2,"New"));
  const paused=recovery.interruptDashboard(a,first);
  assert.equal(recovery.canDisplayRecoveredProfile(a,paused),false);
  const waiting=recovery.reconnectDashboard(a,paused);
  assert.throws(()=>recovery.receiveRecoverySnapshot(a,waiting,paused.epoch,snapshot("owner_a",3,"Late")));
  const resumed=recovery.receiveRecoverySnapshot(a,waiting,waiting.epoch,snapshot("owner_a",1,"Old"));
  assert.equal(resumed.profile.name,"New");
  const conflict=recovery.receiveRecoverySnapshot(a,resumed,resumed.epoch,snapshot("owner_a",2,"Different"));
  assert.equal(conflict.connection,recovery.RECOVERY_STATES.CONFLICT);
  assert.equal(recovery.canDisplayRecoveredProfile(a,conflict),false);
 });
 await t.test("Owner switch, sign-out and expiry invalidate outstanding dashboard state",()=>{
  const a=account("owner_a"),state=recovery.startDashboardRecovery(a);
  for(const event of [life.ACCOUNT_EVENTS.SWITCH,life.ACCOUNT_EVENTS.SIGN_OUT,life.ACCOUNT_EVENTS.EXPIRE]){
   const cleared=life.transitionAccount(a,event);
   assert.equal(recovery.canDisplayRecoveredProfile(cleared,state),false);
   assert.throws(()=>recovery.receiveRecoverySnapshot(cleared,state,0,snapshot("owner_a",1)));
  }
  const b=account("owner_b");
  assert.throws(()=>recovery.receiveRecoverySnapshot(b,state,0,snapshot("owner_a",1)));
 });
 await t.test("No live integration or appointment mutations in Phase 19 foundation files",()=>{
  for(const dir of ["website/business/account","website/business/dashboard"]){
   for(const file of fs.readdirSync(path.join(root,dir)).filter(f=>f.endsWith("-foundation.mjs"))){
    const source=fs.readFileSync(path.join(root,dir,file),"utf8");
    assert.doesNotMatch(source,/\b(?:addDoc|setDoc|updateDoc|deleteDoc|onSnapshot)\s*\(/);
    assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest)\s*\(/);
   }
  }
  const workflow=fs.readFileSync(path.join(root,".github/workflows/boustio-phase19-account-offline.yml"),"utf8");
  assert.match(workflow,/phase19_final_integration_audit\.test\.js/);
  assert.doesNotMatch(workflow,/\b(?:firebase deploy|gradle|assembleRelease)\b/i);
 });
});