"use strict";
// Source-grounded isolated audit; no staging or production launch approval.
const fs=require("node:fs"),path=require("node:path");
const {auditPhase40}=require("../phase40/final-audit-40-5");
const {validateStagingEnvironment}=require("./staging-contract-41-1");
const root=path.resolve(__dirname,"../..");
const sources=Object.freeze(["web/phase41/staging-contract-41-1.js","web/phase41/emulator-auth-adapter-41-2.js","web/phase41/dashboard-data-41-3.js","web/phase41/multidevice-recovery-41-4.js"]);
const tests=Object.freeze(["tests/phase41_1_contract.test.cjs","tests/phase41_1_emulator.test.cjs","tests/phase41_2_auth.test.cjs","tests/phase41_3_data.test.cjs","tests/phase41_3_emulator.test.cjs","tests/phase41_4_recovery.test.cjs","tests/phase41_4_emulator.test.cjs"]);
const workflows=Object.freeze([".github/workflows/boustio-phase41-1-staging-architecture.yml",".github/workflows/boustio-phase41-2-emulator-auth.yml",".github/workflows/boustio-phase41-3-dashboard-data.yml",".github/workflows/boustio-phase41-4-multidevice-recovery.yml",".github/workflows/boustio-phase41-5-final-audit.yml"]);
const blockers=Object.freeze([
 {id:"41.5-P0-01",status:"OPEN",reason:"No independently verified real staging SDK connectivity, App Check or trusted revocation backend"},
 {id:"41.5-P0-02",status:"OPEN",reason:"Android v1 has no business-wide opening hours or verified cross-device shared revision; proposed v2 is not migrated"},
 {id:"41.5-P0-03",status:"OPEN",reason:"No approved non-destructive backup, migration and rollback for existing Android appointments"},
 {id:"41.5-P0-04",status:"OPEN",reason:"No Samsung real-device, accessibility, offline and multi-device acceptance sign-off"},
 {id:"41.5-P0-05",status:"OPEN",reason:"No production privacy, monitoring, incident response, independent security or deployment approval"},
 {id:"41.5-P0-06",status:"OPEN",reason:"Phase 41.2 auth adapter and Phase 41.4 recovery are isolated contracts, not a verified end-to-end mounted browser session"}
].map(x=>Object.freeze(x)));
function auditPhase41(){
 const failures=[],prior=auditPhase40();
 if(prior.status!=="ISOLATED_AUDIT_CHECKS_PASSED")failures.push("phase40_audit_failed");
 for(const file of [...sources,...tests,...workflows]){
  const absolute=path.join(root,file);
  if(!fs.existsSync(absolute)){failures.push("missing:"+file);continue}
  const content=fs.readFileSync(absolute,"utf8");
  if(!content.trim())failures.push("empty:"+file);
  if(file.startsWith("web/")&&/\b(?:initializeApp|addDoc|setDoc|updateDoc|deleteDoc)\s*\(/.test(content))failures.push("write_or_init:"+file);
  if(file.startsWith(".github/")&&/\b(?:firebase deploy|gh release|npm publish)\b/.test(content))failures.push("deployment:"+file);
 }
 const environment={mode:"EMULATOR_ONLY",projectId:"demo-boustio-phase41-5",firestoreHost:"127.0.0.1:18080",authHost:"127.0.0.1:19099",allowNetwork:false,allowWrites:false,allowDeploy:false};
 if(validateStagingEnvironment(environment).status!=="EMULATOR_CONTRACT_VALID")failures.push("environment_not_isolated");
 return Object.freeze({status:failures.length?"ISOLATED_AUDIT_FAILED":"ISOLATED_AUDIT_CHECKS_PASSED",failures:Object.freeze(failures),blockers,stagingConnected:false,stagingApproved:false,productionReady:false,migrationApproved:false,revisionVerified:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({auditPhase41,blockers,sources,tests,workflows});
