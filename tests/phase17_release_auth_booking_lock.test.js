"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const source=p=>fs.readFileSync(path.join(root,p),"utf8");
const json=p=>JSON.parse(source(p));

test("Phase 17 release configuration and booking lock (offline)",async t=>{
 await t.test("Firebase production and emulator are isolated",()=>{
  const rc=json(".firebaserc"),cfg=json("firebase.json");
  assert.equal(rc.projects.production,"salonbook-pro-ad5ff");
  assert.equal(rc.projects.emulator,"demo-boustio-migration");
  assert.notEqual(rc.projects.production,rc.projects.emulator);
  assert.equal(cfg.functions.source,"functions");
  assert.equal(cfg.functions.runtime,"nodejs22");
  assert.equal(cfg.firestore.rules,"firestore.rules");
 });
 await t.test("Public booking functions are not exported",()=>{
  const src=source("functions/index.js");
  const exported=[...src.matchAll(/\bexports\.([A-Za-z_$][\w$]*)\s*=/g)].map(m=>m[1]);
  const expected=["publishBusiness","unpublishBusiness","sendBusinessChatReply","startCustomerChat","sendCustomerChatMessage","getCustomerChatMessages","inspectLegacyBookingMigration","getPublicBusinessProfile","publishPublicCatalogue"];
  assert.deepEqual(exported.sort(),expected.sort(),"Unexpected backend export requires security review");
  for(const forbidden of ["createBooking","publicBooking","trustedBooking","confirmBooking","reserveSlot","executeMigration","migrateBookings"]){
   assert.ok(!exported.includes(forbidden),forbidden+" must not be exported");
  }
  assert.ok((src.match(/acceptingBookings:\s*false\b/g)||[]).length>=2);
  assert.doesNotMatch(src,/acceptingBookings:\s*true\b/);
 });
 await t.test("Protected IAM checks require authenticated OIDC identity",()=>{
  for(const file of [".github/workflows/boustio-deploy-permissions-readonly.yml",".github/workflows/boustio-phase-1728-deployment-permissions.yml"]){
   const w=source(file);
   assert.match(w,/google-github-actions\/auth@v2/);
   assert.match(w,/workload_identity_provider:/);
   assert.match(w,/service_account:/);
   assert.match(w,/id-token: write/);
   assert.match(w,/environment: boustio-function-deployment/);
   assert.match(w,/github\.ref == 'refs\/heads\/milestone-customer-booking-experience'/);
  }
 });
 await t.test("Production deployment gate remains verification only",()=>{
  const w=source(".github/workflows/production-deployment.yml");
  assert.match(w,/github\.ref == 'refs\/heads\/production-release'/);
  assert.match(w,/inputs\.confirmation == 'PREPARE-BOUSTIO'/);
  assert.match(w,/environment:\s*\n\s*name: production/);
  assert.match(w,/No Firebase deployment commands executed/);
  assert.doesNotMatch(w,/firebase deploy --only|gcloud functions deploy|gcloud run deploy/);
 });
});
