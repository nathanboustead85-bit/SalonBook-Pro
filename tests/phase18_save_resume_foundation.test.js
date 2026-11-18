"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("Phase 18.6 owner-isolated save/resume remains disabled",async t=>{
 const m=await import(pathToFileURL(path.join(root,"website/business/setup/save-resume-foundation.mjs")).href);
 const {defaultWeek}=await import(pathToFileURL(path.join(root,"website/business/setup/enhanced-draft.mjs")).href);
 const owner={uid:"owner-one",email:"owner@example.com",emailVerified:true};
 const other={uid:"owner-two",email:"other@example.com",emailVerified:true};
 const setup={name:"Kody Blends",category:"barber",contact:"owner@example.com",
  services:[{name:"Haircut",price:"20.00",duration:30}],week:defaultWeek(),staff:[{name:"Kody"}]};
 await t.test("Save and resume cannot reach Firebase while disabled",async()=>{
  assert.equal(m.SAVE_RESUME_ENABLED,false);
  let calls=0;
  const sdk={doc:()=>{calls++;},getDoc:()=>{calls++;},setDoc:()=>{calls++;},serverTimestamp:()=>{calls++;}};
  await assert.rejects(m.saveDraft({user:owner,setup,completedStep:2,db:{},sdk}),/not enabled/);
  await assert.rejects(m.resumeDraft({user:owner,db:{},sdk}),/not enabled/);
  assert.equal(calls,0);
 });
 await t.test("Paths use verified owner UID, never a caller-controlled business ID",()=>{
  assert.deepEqual(m.ownerDraftPath(owner),["users","owner-one","onboardingDrafts","setup-v1"]);
  assert.notDeepEqual(m.ownerDraftPath(owner),m.ownerDraftPath(other));
  assert.throws(()=>m.ownerDraftPath({...owner,emailVerified:false}),/Verified/);
  assert.throws(()=>m.ownerDraftPath({...owner,uid:"../../other"}),/Invalid/);
 });
 await t.test("Drafts enforce schema, progress, ownership and disabled booking flags",()=>{
  const envelope=m.createDraftEnvelope(owner,{...setup,ownerId:"owner-two",published:true,acceptingBookings:true},3,"server-time");
  assert.equal(envelope.ownerId,"owner-one");
  assert.equal(envelope.acceptingBookings,false);
  assert.equal(envelope.published,false);
  assert.equal(envelope.schemaVersion,1);
  assert.equal(envelope.completedStep,3);
  assert.equal(m.recoverDraft(owner,envelope).completedStep,3);
  assert.throws(()=>m.recoverDraft(other,envelope),/unavailable/);
  assert.throws(()=>m.recoverDraft(owner,{...envelope,schemaVersion:2}),/unavailable/);
  assert.throws(()=>m.recoverDraft(owner,{...envelope,acceptingBookings:true}),/unavailable/);
  assert.throws(()=>m.recoverDraft(owner,{...envelope,completedStep:9}),/unavailable/);
  assert.throws(()=>m.createDraftEnvelope(owner,setup,-1,"server-time"),/progress/);
  assert.throws(()=>m.createDraftEnvelope(owner,setup,1,null),/timestamp/);
  assert.throws(()=>m.createDraftEnvelope(owner,{...setup,services:[]},1,"server-time"),/Invalid/);
 });
 await t.test("Recovery returns an isolated copy",()=>{
  const envelope=m.createDraftEnvelope(owner,setup,2,"server-time");
  const recovered=m.recoverDraft(owner,envelope);
  recovered.setup.services[0].name="Changed";
  assert.equal(envelope.setup.services[0].name,"Haircut");
 });
 await t.test("Firestore rules explicitly deny draft access and page has no persistence wiring",()=>{
  assert.match(read("firestore.rules"),/match \/users\/\{userId\}\/onboardingDrafts\/\{draftId\} \{\s*allow read, write: if false;/);
  assert.doesNotMatch(read("website/business/setup/index.html"),/save-resume-foundation\.mjs/);
  assert.doesNotMatch(read("website/business/setup/wizard.mjs"),/localStorage|sessionStorage|indexedDB|\bfetch\s*\(/);
  assert.doesNotMatch(read("website/business/setup/save-resume-foundation.mjs"),/\bfetch\s*\(|localStorage|sessionStorage|indexedDB/);
 });
});
