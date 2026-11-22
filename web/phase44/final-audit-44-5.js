"use strict";
// Static isolated security audit; never initializes SDKs or accesses customer data.
const fs=require("node:fs"),path=require("node:path");
const {auditPhase43}=require("../phase43/final-audit-43-5");
const root=path.resolve(__dirname,"../..");
const sources=Object.freeze(["admin-verification-44-1.js","owner-session-44-2.js","business-data-44-3.js","resilience-44-4.js"].map(x=>"web/phase44/"+x));
const tests=Object.freeze(["phase44_1_admin.test.cjs","phase44_2_owner.test.cjs","phase44_3_business.test.cjs","phase44_4_resilience.test.cjs",...[1,2,3,4].map(n=>"phase44_"+n+"_emulator.test.cjs")].map(x=>"tests/"+x));
const docs=Object.freeze([1,2,3,4,5].map(n=>"web/phase44/README-44-"+n+".md"));
const workflows=Object.freeze(["boustio-phase44-1-admin-contract.yml","boustio-phase44-2-owner-session.yml","boustio-phase44-3-business-data.yml","boustio-phase44-4-resilience.yml","boustio-phase44-5-final-audit.yml"].map(x=>".github/workflows/"+x));
const blockers=Object.freeze([
 ["44.5-P0-01","Real trusted backend, Firebase Admin revocation verification and staging credentials not independently validated"],
 ["44.5-P0-02","Real App Check attestation, approved app identity and atomic replay consumption not verified"],
 ["44.5-P0-03","No approved staging browser/Android end-to-end integration or cross-device revision guarantee"],
 ["44.5-P0-04","Two original Android appointments require approved non-destructive backup, migration and rollback before any live transition"],
 ["44.5-P0-05","Samsung accessibility, multi-device, offline and recovery acceptance sign-off pending"],
 ["44.5-P0-06","Production privacy, monitoring, incident response, deployment and launch approvals pending"],
 ["44.5-P0-07","Synthetic injected callbacks and emulator tests cannot establish production authorization, revocation or live concurrency guarantees"]
].map(([id,reason])=>Object.freeze({id,reason,status:"OPEN"})));
function auditPhase44(){
 const prior=auditPhase43(),failures=[];
 if(prior.status!=="ISOLATED_AUDIT_CHECKS_PASSED")failures.push("phase43_audit_failed");
 for(const file of [...sources,...tests,...docs,...workflows]){
  const full=path.join(root,file);
  if(!fs.existsSync(full)){failures.push("missing:"+file);continue}
  const content=fs.readFileSync(full,"utf8");
  if(!content.trim())failures.push("empty:"+file);
  if(file.startsWith("web/phase44/")&&file.endsWith(".js")&&/\b(?:initializeApp|initializeTestEnvironment|addDoc|setDoc|updateDoc|deleteDoc)\s*\(/.test(content))failures.push("unexpected_sdk_write_or_init:"+file);
  if(file.startsWith(".github/")&&/\b(?:firebase deploy|gh release|npm publish)\b/.test(content))failures.push("deployment_command:"+file);
 }
 return Object.freeze({status:failures.length?"ISOLATED_AUDIT_FAILED":"ISOLATED_AUDIT_CHECKS_PASSED",failures:Object.freeze(failures),blockers,priorBlockers:prior.blockers,sourceCount:sources.length,regressionFileCount:tests.length,stagingConnected:false,stagingApproved:false,productionReady:false,migrationApproved:false,crossDeviceRevisionVerified:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({auditPhase44,blockers,sources,tests,docs,workflows});
