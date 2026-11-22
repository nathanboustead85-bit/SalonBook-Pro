"use strict";
const fs=require("node:fs"),path=require("node:path");
const {auditPhase42}=require("../phase42/final-audit-42-5");
const root=path.resolve(__dirname,"../..");
const sources=Object.freeze([1,2,3,4].map((n)=>["trusted-auth-contract-43-1.js","revocation-gate-43-2.js","app-check-policy-43-3.js","secure-dashboard-recovery-43-4.js"][n-1]).map(x=>"web/phase43/"+x));
const tests=Object.freeze([1,2,3,4].flatMap(n=>["tests/phase43_"+n+"_"+({1:"auth",2:"revocation",3:"policy",4:"recovery"}[n])+".test.cjs","tests/phase43_"+n+"_emulator.test.cjs"]));
const docs=Object.freeze([1,2,3,4,5].map(n=>"web/phase43/README-43-"+n+".md"));
const workflows=Object.freeze(["boustio-phase43-1-trusted-auth.yml","boustio-phase43-2-revocation.yml","boustio-phase43-3-app-check-policy.yml","boustio-phase43-4-secure-recovery.yml","boustio-phase43-5-final-audit.yml"].map(x=>".github/workflows/"+x));
const blockers=Object.freeze([
{id:"43.5-P0-01",reason:"No independently verified trusted backend or real Firebase Admin checkRevoked verification"},
{id:"43.5-P0-02",reason:"No real App Check attestation enforcement, app identity approval or atomic server-bound replay storage"},
{id:"43.5-P0-03",reason:"No independently verified real staging browser/Android integration, security sign-off or cross-device consistency"},
{id:"43.5-P0-04",reason:"No approved non-destructive Android appointment backup, migration and rollback"},
{id:"43.5-P0-05",reason:"No Samsung accessibility, offline, recovery and multi-device acceptance sign-off"},
{id:"43.5-P0-06",reason:"No production privacy, monitoring, incident response, deployment or launch approvals"},
{id:"43.5-P0-07",reason:"Synthetic emulator tests cannot prove real revocation, token provenance, App Check replay resistance or live concurrency"}
].map(x=>Object.freeze({...x,status:"OPEN"})));
function auditPhase43(){
 const prior=auditPhase42(),failures=[];
 if(prior.status!=="ISOLATED_AUDIT_CHECKS_PASSED")failures.push("phase42_audit_failed");
 for(const file of [...sources,...tests,...docs,...workflows]){
  const full=path.join(root,file);
  if(!fs.existsSync(full)){failures.push("missing:"+file);continue}
  const content=fs.readFileSync(full,"utf8");
  if(!content.trim())failures.push("empty:"+file);
  if(file.startsWith("web/phase43/")&&file.endsWith(".js")&&/\b(?:initializeApp|addDoc|setDoc|updateDoc|deleteDoc)\s*\(/.test(content))failures.push("unexpected_sdk_write_or_init:"+file);
  if(file.startsWith(".github/")&&/\b(?:firebase deploy|gh release|npm publish)\b/.test(content))failures.push("deployment_command:"+file);
 }
 return Object.freeze({status:failures.length?"ISOLATED_AUDIT_FAILED":"ISOLATED_AUDIT_CHECKS_PASSED",failures:Object.freeze(failures),blockers,priorBlockers:prior.blockers,sourceCount:sources.length,regressionFileCount:tests.length,stagingConnected:false,stagingApproved:false,productionReady:false,migrationApproved:false,crossDeviceRevisionVerified:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({auditPhase43,blockers,sources,tests,docs,workflows});
