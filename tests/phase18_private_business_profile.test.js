"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const load=()=>import(pathToFileURL(path.join(root,"website/business/register/business-profile-foundation.mjs")).href);
const owner={uid:"owner-A",email:"Owner@Example.com",emailVerified:true};
const draft={name:" Kody Blends ",slug:"kody-blends",category:"barber",businessId:"other-owner",acceptingBookings:true};
test("Phase 18.3 owner-isolated private business profiles",async t=>{
 const m=await load();
 await t.test("Public profile creation is disabled, no Firestore calls",async()=>{
  assert.equal(m.PUBLIC_PROFILE_CREATION_ENABLED,false);
  let calls=0;
  const sdk={doc:()=>{calls++;},setDoc:()=>{calls++;},serverTimestamp:()=>{calls++;}};
  await assert.rejects(m.createPrivateBusinessProfile({user:owner,draft,db:{},sdk}),/not enabled/);
  assert.equal(calls,0);
 });
 await t.test("Verified owner UID overrides forged businessId and booking flags",()=>{
  const profile=m.buildPrivateBusinessProfile(owner,draft,"server-time");
  assert.deepEqual(Object.keys(profile).sort(),["businessId","name","slug","category","email","phone","address","description","acceptingBookings","schemaVersion","updatedAt"].sort());
  assert.equal(profile.businessId,"owner-A");
  assert.equal(profile.acceptingBookings,false);
  assert.equal(profile.email,"owner@example.com");
  assert.equal(profile.name,"Kody Blends");
  assert.equal(profile.updatedAt,"server-time");
 });
 await t.test("Unverified owners, invalid categories and slugs are rejected",()=>{
  assert.throws(()=>m.buildPrivateBusinessProfile({...owner,emailVerified:false},draft,"time"),/Verified/);
  assert.throws(()=>m.buildPrivateBusinessProfile({...owner,uid:""},draft,"time"),/Verified/);
  assert.throws(()=>m.buildPrivateBusinessProfile(owner,{...draft,slug:"../../admin"},"time"),/Invalid/);
  assert.throws(()=>m.buildPrivateBusinessProfile(owner,{...draft,category:"admin"},"time"),/Invalid/);
  assert.throws(()=>m.buildPrivateBusinessProfile(owner,draft,null),/timestamp/);
 });
 await t.test("Firestore rules enforce owner isolation, immutable identity and disabled bookings",()=>{
  const rules=read("firestore.rules");
  const section=rules.split("match /users/{userId}/business/{documentId}")[1].split("match /publicBusinesses/")[0];
  assert.match(section,/allow read: if isVerifiedOwner\(userId\)/);
  assert.match(section,/allow create, update: if isVerifiedOwner\(userId\)/);
  assert.match(section,/request\.resource\.data\.businessId == userId/);
  assert.match(section,/request\.resource\.data\.acceptingBookings == false/);
  assert.match(section,/allow delete: if false/);
  assert.match(section,/request\.resource\.data\.keys\(\)\.hasOnly/);
  assert.doesNotMatch(read("website/business/register/index.html"),/business-profile-foundation\.mjs/);
 });
});
