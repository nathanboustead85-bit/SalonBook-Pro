"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const load=p=>import(pathToFileURL(path.join(root,p)).href);
test("Phase 19.1 verified account isolation foundation",async t=>{
 const m=await load("website/business/account/verified-owner-foundation.mjs");
 const auth=await load("website/business/register/firebase-auth-foundation.mjs");
 const owner={uid:"verified_owner-1",email:"Owner@Example.com",emailVerified:true};
 const other={uid:"other-owner",email:"other@example.com",emailVerified:true};
 await t.test("All live integration, registration, booking and write gates remain closed",async()=>{
  assert.equal(m.LIVE_ACCOUNT_INTEGRATION_ENABLED,false);
  assert.equal(m.PUBLIC_REGISTRATION_ENABLED,false);
  assert.equal(m.CUSTOMER_BOOKINGS_ENABLED,false);
  assert.equal(m.ACCOUNT_WRITES_ENABLED,false);
  assert.equal(auth.PUBLIC_REGISTRATION_ENABLED,false);
  await assert.rejects(m.loadOwnerAccount({user:owner}),/disabled/);
  await assert.rejects(m.writeOwnerAccount({user:owner}),/disabled/);
  assert.doesNotMatch(read("website/business/account/verified-owner-foundation.mjs"),/firebase\/(auth|firestore)|\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b|\bsetDoc\s*\(/);
 });
 await t.test("Verified owner requires correct UID and email",()=>{
  assert.deepEqual(m.verifiedOwnerContext(owner),{uid:"verified_owner-1",email:"owner@example.com",emailVerified:true});
  for(const user of [null,{...owner,emailVerified:false},{...owner,uid:"../bad"},{...owner,uid:"bad/id"},{...owner,email:"bad-email"},{...owner,uid:""}])
   assert.throws(()=>m.verifiedOwnerContext(user));
  assert.throws(()=>m.verifiedOwnerContext(owner,other.uid),/Cross-owner/);
  assert.equal(m.verifiedOwnerContext(owner,owner.uid).uid,owner.uid);
 });
 await t.test("Token must match verified owner and email",()=>{
  assert.equal(m.verifyAuthSession(owner,{uid:owner.uid,email:"OWNER@example.com",email_verified:true}).uid,owner.uid);
  for(const token of [null,{uid:other.uid,email:"owner@example.com",email_verified:true},{uid:owner.uid,email:"owner@example.com",email_verified:false},{uid:owner.uid,email:"other@example.com",email_verified:true}])
   assert.throws(()=>m.verifyAuthSession(owner,token));
 });
 await t.test("Account document paths are UID-scoped and allowlisted",()=>{
  assert.deepEqual(m.accountDocumentPath(owner,"profile"),["users",owner.uid,"business","profile"]);
  assert.deepEqual(m.accountDocumentPath(owner,"draft"),["users",owner.uid,"onboardingDrafts","setup-v1"]);
  assert.deepEqual(m.accountDocumentPath(owner,"completion"),["users",owner.uid,"onboardingCompletion","setup-v1"]);
  assert.notDeepEqual(m.accountDocumentPath(owner,"profile"),m.accountDocumentPath(other,"profile"));
  assert.throws(()=>m.accountDocumentPath(owner,"bookings"));
 });
 await t.test("Cross-owner documents and unsafe booking flags fail closed",()=>{
  const data={ownerId:owner.uid,acceptingBookings:false,published:false,profile:{name:"Demo"}};
  const clean=m.assertOwnerDocument(owner,data);
  clean.profile.name="Changed";
  assert.equal(data.profile.name,"Demo");
  assert.throws(()=>m.assertOwnerDocument(other,data),/Cross-owner/);
  assert.throws(()=>m.assertOwnerDocument(owner,{...data,acceptingBookings:true}),/unsafe/);
  assert.throws(()=>m.assertOwnerDocument(owner,{...data,published:true}),/unsafe/);
  assert.throws(()=>m.assertOwnerDocument(owner,{acceptingBookings:false}),/Cross-owner/);
 });
 await t.test("Emulator-ready security expectations are explicit; no emulator claims",()=>{
  const firebase=JSON.parse(read("firebase.json"));
  assert.ok(firebase.emulators.auth);
  assert.ok(firebase.emulators.firestore);
  const rules=read("firestore.rules");
  assert.match(rules,/function isVerifiedOwner\(userId\)/);
  assert.match(rules,/request\.auth\.token\.email_verified == true/);
  assert.match(rules,/match \/users\/\{userId\}\/onboardingDrafts\/\{draftId\}/);
  assert.match(rules,/match \/users\/\{userId\}\/onboardingCompletion\/\{completionId\}/);
  assert.match(rules,/allow read, write: if false;/);
  const doc=read("docs/PHASE19_ACCOUNT_INTEGRATION_READINESS.md");
  assert.match(doc,/NO-GO/);
  assert.match(doc,/emulator/i);
  assert.match(doc,/legacy Android/i);
 });
});