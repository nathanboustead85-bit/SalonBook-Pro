"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {initialiseWithSingleUseApproval}=require("./phase1040EmulatorLockedInitialization");
const {issueEmulatorApproval}=require("./phase1041EmulatorApprovalIssuance");
const envKeys=["FIRESTORE_EMULATOR_HOST","GCLOUD_PROJECT","GOOGLE_CLOUD_PROJECT",
 "GOOGLE_APPLICATION_CREDENTIALS","BOUSTIO_LEGACY_EMULATOR_TEST_GATE"];
function withEnv(values,fn){
 const before=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 for(const k of envKeys)delete process.env[k];
 Object.assign(process.env,values);
 return Promise.resolve().then(fn).finally(()=>{
  for(const k of envKeys){if(before[k]===undefined)delete process.env[k];
  else process.env[k]=before[k];}
 });
}
const demo={FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080",
 GCLOUD_PROJECT:"demo-boustio-legacy-init",
 GOOGLE_CLOUD_PROJECT:"demo-boustio-legacy-init"};
const db={projectId:"demo-boustio-legacy-init"};
test("direct Phase 10.40 consumer defaults to denied even in demo environment",()=>withEnv(demo,async()=>{
 await assert.rejects(initialiseWithSingleUseApproval({db,executionEnabled:true}),/Direct legacy prototype disabled/);
}));
test("direct Phase 10.41 issuer defaults to denied even in demo environment",()=>withEnv(demo,async()=>{
 await assert.rejects(issueEmulatorApproval({db,executionEnabled:true}),/Direct legacy prototype disabled/);
}));
test("legacy gate does not bypass demo-project lock",()=>withEnv({
 ...demo,GCLOUD_PROJECT:"salonbook-pro-ad5ff",
 BOUSTIO_LEGACY_EMULATOR_TEST_GATE:"explicit-test-only"
},async()=>{
 await assert.rejects(initialiseWithSingleUseApproval({db,executionEnabled:true}),/Emulator-only/);
 await assert.rejects(issueEmulatorApproval({db,executionEnabled:true}),/Dedicated emulator/);
}));
test("legacy gate does not bypass executionEnabled=false",()=>withEnv({
 ...demo,BOUSTIO_LEGACY_EMULATOR_TEST_GATE:"explicit-test-only"
},async()=>{
 await assert.rejects(initialiseWithSingleUseApproval({db}),/disabled by default/);
 await assert.rejects(issueEmulatorApproval({db}),/disabled by default/);
}));
test("production index never imports legacy prototypes or trusted orchestrator",()=>{
 const index=fs.readFileSync(path.join(__dirname,"index.js"),"utf8");
 for(const moduleName of ["phase1040EmulatorLockedInitialization",
 "phase1041EmulatorApprovalIssuance","phase1046TrustedOrchestrator"])
 assert.equal(index.includes(moduleName),false,moduleName);
});
test("legacy test gate is scoped to specific workflow steps, never job-wide",()=>{
 const workflow=fs.readFileSync(path.join(__dirname,"..",".github","workflows",
 "legacy-mode-emulator-safety.yml"),"utf8");
 assert.doesNotMatch(workflow,/^    env:\n(?:.*\n)*?      BOUSTIO_LEGACY_EMULATOR_TEST_GATE:/m);
 assert.match(workflow,/BOUSTIO_LEGACY_EMULATOR_TEST_GATE: explicit-test-only/);
});
test("direct prototype guard cannot be bypassed by passing a verifier callback",()=>withEnv(demo,async()=>{
 await assert.rejects(initialiseWithSingleUseApproval({db,executionEnabled:true,
 verifyIdToken:async()=>({uid:"owner",email_verified:true}),idToken:"fake"}),/Direct legacy prototype disabled/);
 await assert.rejects(issueEmulatorApproval({db,executionEnabled:true,
 verifyOwnerToken:async()=>({uid:"owner",email_verified:true}),
 verifyOperatorAssertion:async()=>({verified:true})}),/Direct legacy prototype disabled/);
}));
