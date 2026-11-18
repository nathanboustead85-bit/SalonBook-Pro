"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.join(__dirname,"..");
const load=p=>import(pathToFileURL(path.join(root,p)).href);
test("Phase 19.5 account lifecycle and recovery isolation",async t=>{
 const m=await load("website/business/account/session-lifecycle-foundation.mjs");
 const user=(uid)=>({uid,email:uid+"@example.com",emailVerified:true});
 const token=(uid)=>({uid,email:uid+"@example.com",email_verified:true});
 const restore=(state,uid)=>m.transitionAccount(state,m.ACCOUNT_EVENTS.RESTORE,{user:user(uid),token:token(uid)});
 const profile=(uid)=>({businessId:uid,name:"Salon",acceptingBookings:false,published:false});
 await t.test("All live account features remain disabled",async()=>{
  assert.equal(m.LIVE_SESSION_LISTENERS_ENABLED,false);
  assert.equal(m.PUBLIC_REGISTRATION_ENABLED,false);
  assert.equal(m.CUSTOMER_BOOKINGS_ENABLED,false);
  assert.equal(m.ACCOUNT_WRITES_ENABLED,false);
  await assert.rejects(m.subscribeToFirebaseSession(),/disabled/);
 });
 await t.test("Verified recovery and profile association are scoped to owner",()=>{
  const state=restore(m.emptyAccountState(),"owner_1");
  assert.equal(state.owner.uid,"owner_1");
  const withProfile=m.attachOwnerProfile(state,profile("owner_1"),state.revision);
  assert.equal(withProfile.profile.businessId,"owner_1");
  assert.equal(state.profile,null);
  assert.throws(()=>m.attachOwnerProfile(state,profile("owner_2"),state.revision),/cross-owner/);
 });
 await t.test("Sign-out and expiry clear owner and profile",()=>{
  const s=restore(m.emptyAccountState(),"owner_1");
  const withProfile=m.attachOwnerProfile(s,profile("owner_1"),s.revision);
  for(const event of [m.ACCOUNT_EVENTS.SIGN_OUT,m.ACCOUNT_EVENTS.EXPIRE]){
   const cleared=m.transitionAccount(withProfile,event);
   assert.equal(cleared.owner,null);
   assert.equal(cleared.profile,null);
   assert.equal(cleared.revision,withProfile.revision+1);
  }
 });
 await t.test("Account switch clears old profile and stale async response",()=>{
  const s=restore(m.emptyAccountState(),"owner_1");
  const old=m.attachOwnerProfile(s,profile("owner_1"),s.revision);
  const switched=m.transitionAccount(old,m.ACCOUNT_EVENTS.SWITCH);
  assert.equal(switched.owner,null);
  assert.equal(switched.profile,null);
  const next=restore(switched,"owner_2");
  assert.equal(next.owner.uid,"owner_2");
  assert.equal(next.profile,null);
  assert.throws(()=>m.attachOwnerProfile(next,profile("owner_1"),next.revision),/cross-owner/);
  assert.throws(()=>m.attachOwnerProfile(next,profile("owner_2"),old.revision),/Stale/);
 });
 await t.test("Invalid, unverified or mismatched tokens clear state",()=>{
  const s=restore(m.emptyAccountState(),"owner_1");
  for(const payload of [{user:user("owner_1"),token:token("owner_2")},{user:{...user("owner_1"),emailVerified:false},token:token("owner_1")},{user:null,token:null}]){
   const result=m.transitionAccount(s,m.ACCOUNT_EVENTS.RESTORE,payload);
   assert.equal(result.owner,null);
   assert.equal(result.profile,null);
  }
 });
 await t.test("Unknown events, malformed state and unsafe profiles fail closed",()=>{
  assert.throws(()=>m.transitionAccount(null,m.ACCOUNT_EVENTS.SIGN_OUT),/Invalid/);
  assert.throws(()=>m.transitionAccount(m.emptyAccountState(),"unknown"),/Unknown/);
  const s=restore(m.emptyAccountState(),"owner_1");
  assert.throws(()=>m.attachOwnerProfile(s,{...profile("owner_1"),acceptingBookings:true},s.revision),/Unsafe/);
  assert.throws(()=>m.attachOwnerProfile(s,{...profile("owner_1"),published:true},s.revision),/Unsafe/);
  assert.throws(()=>m.attachOwnerProfile(m.emptyAccountState(),profile("owner_1"),0),/session required/);
 });
});