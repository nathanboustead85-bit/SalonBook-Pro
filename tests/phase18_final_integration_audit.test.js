"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const load=p=>import(pathToFileURL(path.join(root,p)).href);
test("Phase 18.10 integration and release gate audit",async t=>{
 const auth=await load("website/business/register/firebase-auth-foundation.mjs");
 const profile=await load("website/business/register/business-profile-foundation.mjs");
 const setup=await load("website/business/setup/enhanced-draft.mjs");
 const wizard=await load("website/business/setup/wizard.mjs");
 const drafts=await load("website/business/setup/save-resume-foundation.mjs");
 const complete=await load("website/business/setup/completion-foundation.mjs");
 const dashboard=await load("website/business/dashboard/dashboard.mjs");
 const editor=await load("website/business/dashboard/editor.mjs");
 const owner={uid:"owner-verified",email:"owner@example.com",emailVerified:true};
 const other={uid:"owner-other",email:"other@example.com",emailVerified:true};
 const business={name:"Audit Barber",category:"barber",contact:"owner@example.com",services:[{name:"Cut",price:"20",duration:30}],staff:[{name:"Barber"}],week:setup.defaultWeek()};
 const envelope=drafts.createDraftEnvelope(owner,business,4,"server timestamp");
 await t.test("Registration and sign-in cannot call injected SDK",async()=>{
  let calls=0;const sdk=new Proxy({}, {get(){calls++;return ()=>{calls++;};}});
  await assert.rejects(auth.registerBusinessAccount({email:"owner@example.com",password:"long-secure-password",auth:{},sdk}),/not enabled/);
  await assert.rejects(auth.signInVerifiedBusiness({email:"owner@example.com",password:"long-secure-password",auth:{},sdk}),/not enabled/);
  assert.equal(calls,0);
  assert.equal(auth.PUBLIC_REGISTRATION_ENABLED,false);
  assert.equal(profile.PUBLIC_PROFILE_CREATION_ENABLED,false);
  assert.equal(wizard.SETUP_PUBLISHING_ENABLED,false);
  assert.equal(wizard.CUSTOMER_BOOKINGS_ENABLED,false);
 });
 await t.test("Verified owner and profile prevent spoofed owner or booking flags",()=>{
  assert.throws(()=>auth.requireVerifiedOwner({...owner,emailVerified:false}),/Verified/);
  const p=profile.buildPrivateBusinessProfile(owner,{...business,slug:"audit-barber",businessId:"attacker",acceptingBookings:true},"server timestamp");
  assert.equal(p.businessId,owner.uid);
  assert.equal(p.acceptingBookings,false);
  assert.deepEqual(drafts.ownerDraftPath(owner),["users",owner.uid,"onboardingDrafts","setup-v1"]);
  assert.notDeepEqual(drafts.ownerDraftPath(owner),drafts.ownerDraftPath(other));
 });
 await t.test("Five-step setup, draft recovery and completion are owner-bound",()=>{
  assert.equal(wizard.STEPS.length,5);
  assert.equal(setup.validateSetup(business),true);
  assert.equal(drafts.recoverDraft(owner,envelope).completedStep,4);
  assert.throws(()=>drafts.recoverDraft(other,envelope),/unavailable/);
  assert.throws(()=>complete.validateCompletion(other,envelope),/unavailable/);
  assert.equal(complete.validateCompletion(owner,envelope).status,"ready-for-review");
  assert.throws(()=>complete.validateCompletion(owner,envelope,{}),/already/);
  assert.equal(complete.ONBOARDING_COMPLETION_ENABLED,false);
  assert.equal(drafts.SAVE_RESUME_ENABLED,false);
  await assert.rejects(drafts.saveDraft({}),/not enabled/);
  await assert.rejects(drafts.resumeDraft({}),/not enabled/);
  await assert.rejects(complete.completeOnboarding(),/not enabled/);
 });
 await t.test("Dashboard and editor are offline only; existing bookings untouched",async()=>{
  assert.equal(dashboard.DASHBOARD_PREVIEW_ONLY,true);
  assert.equal(dashboard.CUSTOMER_BOOKINGS_ENABLED,false);
  assert.equal(editor.DASHBOARD_WRITES_ENABLED,false);
  assert.equal(editor.PUBLIC_REGISTRATION_ENABLED,false);
  const e=editor.createEditor();
  e.addService({name:"Shampoo",price:"5",duration:15});
  assert.equal(e.state().dirty,true);
  e.discard();
  assert.equal(e.state().dirty,false);
  await assert.rejects(editor.persistDashboardChanges(),/disabled/);
  assert.equal(dashboard.dashboardModel().bookingStatus,"Disabled");
 });
 await t.test("Rules reserve private drafts and completion markers, and deny public writes",()=>{
  const rules=read("firestore.rules");
  assert.match(rules,/match \/users\/\{userId\}\/onboardingDrafts\/\{draftId\} \{\s*allow read, write: if false;/);
  assert.match(rules,/match \/users\/\{userId\}\/onboardingCompletion\/\{completionId\} \{\s*allow read, write: if false;/);
  assert.match(rules,/function isVerifiedOwner\(userId\)/);
  assert.match(rules,/request\.auth\.token\.email_verified == true/);
  assert.match(rules,/acceptingBookings/);
 });
 await t.test("Preview pages have no submission or persistence wiring",()=>{
  for(const p of ["website/business/register/index.html","website/business/setup/index.html","website/business/dashboard/index.html","website/business/dashboard/manage.html"]){
   const html=read(p);
   assert.match(html,/noindex,nofollow/);
   assert.doesNotMatch(html,/<script[^>]+src="https?:\/\//);
  }
  for(const p of ["website/business/dashboard/manage.mjs","website/business/dashboard/view.mjs","website/business/setup/wizard.mjs"]){
   const js=read(p);
   assert.doesNotMatch(js,/\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b|\bsetDoc\s*\(/);
   assert.doesNotMatch(js,/\.innerHTML\s*=/);
  }
 });
 await t.test("Release readiness explicitly remains NO-GO",()=>{
  const report=read("docs/PHASE18_ONBOARDING_READINESS.md");
  assert.match(report,/NO-GO/);
  assert.match(report,/Firebase emulator/i);
  assert.match(report,/transaction/i);
  assert.match(report,/legacy Android/i);
  assert.match(report,/no deployment/i);
 });
});
