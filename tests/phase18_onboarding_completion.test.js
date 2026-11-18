"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const load=p=>import(pathToFileURL(path.join(root,p)).href);
test("Phase 18.7 secure onboarding completion remains disabled",async t=>{
 const m=await load("website/business/setup/completion-foundation.mjs");
 const draftLib=await load("website/business/setup/save-resume-foundation.mjs");
 const {defaultWeek}=await load("website/business/setup/enhanced-draft.mjs");
 const owner={uid:"owner-one",email:"owner@example.com",emailVerified:true};
 const other={uid:"owner-two",email:"other@example.com",emailVerified:true};
 const setup={name:"Kody Blends",category:"barber",contact:"owner@example.com",
  services:[{name:"Haircut",price:"20.00",duration:30},{name:"Beard Trim",price:"8.00",duration:15}],
  week:defaultWeek(),staff:[{name:"Kody"},{name:"Alex"}]};
 const draft=draftLib.createDraftEnvelope(owner,setup,4,"server-time");
 await t.test("Completion, registration and customer bookings remain off",async()=>{
  assert.equal(m.ONBOARDING_COMPLETION_ENABLED,false);
  assert.equal(m.PUBLIC_REGISTRATION_ENABLED,false);
  assert.equal(m.CUSTOMER_BOOKINGS_ENABLED,false);
  await assert.rejects(m.completeOnboarding(),/not enabled/);
  assert.doesNotMatch(read("website/business/setup/index.html"),/completion-foundation\.mjs/);
  assert.doesNotMatch(read("website/business/setup/completion-foundation.mjs"),/\bfetch\s*\(|setDoc\s*\(|runTransaction\s*\(|localStorage|sessionStorage/);
 });
 await t.test("Verified owner path and completion data are owner-bound",()=>{
  assert.deepEqual(m.completionRecordPath(owner),["users","owner-one","onboardingCompletion","setup-v1"]);
  assert.throws(()=>m.completionRecordPath({...owner,emailVerified:false}),/Verified/);
  assert.throws(()=>m.completionRecordPath({...owner,uid:"other/owner"}),/Invalid/);
  const result=m.validateCompletion(owner,draft);
  assert.equal(result.ownerId,owner.uid);
  assert.equal(result.status,"ready-for-review");
  assert.equal(result.servicesCount,2);
  assert.equal(result.staffCount,2);
  assert.equal(result.acceptingBookings,false);
  assert.equal(result.published,false);
 });
 await t.test("Reject incomplete, cross-owner and tampered drafts",()=>{
  assert.throws(()=>m.validateCompletion(other,draft),/unavailable/);
  assert.throws(()=>m.validateCompletion(owner,{...draft,completedStep:3}),/All onboarding/);
  assert.throws(()=>m.validateCompletion(owner,{...draft,acceptingBookings:true}),/unavailable/);
  assert.throws(()=>m.validateCompletion(owner,{...draft,published:true}),/unavailable/);
  assert.throws(()=>m.validateCompletion(owner,{...draft,setup:{...setup,services:[]}}),/unavailable/);
  assert.throws(()=>m.validateCompletion(owner,{...draft,schemaVersion:99}),/unavailable/);
 });
 await t.test("Reject duplicate staff, duplicate services and repeat completion",()=>{
  const dupServices=draftLib.createDraftEnvelope(owner,{...setup,services:[setup.services[0],{...setup.services[0],name:" haircut "}]},4,"server-time");
  assert.throws(()=>m.validateCompletion(owner,dupServices),/Duplicate services/);
  const dupStaff=draftLib.createDraftEnvelope(owner,{...setup,staff:[{name:"Kody"},{name:" kody "}]},4,"server-time");
  assert.throws(()=>m.validateCompletion(owner,dupStaff),/Duplicate staff/);
  assert.throws(()=>m.assessCompletionAttempt(owner,draft,{status:"complete"}),/already been completed/);
  assert.throws(()=>m.assessCompletionAttempt(owner,draft,{}),/already been completed/);
 });
 await t.test("Firestore rules deny client reads and writes to completion markers",()=>{
  const rules=read("firestore.rules");
  assert.match(rules,/match \/users\/\{userId\}\/onboardingCompletion\/\{completionId\} \{\s*allow read, write: if false;/);
  assert.match(rules,/match \/users\/\{userId\}\/onboardingDrafts\/\{draftId\} \{\s*allow read, write: if false;/);
  assert.match(rules,/request\.resource\.data\.acceptingBookings == false/);
 });
});
