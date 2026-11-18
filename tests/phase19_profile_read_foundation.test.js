"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.join(__dirname,"..");
const load=p=>import(pathToFileURL(path.join(root,p)).href);
test("Phase 19.3 owner-only profile read safety",async t=>{
 const m=await load("website/business/account/profile-read-foundation.mjs");
 const sessionModule=await load("website/business/account/session-foundation.mjs");
 const user={uid:"owner_1",email:"owner@example.com",emailVerified:true};
 const token={uid:"owner_1",email:"owner@example.com",email_verified:true};
 const session=sessionModule.evaluateOwnerSession(user,token);
 const other=sessionModule.evaluateOwnerSession({...user,uid:"owner_2",email:"other@example.com"},{uid:"owner_2",email:"other@example.com",email_verified:true});
 const record={businessId:"owner_1",name:"Example Salon",schemaVersion:1,acceptingBookings:false,published:false};
 const snapshot=(exists,data)=>({exists:()=>exists,data:()=>data});
 await t.test("Live reads, writes, public registration and bookings remain disabled",async()=>{
  assert.equal(m.LIVE_PROFILE_READS_ENABLED,false);
  assert.equal(m.PROFILE_WRITES_ENABLED,false);
  assert.equal(m.PUBLIC_REGISTRATION_ENABLED,false);
  assert.equal(m.CUSTOMER_BOOKINGS_ENABLED,false);
  await assert.rejects(m.readOwnerBusinessProfile({session}),/disabled/);
  const src=fs.readFileSync(path.join(root,"website/business/account/profile-read-foundation.mjs"),"utf8");
  assert.doesNotMatch(src,/\bfetch\s*\(|\blocalStorage\s*[.(]|\bsessionStorage\s*[.(]|from\s*["']firebase\//);
 });
 await t.test("Only verified owner can derive profile path",()=>{
  assert.deepEqual(m.ownerProfilePath(session),["users","owner_1","business","profile"]);
  assert.deepEqual(m.ownerProfilePath(other),["users","owner_2","business","profile"]);
  assert.throws(()=>m.ownerProfilePath(sessionModule.evaluateOwnerSession({...user,emailVerified:false},token)),/session required/);
  assert.throws(()=>m.ownerProfilePath(null),/session required/);
 });
 await t.test("Missing records return explicit empty state without side effects",()=>{
  const result=m.interpretProfileSnapshot(session,snapshot(false,null));
  assert.deepEqual(result,{state:m.PROFILE_STATES.MISSING,profile:null});
  assert.throws(()=>m.interpretProfileSnapshot(session,null),/snapshot/);
 });
 await t.test("Owner profile is safely copied and verified",()=>{
  const result=m.interpretProfileSnapshot(session,snapshot(true,record));
  assert.equal(result.state,m.PROFILE_STATES.FOUND);
  assert.equal(result.profile.name,"Example Salon");
  result.profile.name="Changed";
  assert.equal(record.name,"Example Salon");
 });
 await t.test("Cross-owner, unsafe and malformed profiles are rejected",()=>{
  assert.throws(()=>m.interpretProfileSnapshot(other,snapshot(true,record)),/Cross-owner/);
  assert.throws(()=>m.interpretProfileSnapshot(session,snapshot(true,{...record,businessId:"other"})),/Cross-owner/);
  assert.throws(()=>m.interpretProfileSnapshot(session,snapshot(true,{...record,acceptingBookings:true})),/unsafe/);
  assert.throws(()=>m.interpretProfileSnapshot(session,snapshot(true,{...record,published:true})),/unsafe/);
  assert.throws(()=>m.interpretProfileSnapshot(session,snapshot(true,{...record,schemaVersion:99})),/schema/);
  assert.throws(()=>m.interpretProfileSnapshot(session,snapshot(true,{})),/Cross-owner/);
 });
 await t.test("Firestore emulator and verified owner rules remain configured",()=>{
  const cfg=JSON.parse(fs.readFileSync(path.join(root,"firebase.json"),"utf8"));
  assert.ok(cfg.emulators.auth&&cfg.emulators.firestore);
  const rules=fs.readFileSync(path.join(root,"firestore.rules"),"utf8");
  assert.match(rules,/function isVerifiedOwner\(userId\)/);
  assert.match(rules,/request\.auth\.token\.email_verified == true/);
 });
});