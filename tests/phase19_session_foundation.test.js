"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.join(__dirname,"..");
const load=p=>import(pathToFileURL(path.join(root,p)).href);
test("Phase 19.2 offline Firebase owner-session recovery and isolation",async t=>{
 const m=await load("website/business/account/session-foundation.mjs");
 const user={uid:"owner_1",email:"owner@example.com",emailVerified:true};
 const token={uid:"owner_1",email:"owner@example.com",email_verified:true};
 await t.test("Hard gates prevent live recovery, registration and bookings",async()=>{
  assert.equal(m.LIVE_SESSION_RECOVERY_ENABLED,false);
  assert.equal(m.PUBLIC_REGISTRATION_ENABLED,false);
  assert.equal(m.CUSTOMER_BOOKINGS_ENABLED,false);
  await assert.rejects(m.resumeFirebaseOwnerSession(),/disabled/);
  const src=fs.readFileSync(path.join(root,"website/business/account/session-foundation.mjs"),"utf8");
  assert.doesNotMatch(src,/\bfetch\s*\(|\blocalStorage\s*[.(]|\bsessionStorage\s*[.(]|from\s*["']firebase\//);
 });
 await t.test("Valid verified Firebase claims produce scoped preview session",()=>{
  const s=m.evaluateOwnerSession(user,token,"owner_1");
  assert.equal(s.state,m.SESSION_STATES.READY);
  assert.equal(s.owner.uid,"owner_1");
  assert.equal(m.requireReadySession(s,"owner_1").email,"owner@example.com");
  assert.throws(()=>m.requireReadySession(s,"other"),/Cross-owner/);
 });
 await t.test("Unverified, revoked, mismatched and malformed claims fail closed",()=>{
  assert.equal(m.evaluateOwnerSession(null,null).state,m.SESSION_STATES.SIGNED_OUT);
  assert.equal(m.evaluateOwnerSession({...user,emailVerified:false},token).state,m.SESSION_STATES.UNVERIFIED);
  for(const bad of [null,{...token,email_verified:false},{...token,uid:"other"},{...token,email:"other@example.com"}])
   assert.equal(m.evaluateOwnerSession(user,bad).state,m.SESSION_STATES.INVALID);
  assert.equal(m.evaluateOwnerSession(user,token,"other").state,m.SESSION_STATES.INVALID);
  assert.equal(m.evaluateOwnerSession({...user,uid:"bad/uid"},token).state,m.SESSION_STATES.INVALID);
 });
 await t.test("Recovery only accepts verified user/token snapshot and does not persist",()=>{
  const s=m.recoverOwnerSession({user,token},{expectedUid:"owner_1"});
  assert.equal(s.state,m.SESSION_STATES.READY);
  assert.equal(m.recoverOwnerSession(null).state,m.SESSION_STATES.SIGNED_OUT);
  assert.equal(m.recoverOwnerSession({user,token:{...token,email_verified:false}}).state,m.SESSION_STATES.INVALID);
  assert.equal(m.recoverOwnerSession({user,token},{expectedUid:"other"}).state,m.SESSION_STATES.INVALID);
  assert.throws(()=>m.requireReadySession(m.recoverOwnerSession({user:null,token})),/required/);
  assert.throws(()=>m.requireReadySession({state:"verified-preview",owner:{uid:"owner_1",emailVerified:false}}),/Verified/);
 });
 await t.test("Firebase emulator configuration and owner rules remain present",()=>{
  const cfg=JSON.parse(fs.readFileSync(path.join(root,"firebase.json"),"utf8"));
  assert.ok(cfg.emulators.auth&&cfg.emulators.firestore);
  const rules=fs.readFileSync(path.join(root,"firestore.rules"),"utf8");
  assert.match(rules,/function isVerifiedOwner\(userId\)/);
  assert.match(rules,/request\.auth\.token\.email_verified == true/);
 });
});