'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),{validateDesign,validateProposedStaging}=require('../security/phase503-staging-guard.cjs');
const policy=JSON.parse(fs.readFileSync(path.join(root,'security/phase503-staging-policy.json'),'utf8'));
test('design policy passes with all live and staging actions disabled',()=>assert.deepEqual(validateDesign(),[]));
test('all unauthorized changes fail closed',()=>{
 for(const key of ['stagingProjectCreated','ownerApproval','independentReviewerApproval','iamReviewed','authIsolationVerified','firestoreIsolationVerified','storageIsolationVerified','functionsIsolationVerified','secretIsolationVerified','billingAlertsVerified','rollbackReviewed','credentialProvisioningAuthorized','realTestsAuthorized','liveBookings','payments','messaging','deployment']){const c={...policy,[key]:true};assert.ok(validateDesign(c).includes(key+'-not-disabled'),key);}
 for(const [key,value] of [['stagingProjectId','example-staging-123'],['existingAndroidProjectId','wrong'],['allowedData','REAL_CUSTOMERS'],['launchBlockers','CLOSED']])assert.ok(validateDesign({...policy,[key]:value}).length>0,key);
});
test('existing Android Firebase project is rejected as staging target',()=>{
 const c={projectId:policy.existingAndroidProjectId,dataClass:'SYNTHETIC_ONLY',accessMode:'NO_CREDENTIALS',executionAuthorized:false};
 assert.ok(validateProposedStaging(c).includes('existing-android-project-prohibited'));
});
test('candidate must use valid distinct project and synthetic-only design',()=>{
 const valid={projectId:'boustio-staging-proposal-01',dataClass:'SYNTHETIC_ONLY',accessMode:'NO_CREDENTIALS',executionAuthorized:false};
 assert.deepEqual(validateProposedStaging(valid),[]);
 assert.ok(validateProposedStaging({...valid,dataClass:'CUSTOMER_DATA'}).length>0);
 assert.ok(validateProposedStaging({...valid,accessMode:'ADMIN_SDK'}).length>0);
 assert.ok(validateProposedStaging({...valid,executionAuthorized:true}).length>0);
 assert.ok(validateProposedStaging({...valid,projectId:'invalid!'}).length>0);
});
test('workflow has read-only permissions and no cloud authentication',()=>{
 const wf=fs.readFileSync(path.join(root,'.github/workflows/boustio-phase-503-staging-policy.yml'),'utf8');
 assert.match(wf,/contents: read/);
 assert.doesNotMatch(wf,/firebase deploy|google-github-actions\/auth|secrets\.|pull_request_target|id-token: write|contents: write/);
});
