"use strict";
// Phase 20.15 consolidated regression gate: static release safeguards and suite wiring.
// Functional Chromium and Firebase emulator suites run separately in the same workflow.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const dashboard="website/business/dashboard/";
const workflow=read(".github/workflows/boustio-phase20-firebase-emulators.yml");
test("Public registration, customer booking and live dashboard flags remain disabled",()=>{
 for(const p of ["session-integration-foundation.mjs","session-recovery-foundation.mjs"]){
  const s=read(dashboard+p);
  assert.match(s,/export const PUBLIC_REGISTRATION_ENABLED=false;/);
  assert.match(s,/export const CUSTOMER_BOOKINGS_ENABLED=false;/);
 }
 assert.match(read(dashboard+"session-integration-foundation.mjs"),/export const LIVE_DASHBOARD_ENABLED=false;/);
 assert.match(read(dashboard+"session-recovery-foundation.mjs"),/export const LIVE_SESSION_RECOVERY_ENABLED=false;/);
});
test("Regression workflow runs all browser recovery, multi-device and security suites",()=>{
 for(const p of [
 "phase20_playwright_browser.test.cjs",
 "phase20_playwright_session_recovery.test.cjs",
 "phase20_playwright_multidevice.test.cjs",
 "phase20_playwright_security_failures.test.cjs",
 "phase20_phase_completion_gate.test.cjs"
 ])assert.ok(workflow.includes("tests/"+p),p);
 assert.match(workflow,/runs-on: ubuntu-24\.04/);
 assert.match(workflow,/playwright@1\.56\.1/);
});
test("Firebase emulator job uses only demo project, never production credentials",()=>{
 assert.match(workflow,/GCLOUD_PROJECT: demo-boustio-phase20/);
 assert.match(workflow,/--project demo-boustio-phase20 --only auth,firestore/);
 assert.match(workflow,/permissions:\s*\n\s*contents: read/);
 assert.doesNotMatch(workflow,/firebase deploy|wrangler deploy|cloudflare\/wrangler-action/);
});
test("Security, recovery and account isolation functional test suites remain present",()=>{
 const suites={
  "tests/phase20_playwright_browser.test.cjs":["offline","owner"],
  "tests/phase20_playwright_session_recovery.test.cjs":["reload","signOut"],
  "tests/phase20_playwright_multidevice.test.cjs":["Two Chromium devices","offline"],
  "tests/phase20_playwright_security_failures.test.cjs":["permission denied","token"]
 };
 for(const [p,terms] of Object.entries(suites)){
  const source=read(p);
  for(const term of terms)assert.ok(source.toLowerCase().includes(term.toLowerCase()),p+" missing "+term);
 }
});
test("Phase 20 readiness report explicitly blocks launch and records outstanding integration",()=>{
 const report=read("docs/PHASE20_15_FINAL_READINESS.md");
 for(const term of ["NO-GO","Firebase browser","physical-device","registration","customer bookings","no deployment"])
 assert.ok(report.toLowerCase().includes(term.toLowerCase()),"Missing readiness note: "+term);
});
