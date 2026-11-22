"use strict";
// Static isolated staging audit only. Never initializes Firebase or performs writes/deploys.
const fs=require("node:fs"),path=require("node:path");
const {auditPhase44}=require("../phase44/final-audit-44-5");
const {stagingReadiness}=require("./staging-readiness-45-1");
const {validateSafeConfiguration,expected}=require("./secrets-guard-45-2");
const {authorizeOwnerRead}=require("./access-guard-45-3");
const root=path.resolve(__dirname,"../..");
const sources=Object.freeze(["staging-readiness-45-1.js","secrets-guard-45-2.js","access-guard-45-3.js","integrity-recovery-45-4.js","final-audit-45-5.js"].map(x=>"web/phase45/"+x));
const tests=Object.freeze([1,2,3,4,5].map((n)=>"tests/phase45_"+n+"_"+({1:"readiness",2:"secrets",3:"access",4:"integrity",5:"audit"}[n])+".test.cjs").concat([1,2,3,4,5].map(n=>"tests/phase45_"+n+"_emulator.test.cjs")));
const docs=Object.freeze([1,2,3,4,5].map(n=>"web/phase45/README-45-"+n+".md"));
const workflows=Object.freeze(["boustio-phase45-1-staging-safety.yml","boustio-phase45-2-secrets-safety.yml","boustio-phase45-3-access-safety.yml","boustio-phase45-4-integrity-recovery.yml","boustio-phase45-5-final-audit.yml"].map(x=>".github/workflows/"+x));
const blockers=Object.freeze(auditPhase44().blockers.map(b=>Object.freeze({...b,status:"OPEN"})));
function auditPhase45(){
 const failures=[],prior=auditPhase44();
 if(prior.status!=="ISOLATED_AUDIT_CHECKS_PASSED")failures.push("prior_audit_failed");
 const readiness=stagingReadiness(expected),secrets=validateSafeConfiguration({...expected});
 if(readiness.status!=="PREPARATION_ONLY"||secrets.status!=="ISOLATED_SECRETS_CHECK_PASSED")failures.push("isolation_validation_failed");
 const identity={uid:"synthetic-owner",emailVerified:true,revocationVerified:true,appCheckVerified:true,sessionActive:true,online:true};
 if(authorizeOwnerRead({identity,ownerId:"synthetic-owner",resourceOwnerId:"different-owner"}).status!=="DENIED")failures.push("cross_owner_not_denied");
 if(authorizeOwnerRead({identity,ownerId:"synthetic-owner",resourceOwnerId:"synthetic-owner",operation:"write"}).status!=="DENIED")failures.push("write_not_denied");
 for(const file of [...sources,...tests,...docs,...workflows]){
  const full=path.join(root,file);
  if(!fs.existsSync(full)){failures.push("missing:"+file);continue}
  const content=fs.readFileSync(full,"utf8");
  if(!content.trim())failures.push("empty:"+file);
  if(file.startsWith("web/phase45/")&&file.endsWith(".js")&&/\b(?:initializeApp|initializeTestEnvironment|addDoc|setDoc|updateDoc|deleteDoc)\s*\(/.test(content))failures.push("unexpected_sdk_operation:"+file);
  if(file.startsWith(".github/")&&/\b(?:firebase deploy|gh release|npm publish)\b/.test(content))failures.push("deployment_command:"+file);
 }
 return Object.freeze({status:failures.length?"ISOLATED_AUDIT_FAILED":"ISOLATED_AUDIT_CHECKS_PASSED",failures:Object.freeze(failures),blockers,sourceCount:sources.length,regressionFileCount:tests.length,rollbackApproved:false,stagingConnected:false,stagingApproved:false,productionReady:false,originalAppointmentsMigrationApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({auditPhase45,blockers,sources,tests,docs,workflows});
