"use strict";
/** Phase 11.18: CI-only staging readiness regression. No remote services. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");
const root=path.resolve(__dirname,"..");
const staging=fs.readFileSync(path.join(__dirname,"phase1117StagingTransport.js"),"utf8");
const entry=fs.readFileSync(path.join(__dirname,"index.js"),"utf8");
const workflow=fs.readFileSync(path.join(root,".github/workflows/legacy-mode-emulator-safety.yml"),"utf8");
test("11.18 staging transport remains test-only and cannot be exposed from production",()=>{
 assert.doesNotMatch(entry,/phase1117StagingTransport|phase1118StagingReadiness/);
 assert.ok(staging.includes("staging-") && staging.includes("example\\.test"));
 assert.match(staging,/redirect:"error"/);
 assert.match(staging,/method:"POST"/);
 assert.match(staging,/guard\(\)/);
});
test("11.18 CI explicitly runs safety checks on the development branch",()=>{
 assert.match(workflow,/phase-9d4-teal-clients/);
 assert.match(workflow,/phase1117StagingTransport\.test\.js/);
 assert.match(workflow,/phase1118StagingReadiness\.test\.js/);
 assert.match(workflow,/demo-boustio-legacy-init/);
 assert.match(workflow,/permissions:\s*\n\s*contents: read/);
});
test("11.18 safety checks must never embed real production credentials or deploy",()=>{
 assert.doesNotMatch(staging,/salonbook-pro-ad5ff|firebase deploy|gcloud deploy|process\.env\.FIREBASE_TOKEN/);
 assert.doesNotMatch(workflow,/firebase deploy|gcloud deploy/);
});
