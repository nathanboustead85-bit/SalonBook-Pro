"use strict";
// Evidence-based isolated audit. Never grants staging or production launch approval.
const fs=require("node:fs"),path=require("node:path");
const {auditPhase41}=require("../phase41/final-audit-41-5");
const root=path.resolve(__dirname,"../..");
const sources=Object.freeze(["web/phase42/isolated-staging-integration-42-1.js","web/phase42/session-hardening-42-2.js","web/phase42/session-races-42-3.js","web/phase42/session-recovery-audit-42-4.js"]);
const tests=Object.freeze(["tests/phase42_1_integration.test.cjs","tests/phase42_1_emulator.test.cjs","tests/phase42_2_session.test.cjs","tests/phase42_2_emulator.test.cjs","tests/phase42_3_races.test.cjs","tests/phase42_3_emulator.test.cjs","tests/phase42_4_recovery.test.cjs","tests/phase42_4_emulator.test.cjs"]);
const docs=Object.freeze([1,2,3,4].map(i=>"web/phase42/README-42-"+i+".md"));
const workflows=Object.freeze([".github/workflows/boustio-phase42-2-session-hardening.yml",".github/workflows/boustio-phase42-3-session-races.yml",".github/workflows/boustio-phase42-4-session-recovery.yml",".github/workflows/boustio-phase42-5-final-audit.yml"]);
const blockers=Object.freeze([
 {id:"42.5-P0-01",status:"OPEN",reason:"No independently verified real staging SDK connection, App Check or trusted backend token revocation"},
 {id:"42.5-P0-02",status:"OPEN",reason:"Android v1 lacks verified shared cross-device revision and business-wide opening hours; v2 migration not approved"},
 {id:"42.5-P0-03",status:"OPEN",reason:"No approved non-destructive backup, migration and rollback for two existing Android appointments"},
 {id:"42.5-P0-04",status:"OPEN",reason:"No Samsung real-device, accessibility, offline and multi-device acceptance sign-off"},
 {id:"42.5-P0-05",status:"OPEN",reason:"No production privacy, monitoring, incident response, independent security and deployment approvals"},
 {id:"42.5-P0-06",status:"OPEN",reason:"Phases 42.1–42.4 are injected isolated contracts, not independently verified mounted browser staging sessions"},
 {id:"42.5-P0-07",status:"OPEN",reason:"Synthetic emulator access tests do not prove cross-device revision consistency or live concurrency behavior"}
].map(x=>Object.freeze(x)));
function auditPhase42(){
 const failures=[],prior=auditPhase41();
 if(prior.status!=="ISOLATED_AUDIT_CHECKS_PASSED")failures.push("phase41_audit_failed");
 for(const file of [...sources,...tests,...docs,...workflows]){
  const abs=path.join(root,file);
  if(!fs.existsSync(abs)){failures.push("missing:"+file);continue}
  const content=fs.readFileSync(abs,"utf8");
  if(!content.trim())failures.push("empty:"+file);
  if(file.startsWith("web/phase42/")&&file.endsWith(".js")&&/\b(?:initializeApp|addDoc|setDoc|updateDoc|deleteDoc)\s*\(/.test(content))failures.push("source_write_or_init:"+file);
  if(file.startsWith(".github/")&&/\b(?:firebase deploy|gh release|npm publish)\b/.test(content))failures.push("deployment:"+file);
 }
 return Object.freeze({status:failures.length?"ISOLATED_AUDIT_FAILED":"ISOLATED_AUDIT_CHECKS_PASSED",failures:Object.freeze(failures),blockers,priorBlockers:prior.blockers,sourceCount:sources.length,regressionFileCount:tests.length,stagingConnected:false,stagingApproved:false,productionReady:false,migrationApproved:false,revisionVerified:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({auditPhase42,blockers,sources,tests,docs,workflows});
