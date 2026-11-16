"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const workflow=fs.readFileSync(path.join(__dirname,"../.github/workflows/boustio-phase-174-live-firebase-readonly.yml"),"utf8");
const probe=fs.readFileSync(path.join(__dirname,"../scripts/phase173_real_firebase_readonly_probe.js"),"utf8");
const backend=fs.readFileSync(path.join(__dirname,"../functions/phase173RealFirebaseReadOnlyProbe.js"),"utf8");
const index=fs.readFileSync(path.join(__dirname,"../functions/index.js"),"utf8");
for(const marker of ["workflow_dispatch:","VERIFY_READ_ONLY","environment: boustio-readonly-verification","id-token: write","google-github-actions/auth@v2","workload_identity_provider:","service_account:","BOUSTIO_FIREBASE_OWNER_ID","node scripts/phase173_real_firebase_readonly_probe.js"]){
 assert.ok(workflow.includes(marker),"missing live verification guard: "+marker);
}
assert.ok(!workflow.includes("push:"),"live workflow must never auto-run on pushes");
assert.ok(!workflow.includes("schedule:"),"live workflow must never run on schedule");
assert.ok(!workflow.includes("firebase deploy"),"no Firebase deployment");
assert.ok(!workflow.includes("service_account_key"),"no JSON private key in workflow");
assert.ok(probe.includes("BOUSTIO_PHASE173_APPROVED"),"explicit opt-in required");
assert.ok(probe.includes("FIRESTORE_EMULATOR_HOST"),"emulator confusion guard required");
assert.ok(backend.includes("readOnly:true"),"read-only Firestore transaction required");
assert.ok(!index.includes("phase173RealFirebaseReadOnlyProbe"),"probe must not be publicly deployed");
console.log("PASS Phase 17.4 opt-in OIDC live Firebase workflow contract, disabled bookings, no auto-run");
