"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.join(__dirname,"..");
const load=p=>import(pathToFileURL(path.join(root,p)).href);
test("Phase 19.6 owner dashboard isolation and states",async t=>{
 const m=await load("website/business/dashboard/owner-connection-foundation.mjs");
 const lifecycle=await load("website/business/account/session-lifecycle-foundation.mjs");
 const make=(uid)=>lifecycle.transitionAccount(lifecycle.emptyAccountState(),lifecycle.ACCOUNT_EVENTS.RESTORE,{user:{uid,email:uid+"@example.com",emailVerified:true},token:{uid,email:uid+"@example.com",email_verified:true}});
 const snap=(exists,data)=>({exists:()=>exists,data:()=>data});
 const profile=(uid)=>({businessId:uid,name:"Owner "+uid,category:"salon",schemaVersion:1,acceptingBookings:false,published:false});
 await t.test("Live integration, public registration and bookings disabled",async()=>{
  assert.equal(m.LIVE_DASHBOARD_CONNECTION_ENABLED,false);
  assert.equal(m.PUBLIC_REGISTRATION_ENABLED,false);
  assert.equal(m.CUSTOMER_BOOKINGS_ENABLED,false);
  await assert.rejects(m.connectFirebaseOwnerDashboard(),/disabled/);
 });
 await t.test("Signed out, loading, missing and ready states",()=>{
  assert.equal(m.beginOwnerDashboard(lifecycle.emptyAccountState()).state,m.DASHBOARD_STATES.SIGNED_OUT);
  const account=make("owner_1");
  const pending=m.beginOwnerDashboard(account);
  assert.equal(pending.state,m.DASHBOARD_STATES.LOADING);
  const empty=m.resolveOwnerDashboard(account,pending,snap(false,null));
  assert.equal(empty.state,m.DASHBOARD_STATES.EMPTY);
  assert.equal(empty.data,null);
  const ready=m.resolveOwnerDashboard(account,pending,snap(true,profile("owner_1")));
  assert.equal(ready.state,m.DASHBOARD_STATES.READY);
  assert.equal(ready.data.business,"Owner owner_1");
  assert.equal(ready.data.isDemo,false);
  assert.equal(ready.data.bookingStatus,"Disabled");
  assert.equal(m.dashboardSummary(ready).progress,25);
 });
 await t.test("Cross-business profile and pending request rejected",()=>{
  const first=make("owner_1"),second=make("owner_2");
  const req=m.beginOwnerDashboard(first);
  assert.throws(()=>m.resolveOwnerDashboard(second,req,snap(true,profile("owner_2"))),/Stale or cross-owner/);
  assert.throws(()=>m.resolveOwnerDashboard(first,req,snap(true,profile("owner_2"))),/Cross-owner/);
  assert.throws(()=>m.resolveOwnerDashboard(first,req,snap(true,{...profile("owner_1"),acceptingBookings:true})),/unsafe/);
 });
 await t.test("Expired session and account switch clear dashboard access",()=>{
  const account=make("owner_1"),req=m.beginOwnerDashboard(account);
  const expired=lifecycle.transitionAccount(account,lifecycle.ACCOUNT_EVENTS.EXPIRE);
  assert.equal(m.resolveOwnerDashboard(expired,req,snap(true,profile("owner_1"))).state,m.DASHBOARD_STATES.SIGNED_OUT);
  const switched=lifecycle.transitionAccount(account,lifecycle.ACCOUNT_EVENTS.SWITCH);
  assert.equal(m.beginOwnerDashboard(switched).state,m.DASHBOARD_STATES.SIGNED_OUT);
  const newAccount=lifecycle.transitionAccount(switched,lifecycle.ACCOUNT_EVENTS.RESTORE,{user:{uid:"owner_2",email:"owner_2@example.com",emailVerified:true},token:{uid:"owner_2",email:"owner_2@example.com",email_verified:true}});
  assert.throws(()=>m.resolveOwnerDashboard(newAccount,req,snap(true,profile("owner_1"))),/Stale or cross-owner/);
 });
 await t.test("Stale revision and missing requests fail closed",()=>{
  const account=make("owner_1"),req=m.beginOwnerDashboard(account);
  assert.throws(()=>m.resolveOwnerDashboard(account,{...req,revision:req.revision-1},snap(false,null)),/Stale/);
  assert.throws(()=>m.resolveOwnerDashboard(account,null,snap(false,null)),/Stale/);
  assert.throws(()=>m.dashboardSummary({state:m.DASHBOARD_STATES.EMPTY,data:null}),/required/);
 });
});