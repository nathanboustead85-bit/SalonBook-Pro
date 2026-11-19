"use strict";
// Phase 26.1: read-only source audit; no cloud SDK, network, credentials or writes.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const exists=p=>fs.existsSync(path.join(root,p));
const sources={
 android:"app/build.gradle.kts",manifest:"app/src/main/AndroidManifest.xml",
 customer:"website/customer/phase25-integration.mjs",
 onboarding:"website/business/onboarding/phase24-profile.mjs",
 policies:"website/business/onboarding/phase24-policies.mjs",
 rules:"firestore.rules",firebase:"firebase.json",
 functions:"functions/index.js",booking:"website/book/index.html",
 publishWorkflow:".github/workflows/boustio-publishbusiness-release-readiness.yml"
};
for(const [area,file] of Object.entries(sources))test("Audit source exists: "+area,()=>assert.ok(exists(file),file));
test("Android debug has separate package identity",()=>assert.match(read(sources.android),/applicationIdSuffix\s*=\s*"\.[^"]+"/));
test("Android release signing is configured, not invoked",()=>assert.match(read(sources.android),/signingConfigs/));
test("Android keeps internal screens non-exported",()=>{const s=read(sources.manifest);for(const name of ["ManagementActivity","CloudActivity","BusinessProfileActivity","ChatInboxActivity"])assert.match(s,new RegExp(name+'[^>]*android:exported="false"'));});
test("Android backup policy requires manual review",()=>assert.match(read(sources.manifest),/android:allowBackup="true"/));
test("Customer facade explicitly disables live actions",()=>{const s=read(sources.customer);for(const key of ["bookings","registration","payments","publishing"])assert.match(s,new RegExp(key+":false"));for(const key of ["canBook","canRegister","canPay","canPublish"])assert.match(s,new RegExp("get "+key+"\\(\\)\\{return false;\\}"));});
test("Onboarding demo has disabled feature flags and demo owner guard",()=>{const s=read(sources.onboarding);assert.match(s,/registration:false,bookings:false,payments:false,publishing:false/);assert.match(s,/demo-/);});
test("Policies demo has disabled feature flags",()=>assert.match(read(sources.policies),/registration:false,bookings:false,payments:false,publishing:false/));
test("Firestore has owner and verified-owner checks",()=>{const s=read(sources.rules);assert.match(s,/function isOwner\(/);assert.match(s,/function isVerifiedOwner\(/);assert.match(s,/email_verified/);});
test("Firestore has explicit booking-mode guard",()=>assert.match(read(sources.rules),/function legacyBookingWriteAllowed\(/));
test("Firebase config points to rules and local emulators",()=>{const j=JSON.parse(read(sources.firebase));assert.equal(j.firestore.rules,"firestore.rules");assert.equal(j.emulators.firestore.host,"127.0.0.1");assert.equal(j.emulators.auth.host,"127.0.0.1");});
test("Firebase Hosting contains function and booking rewrites",()=>{const j=JSON.parse(read(sources.firebase));assert.ok(j.hosting.rewrites.some(r=>r.source==="/book/**"));assert.ok(j.hosting.rewrites.some(r=>r.function));});
test("Publishing functions exist but must not be invoked by audit",()=>{const s=read(sources.functions);assert.match(s,/publishBusiness/);assert.match(s,/unpublishBusiness/);});
test("Existing publishing readiness workflow is manual and no-deploy",()=>{const s=read(sources.publishWorkflow);assert.match(s,/workflow_dispatch:/);assert.doesNotMatch(s,/firebase deploy|gcloud .*deploy|npm run deploy/);});
test("Customer website exists",()=>assert.match(read(sources.booking),/<title>[^<]*Boustio/i));
test("Audit workflow cannot deploy or access credentials",()=>{const s=read(".github/workflows/boustio-phase26-readiness-audit.yml");assert.match(s,/contents: read/);assert.match(s,/persist-credentials: false/);assert.doesNotMatch(s,/firebase deploy|gcloud .*deploy|secrets\.|id-token: write|firebase emulators:exec/);});
