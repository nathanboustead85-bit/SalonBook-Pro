'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),approval=JSON.parse(fs.readFileSync(path.join(root,'security/phase504-staging-approval.json'),'utf8'));
const {validate}=require('../security/phase504-approval-guard.cjs');
test('pending owner decision is fail closed',()=>assert.deepEqual(validate(),[]));
test('no cloud or live operation can be enabled by changing approval manifest',()=>{
 for(const key of ['creationAuthorized','cloudAccessAuthorized','credentialsAuthorized','stagingTestsAuthorized','projectCreated','iamReviewed','resourceIsolationReviewed','billingBudgetReviewed','rollbackReviewed','liveBookings','payments','messaging','deployment']){const c={...approval,[key]:true};assert.ok(validate(c).includes(key),key);}
});
test('cannot silently select existing Android project or assign reviewer',()=>{
 for(const [key,value] of [['proposedStagingProjectId','salonbook-pro-ad5ff'],['ownerDecision','APPROVED'],['independentReviewer','self'],['syntheticDataOnly',false],['launchBlockers','CLOSED']])assert.ok(validate({...approval,[key]:value}).length>0,key);
});
test('workflow has no identity token, credentials or deployment',()=>{
 const wf=fs.readFileSync(path.join(root,'.github/workflows/boustio-phase-504-staging-approval.yml'),'utf8');
 assert.match(wf,/contents: read/);
 assert.doesNotMatch(wf,/firebase deploy|google-github-actions\/auth|secrets\.|pull_request_target|id-token: write|contents: write/);
});
test('approval requirements cover separate project, budget and independent review',()=>{
 assert.ok(approval.approvalRequirements.length>=6);
 assert.match(approval.approvalRequirements.join(' '),/budget/);
 assert.match(approval.approvalRequirements.join(' '),/independent reviewer/);
});
