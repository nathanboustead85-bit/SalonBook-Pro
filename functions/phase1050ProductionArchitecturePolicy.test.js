"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {POLICY,evaluateReadiness}=require("./phase1050ProductionArchitecturePolicy");
const source=n=>fs.readFileSync(path.join(__dirname,n),"utf8");
test("production execution is explicitly blocked in proposed architecture",()=>{
 assert.equal(POLICY.productionWriteAllowed,false);
 const result=evaluateReadiness();
 assert.equal(result.approved,false);
 assert.equal(result.productionWriteAllowed,false);
 assert.ok(result.blockers.length>=2);
});
test("independent audit is required but explicitly not configured",()=>{
 assert.equal(POLICY.independentAudit.required,true);
 assert.equal(POLICY.independentAudit.configured,false);
 assert.equal(POLICY.independentAudit.separateAdministrativeBoundary,true);
 assert.equal(POLICY.independentAudit.appendOnly,true);
 assert.equal(POLICY.independentAudit.failClosedOnUnavailable,true);
});
test("key custody is required but not configured and CI private keys are prohibited",()=>{
 assert.equal(POLICY.keyCustody.configured,false);
 assert.equal(POLICY.keyCustody.privateKeyInRepository,false);
 assert.equal(POLICY.keyCustody.privateKeyInGitHubActions,false);
 assert.equal(POLICY.keyCustody.publicKeyRegistryTrustedBootstrapRequired,true);
});
test("no proposed role combines signing and audit append or broad Firestore admin",()=>{
 for(const [name,role] of Object.entries(POLICY.roles)){
  assert.equal(role.firestoreAdmin,false,name);
  assert.equal(role.sign&&role.auditAppend,false,name);
 }
});
test("issuance and consumption write sets are enumerated and exclude bookings",()=>{
 assert.equal(POLICY.issuanceWrites.length,4);
 assert.equal(POLICY.consumptionWrites.length,2);
 for(const item of POLICY.prohibitedWrites){
  assert.equal(POLICY.issuanceWrites.includes(item),false,item);
  assert.equal(POLICY.consumptionWrites.includes(item),false,item);
 }
});
test("production index does not export emulator approval or security policy modules",()=>{
 const index=source("index.js");
 for(const name of ["phase1040EmulatorLockedInitialization",
 "phase1041EmulatorApprovalIssuance","phase1046TrustedOrchestrator",
 "phase1048SignedApproval","phase1050ProductionArchitecturePolicy"])
 assert.equal(index.includes(name),false,name);
});
test("emulator-only signed approval enforces project and emulator environment",()=>{
 const code=source("phase1048SignedApproval.js");
 for(const marker of ["FIRESTORE_EMULATOR_HOST","FIREBASE_AUTH_EMULATOR_HOST",
 "GOOGLE_APPLICATION_CREDENTIALS","GCLOUD_PROJECT","GOOGLE_CLOUD_PROJECT"])
 assert.ok(code.includes(marker),marker);
});
test("proposed policy refuses a widened write gate and role privilege escalation",()=>{
 const p={...POLICY,productionWriteAllowed:true,roles:{
  ...POLICY.roles,signingOperator:{firestoreAdmin:true,sign:true,auditAppend:true}
 }};
 const result=evaluateReadiness(p);
 assert.equal(result.approved,false);
 assert.ok(result.blockers.includes("production write gate"));
 assert.ok(result.blockers.includes("privilege separation violation"));
});
test("proposed policy refuses protected booking write scope",()=>{
 const p={...POLICY,issuanceWrites:[...POLICY.issuanceWrites,POLICY.prohibitedWrites[0]]};
 assert.ok(evaluateReadiness(p).blockers.includes("protected bookings write scope"));
});
