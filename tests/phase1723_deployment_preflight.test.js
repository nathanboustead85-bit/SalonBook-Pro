"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const code=fs.readFileSync(path.join(__dirname,"../scripts/phase1723_deployment_preflight.js"),"utf8");
const workflow=fs.readFileSync(path.join(__dirname,"../.github/workflows/boustio-phase-1723-deployment-preflight.yml"),"utf8");
for(const token of ["VERIFY_DEPLOY_PREFLIGHT","functions:publishBusiness","salonbook-pro-ad5ff","europe-west2","INVENTORY_VISIBLE_COUNT","NO_DEPLOYMENT","functions\",\"list"]){
 assert.ok(code.includes(token),"Missing preflight guard "+token);
}
for(const forbidden of ["functions\",\"deploy","functions\",\"call","firebase deploy","--only functions","db.collection(",".set("]){
 assert.ok(!code.includes(forbidden),"Unsafe script token "+forbidden);
}
assert.ok(workflow.includes("boustio-readonly-verification"));
assert.ok(workflow.includes("contents: read"));
assert.ok(workflow.includes("id-token: write"));
assert.ok(!workflow.includes("firebase deploy"));
assert.ok(!workflow.includes("npm run deploy"));
assert.ok(!workflow.includes("deploy --only"));
console.log("PASS Phase 17.23 exact-target deployment preflight and zero-write checks");
