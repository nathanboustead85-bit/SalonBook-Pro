"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const load=p=>import(pathToFileURL(path.join(__dirname,"..",p)).href);
test("Phase 19.7 multi-device dashboard sync isolation",async t=>{
 const m=await load("website/business/dashboard/sync-foundation.mjs");
 const life=await load("website/business/account/session-lifecycle-foundation.mjs");
 const account=uid=>life.transitionAccount(life.emptyAccountState(),life.ACCOUNT_EVENTS.RESTORE,{
  user:{uid,email:uid+"@example.com",emailVerified:true},
  token:{uid,email:uid+"@example.com",email_verified:true}});
 const a=account("owner_1"),b=account("owner_2");
 const profile=(uid,name="Salon")=>({businessId:uid,name,schemaVersion:1,acceptingBookings:false,published:false});
 const snap=(uid,version,name)=>({ownerUid:uid,version,profile:profile(uid,name)});
 await t.test("All live writes, sync, registration and bookings disabled",async()=>{
  assert.equal(m.LIVE_DASHBOARD_SYNC_ENABLED,false);
  assert.equal(m.DASHBOARD_WRITES_ENABLED,false);
  assert.equal(m.PUBLIC_REGISTRATION_ENABLED,false);
  assert.equal(m.CUSTOMER_BOOKINGS_ENABLED,false);
  await assert.rejects(m.subscribeToDashboardSync(),/disabled/);
  await assert.rejects(m.commitDashboardEdit(),/disabled/);
 });
 await t.test("Newer device snapshot wins; older snapshot cannot overwrite",()=>{
  const initial=m.beginDashboardSync(a);
  const v1=m.applyDashboardSnapshot(a,initial,snap("owner_1",1,"First"));
  const v2=m.applyDashboardSnapshot(a,v1,snap("owner_1",2,"Second"));
  assert.equal(m.applyDashboardSnapshot(a,v2,snap("owner_1",1,"First")),v2);
  assert.equal(v2.profile.name,"Second");
  assert.equal(m.prepareDashboardEdit(a,v2,2).writeEnabled,false);
  assert.throws(()=>m.prepareDashboardEdit(a,v2,1),/Stale/);
 });
 await t.test("Equal-version conflicting device changes cannot silently overwrite",()=>{
  const v1=m.applyDashboardSnapshot(a,m.beginDashboardSync(a),snap("owner_1",1,"First"));
  assert.equal(m.applyDashboardSnapshot(a,v1,snap("owner_1",1,"First")),v1);
  const conflict=m.applyDashboardSnapshot(a,v1,snap("owner_1",1,"Other"));
  assert.equal(conflict.status,m.SYNC_STATES.CONFLICT);
  assert.equal(conflict.profile.name,"First");
  assert.throws(()=>m.prepareDashboardEdit(a,conflict,1),/Current/);
 });
 await t.test("Cross-business snapshots and account switching are rejected",()=>{
  const initial=m.beginDashboardSync(a);
  assert.throws(()=>m.applyDashboardSnapshot(a,initial,snap("owner_2",1,"Other")),/cross-owner/);
  assert.throws(()=>m.applyDashboardSnapshot(b,initial,snap("owner_1",1,"First")),/cross-owner/);
  const switched=life.transitionAccount(a,life.ACCOUNT_EVENTS.SWITCH);
  assert.throws(()=>m.applyDashboardSnapshot(switched,initial,snap("owner_1",1,"First")),/session/);
  const expired=life.transitionAccount(a,life.ACCOUNT_EVENTS.EXPIRE);
  assert.throws(()=>m.prepareDashboardEdit(expired,{...initial,status:m.SYNC_STATES.CURRENT,profile:profile("owner_1")},0),/session/);
 });
 await t.test("Unsafe, malformed and unversioned snapshots are denied",()=>{
  const initial=m.beginDashboardSync(a);
  for(const bad of [
   {...snap("owner_1",1,"First"),version:0},
   {...snap("owner_1",1,"First"),version:1.5},
   {...snap("owner_1",1,"First"),profile:profile("owner_2")},
   {...snap("owner_1",1,"First"),profile:{...profile("owner_1"),acceptingBookings:true}},
   {...snap("owner_1",1,"First"),profile:{...profile("owner_1"),published:true}},
   {...snap("owner_1",1,"First"),profile:{...profile("owner_1"),schemaVersion:99}}
  ])assert.throws(()=>m.applyDashboardSnapshot(a,initial,bad),/Invalid|Unsafe/);
  assert.throws(()=>m.beginDashboardSync(life.emptyAccountState()),/Verified/);
 });
});