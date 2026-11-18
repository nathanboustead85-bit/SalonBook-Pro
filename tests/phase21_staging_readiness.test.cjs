"use strict";
// Phase 21.1 is planning-only. These checks must not touch network or Firebase services.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const plan=read("docs/PHASE21_1_STAGING_READINESS.md");
const workflow=read(".github/workflows/boustio-phase21-staging-readiness.yml");
test("Phase 21.1 is explicitly no-go and does not authorize deployment",()=>{
 for(const term of ["NO-GO","No staging or production deployment","explicit approval","production-ready"])
 assert.ok(plan.includes(term),term);
});
test("Planning requires independent staging and real browser SDK integration",()=>{
 for(const term of ["separate","onAuthStateChanged","onIdTokenChanged","getIdTokenResult","onSnapshot","connectAuthEmulator","connectFirestoreEmulator","demo-boustio-phase21"])
 assert.ok(plan.includes(term),term);
});
test("No live registration, bookings, or dashboard is enabled",()=>{
 for(const p of ["website/business/dashboard/session-integration-foundation.mjs","website/business/dashboard/session-recovery-foundation.mjs"]){
  const source=read(p);
  assert.match(source,/export const PUBLIC_REGISTRATION_ENABLED=false;/);
  assert.match(source,/export const CUSTOMER_BOOKINGS_ENABLED=false;/);
 }
 assert.match(read("website/business/dashboard/session-integration-foundation.mjs"),/export const LIVE_DASHBOARD_ENABLED=false;/);
});
test("Staging readiness workflow is offline, read-only, and has no deploy credentials",()=>{
 assert.match(workflow,/permissions:\s*\n\s*contents: read/);
 assert.match(workflow,/node --test tests\/phase21_staging_readiness.test.cjs/);
 assert.doesNotMatch(workflow,/firebase deploy|wrangler deploy|secrets\.|environment: production|id-token: write/);
});
test("Plan protects Android appointments and requires separate release approval",()=>{
 for(const term of ["real customer/Android appointment records","Original two Samsung appointments","launch authorization","synthetic"])
 assert.ok(plan.includes(term),term);
});
