"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const load=p=>import(pathToFileURL(path.join(__dirname,"..",p)).href);
test("Phase 19.8 offline dashboard recovery and resilience",async t=>{
 const m=await load("website/business/dashboard/recovery-foundation.mjs");
 const life=await load("website/business/account/session-lifecycle-foundation.mjs");
 const account=uid=>life.transitionAccount(life.emptyAccountState(),life.ACCOUNT_EVENTS.RESTORE,{
  user:{uid,email:uid+"@example.com",emailVerified:true},
  token:{uid,email:uid+"@example.com",email_verified:true}});
 const a=account("owner_1"),b=account("owner_2");
 const snap=(uid,version,name)=>({ownerUid:uid,version,profile:{businessId:uid,name,schemaVersion:1,acceptingBookings:false,published:false}});
 await t.test("Live recovery, bookings, registration and writes disabled",async()=>{
  assert.equal(m.LIVE_RECOVERY_ENABLED,false);
  assert.equal(m.PUBLIC_REGISTRATION_ENABLED,false);
  assert.equal(m.CUSTOMER_BOOKINGS_ENABLED,false);
  assert.equal(m.DASHBOARD_WRITES_ENABLED,false);
  await assert.rejects(m.connectLiveDashboardRecovery(),/disabled/);
 });
 await t.test("Interrupted connection blocks updates and hides stale profile",()=>{
  const first=m.receiveRecoverySnapshot(a,m.startDashboardRecovery(a),0,snap("owner_1",1,"First"));
  assert.equal(m.canDisplayRecoveredProfile(a,first),true);
  const interrupted=m.interruptDashboard(a,first);
  assert.equal(m.canDisplayRecoveredProfile(a,interrupted),false);
  assert.throws(()=>m.receiveRecoverySnapshot(a,interrupted,interrupted.epoch,snap("owner_1",2,"Second")),/interrupted/);
  assert.throws(()=>m.receiveRecoverySnapshot(a,interrupted,0,snap("owner_1",2,"Second")),/Stale/);
 });
 await t.test("Reconnection requires fresh epoch; older versions cannot overwrite",()=>{
  const first=m.receiveRecoverySnapshot(a,m.startDashboardRecovery(a),0,snap("owner_1",2,"Latest"));
  const interrupted=m.interruptDashboard(a,first);
  const reconnecting=m.reconnectDashboard(a,interrupted);
  assert.equal(m.canDisplayRecoveredProfile(a,reconnecting),false);
  assert.throws(()=>m.receiveRecoverySnapshot(a,reconnecting,interrupted.epoch,snap("owner_1",3,"Late")),/Stale/);
  const restored=m.receiveRecoverySnapshot(a,reconnecting,reconnecting.epoch,snap("owner_1",1,"Old"));
  assert.equal(restored.profile.name,"Latest");
  assert.equal(restored.serverVersion,2);
  assert.equal(m.canDisplayRecoveredProfile(a,restored),true);
 });
 await t.test("Equal-version conflicts block profile display",()=>{
  const first=m.receiveRecoverySnapshot(a,m.startDashboardRecovery(a),0,snap("owner_1",2,"First"));
  const reconnecting=m.reconnectDashboard(a,m.interruptDashboard(a,first));
  const conflict=m.receiveRecoverySnapshot(a,reconnecting,reconnecting.epoch,snap("owner_1",2,"Changed"));
  assert.equal(conflict.connection,m.RECOVERY_STATES.CONFLICT);
  assert.equal(m.canDisplayRecoveredProfile(a,conflict),false);
  assert.equal(conflict.profile.name,"First");
 });
 await t.test("Cross-business data and owner switches fail closed",()=>{
  const initial=m.startDashboardRecovery(a);
  assert.throws(()=>m.receiveRecoverySnapshot(a,initial,0,snap("owner_2",1,"Other")),/cross-owner/);
  assert.throws(()=>m.interruptDashboard(b,initial),/cross-owner/);
  const switched=life.transitionAccount(a,life.ACCOUNT_EVENTS.SWITCH);
  assert.equal(m.canDisplayRecoveredProfile(switched,initial),false);
  assert.throws(()=>m.reconnectDashboard(switched,m.interruptDashboard(a,initial)),/session/);
  const expired=life.transitionAccount(a,life.ACCOUNT_EVENTS.EXPIRE);
  assert.equal(m.canDisplayRecoveredProfile(expired,initial),false);
  const cleared=m.clearDashboardRecovery();
  assert.equal(cleared.profile,null);
  assert.equal(cleared.ownerUid,null);
  assert.equal(m.canDisplayRecoveredProfile(a,cleared),false);
 });
 await t.test("Invalid reconnection order rejected",()=>{
  assert.throws(()=>m.reconnectDashboard(a,m.startDashboardRecovery(a)),/interrupted/);
  assert.throws(()=>m.startDashboardRecovery(life.emptyAccountState()),/Verified/);
 });
});