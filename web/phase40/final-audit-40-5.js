"use strict";
// Source-grounded audit of isolated contracts, not production security certification.
const fs=require("node:fs"),path=require("node:path");
const {assessReadiness}=require("./readiness-assessment-40-1");
const {inspectHours,inspectSharedRevision}=require("./hours-revision-contract-40-3");
const root=path.resolve(__dirname,"../..");
const sources=Object.freeze([
 "web/phase40/browser-dashboard-40-2.js",
 "web/phase40/hours-revision-contract-40-3.js",
 "web/phase40/secure-recovery-40-4.js",
 "web/phase39/unified-session-39-2.js",
 "web/phase39/android-compatibility-39-4.js"
]);
const workflows=Object.freeze([
 ".github/workflows/boustio-phase40-2-isolated-browser.yml",
 ".github/workflows/boustio-phase40-3-hours-revision.yml",
 ".github/workflows/boustio-phase40-4-session-security.yml",
 ".github/workflows/boustio-phase40-5-final-audit.yml"
]);
const blockers=Object.freeze([
 {id:"40.5-P0-01",status:"OPEN",description:"No real staging SDK integration, trusted revocation backend or independent App Check verification"},
 {id:"40.5-P0-02",status:"OPEN",description:"Business-wide hours and shared revisions are proposed v2 contracts only; Android v1 has neither"},
 {id:"40.5-P0-03",status:"OPEN",description:"No approved backup, migration, recovery and rollback process for existing Android appointments"},
 {id:"40.5-P0-04",status:"OPEN",description:"No Samsung accessibility and multi-device real-world acceptance sign-off"},
 {id:"40.5-P0-05",status:"OPEN",description:"No production privacy, operational, security or deployment approval"}
].map(x=>Object.freeze(x)));
function auditPhase40(){
 const failures=[],readiness=assessReadiness();
 if(!readiness.sourceBoundaryPassed)failures.push("phase39_source_boundary_failed");
 for(const file of [...sources,...workflows]){
  const absolute=path.join(root,file);
  if(!fs.existsSync(absolute)){failures.push("missing:"+file);continue}
  const content=fs.readFileSync(absolute,"utf8");
  if(!content.trim())failures.push("empty:"+file);
  if(file.startsWith("web/")&&/\b(?:initializeApp|addDoc|setDoc|updateDoc|deleteDoc)\s*\(/.test(content))failures.push("write_or_init:"+file);
  if(file.startsWith(".github/")&&/\b(?:firebase deploy|gh release|npm publish)\b/.test(content))failures.push("deploy:"+file);
 }
 const emptyHours=Object.fromEntries(["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].map(d=>[d,[]]));
 if(inspectHours(emptyHours).status!=="HOURS_SCHEMA_VALID")failures.push("hours_contract_failed");
 if(inspectSharedRevision({ownerUid:"synthetic",documents:{},hours:emptyHours}).status!=="UNAVAILABLE")failures.push("revision_fail_open");
 return Object.freeze({status:failures.length?"ISOLATED_AUDIT_FAILED":"ISOLATED_AUDIT_CHECKS_PASSED",failures:Object.freeze(failures),blockers,productionReady:false,stagingApproved:false,migrationApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({auditPhase40,blockers});
