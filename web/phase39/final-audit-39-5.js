"use strict";
// Deterministic source-boundary audit, NOT production approval or a full penetration test.
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../..");
const required=Object.freeze([
 "web/phase39/integration-contract-39-1.js",
 "web/phase39/unified-session-39-2.js",
 "web/phase39/dashboard-view-model-39-3.js",
 "web/phase39/android-compatibility-39-4.js",
 "web/phase38/owner-authorization-38-3.js",
 "web/phase38/dashboard-recovery-38-4.js",
 "web/phase36/android-business-adapter-36-1.js"
]);
const forbidden=/\b(?:initializeApp|connectFirestoreEmulator\s*\(|httpsCallable\s*\(|addDoc\s*\(|setDoc\s*\(|updateDoc\s*\(|deleteDoc\s*\(|deploy\s*\(|sendMessage\s*\()\b/;
function auditSourceBoundaries(){
 const failures=[];
 for(const file of required){
  const absolute=path.join(root,file);
  if(!fs.existsSync(absolute)){failures.push("missing:"+file);continue}
  const source=fs.readFileSync(absolute,"utf8");
  if(forbidden.test(source))failures.push("forbidden_operation:"+file);
 }
 const workflow=path.join(root,".github/workflows/boustio-phase39-5-final-integration-audit.yml");
 if(!fs.existsSync(workflow))failures.push("missing_workflow");
 else {
  const yaml=fs.readFileSync(workflow,"utf8");
  if(/\b(?:firebase deploy|gh release|npm publish)\b/.test(yaml))failures.push("deployment_command");
  if(!yaml.includes("demo-boustio-phase39-5")||!yaml.includes("NO_DEPLOYMENT"))failures.push("missing_isolation_markers");
 }
 return Object.freeze({status:failures.length?"AUDIT_FAILED":"ISOLATED_BOUNDARIES_CHECKED",failures:Object.freeze(failures),productionLaunchApproved:false,migrationApproved:false,liveBookingsEnabled:false,paymentsEnabled:false,messagingEnabled:false,deploymentApproved:false});
}
module.exports=Object.freeze({auditSourceBoundaries});
