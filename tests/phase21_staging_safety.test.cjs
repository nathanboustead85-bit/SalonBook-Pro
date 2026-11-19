"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const manifest=JSON.parse(read("config/phase21-staging-release-gates.json"));
const workflow=read(".github/workflows/boustio-phase21-staging-safety.yml");
const plan=read("docs/PHASE21_5_STAGING_SAFETY.md");
test("Staging deployment defaults to NO-GO and disabled features",()=>{
 assert.equal(manifest.releaseDecision,"NO-GO");
 for(const key of ["deploymentEnabled","publicRegistrationEnabled","customerBookingsEnabled","liveDashboardEnabled"])
  assert.equal(manifest[key],false,key);
});
test("Human approval is required and explicitly not granted",()=>{
 assert.equal(manifest.approval.required,true);
 assert.equal(manifest.approval.granted,false);
 assert.equal(manifest.approval.separateHumanApprovalRequired,true);
 assert.equal(manifest.target.projectId,null);
 assert.equal(manifest.target.hostname,null);
 assert.equal(manifest.target.requiresDistinctFirebaseProject,true);
});
test("Rollback and operational acceptance gates remain unapproved",()=>{
 assert.equal(manifest.rollback.required,true);
 for(const key of ["validated","backupVerified","restoreDrillCompleted"])assert.equal(manifest.rollback[key],false);
 for(const value of Object.values(manifest.checks))assert.equal(value,false);
});
test("Workflow is read-only and cannot deploy or obtain credentials",()=>{
 assert.match(workflow,/permissions:\s*\n\s*contents: read/);
 assert.match(workflow,/persist-credentials: false/);
 assert.match(workflow,/node --test tests\/phase21_staging_safety.test.cjs/);
 assert.doesNotMatch(workflow,/firebase deploy|wrangler deploy|deploy-pages|id-token: write|secrets\.|environment:\s*boustio-staging/);
});
test("Existing production website and appointment records remain untouched",()=>{
 assert.equal(manifest.dataPolicy.syntheticOnly,true);
 assert.equal(manifest.dataPolicy.existingAndroidAppointmentsUntouched,true);
 for(const file of ["website/business/dashboard/firebase-browser-sdk-adapter.mjs","website/business/dashboard/session-integration-foundation.mjs"]){
  const source=read(file);
  assert.match(source,/export const PUBLIC_REGISTRATION_ENABLED=false;/);
  assert.match(source,/export const CUSTOMER_BOOKINGS_ENABLED=false;/);
 }
});
test("Plan explicitly requires independent approval and rollback drill",()=>{
 for(const word of ["NO-GO","manual approval","rollback","separate Firebase project","no deployment","budget alerts","two original Samsung appointments"])
 assert.ok(plan.toLowerCase().includes(word.toLowerCase()),word);
});
