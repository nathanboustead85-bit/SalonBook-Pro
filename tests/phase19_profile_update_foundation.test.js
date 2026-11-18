"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.join(__dirname,"..");
const load=p=>import(pathToFileURL(path.join(root,p)).href);
test("Phase 19.4 owner-only business profile updates",async t=>{
 const m=await load("website/business/account/profile-update-foundation.mjs");
 const auth=await load("website/business/account/session-foundation.mjs");
 const user={uid:"owner_1",email:"owner@example.com",emailVerified:true};
 const token={uid:"owner_1",email:"owner@example.com",email_verified:true};
 const session=auth.evaluateOwnerSession(user,token);
 const other=auth.evaluateOwnerSession({...user,uid:"owner_2",email:"other@example.com"},{uid:"owner_2",email:"other@example.com",email_verified:true});
 const original={businessId:"owner_1",schemaVersion:1,name:"Old Salon",phone:"",address:"",description:"",acceptingBookings:false,published:false};
 const snapshot=(exists,data)=>({exists:()=>exists,data:()=>data});
 await t.test("Writes, registration and bookings remain disabled",async()=>{
  assert.equal(m.LIVE_PROFILE_UPDATES_ENABLED,false);
  assert.equal(m.PUBLIC_REGISTRATION_ENABLED,false);
  assert.equal(m.CUSTOMER_BOOKINGS_ENABLED,false);
  await assert.rejects(m.updateOwnerBusinessProfile(),/disabled/);
 });
 await t.test("Allowed edits are trimmed, owner-scoped and do not mutate source",()=>{
  const result=m.prepareOwnerProfileUpdate(session,snapshot(true,original),{name:" New Salon ",phone:"+44 1234 567890",address:" High Street ",description:" Friendly "});
  assert.equal(result.ownerUid,"owner_1");
  assert.equal(result.profile.name,"New Salon");
  assert.equal(result.profile.phone,"+44 1234 567890");
  assert.equal(result.profile.acceptingBookings,false);
  assert.equal(result.profile.published,false);
  assert.equal(original.name,"Old Salon");
  assert.deepEqual(Object.keys(result.changes).sort(),["address","description","name","phone"]);
 });
 await t.test("No profile, invalid session or cross-owner profile is denied",()=>{
  assert.throws(()=>m.prepareOwnerProfileUpdate(session,snapshot(false,null),{name:"New Salon"}),/Existing/);
  assert.throws(()=>m.prepareOwnerProfileUpdate(other,snapshot(true,original),{name:"New Salon"}),/Cross-owner/);
  assert.throws(()=>m.prepareOwnerProfileUpdate(auth.evaluateOwnerSession(null,null),snapshot(true,original),{name:"New Salon"}),/session required/);
 });
 await t.test("Protected fields and unexpected fields cannot be changed",()=>{
  for(const key of ["businessId","ownerId","email","slug","category","schemaVersion","updatedAt","acceptingBookings","published","isAdmin","services","bookings","__proto__"]) {
   const changes=Object.create(null);changes[key]=true;
   assert.throws(()=>m.prepareOwnerProfileUpdate(session,snapshot(true,original),changes),/Protected or unknown/);
  }
  assert.throws(()=>m.prepareOwnerProfileUpdate(session,snapshot(true,original),{}),/At least one/);
  assert.throws(()=>m.prepareOwnerProfileUpdate(session,snapshot(true,original),null),/Invalid profile/);
 });
 await t.test("Field validation rejects invalid lengths, types and control characters",()=>{
  for(const changes of [{name:"x"},{name:"x".repeat(101)},{name:42},{name:"Bad\nName"},{phone:"abc"},{phone:"123"},{phone:12},{address:"x".repeat(201)},{description:"x".repeat(1001)},{description:"bad\u0000text"}])
   assert.throws(()=>m.prepareOwnerProfileUpdate(session,snapshot(true,original),changes),/Invalid/);
 });
 await t.test("Unsafe existing profiles cannot be updated",()=>{
  assert.throws(()=>m.prepareOwnerProfileUpdate(session,snapshot(true,{...original,acceptingBookings:true}),{name:"New Salon"}),/unsafe/);
  assert.throws(()=>m.prepareOwnerProfileUpdate(session,snapshot(true,{...original,published:true}),{name:"New Salon"}),/unsafe/);
 });
});