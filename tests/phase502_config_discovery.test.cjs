'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const state=JSON.parse(read('security/phase502-discovered-config.json'));
const android=JSON.parse(read('app/google-services.json'));
const gradle=read('app/build.gradle.kts');
const wif=read('.github/workflows/boustio-phase-176-wif-stages.yml');
const gates=JSON.parse(read('security/phase494-gates.json'));
function validate(s){
 const errors=[];
 if(s.phase!=='50.2'||s.status!=='READ_ONLY_CONFIGURATION_DISCOVERY')errors.push('phase');
 if(s.androidFirebaseProjectId!==android.project_info.project_id)errors.push('observed-project');
 if(s.androidFirebaseConfigClassification!=='EXISTING_ANDROID_PROJECT_DO_NOT_USE_AS_STAGING')errors.push('classification');
 if(s.stagingProjectId!==null||s.stagingProjectVerified!==false)errors.push('staging');
 for(const key of ['ownerApproval','realStagingTestsAuthorized','credentialsUsed','liveBookings','payments','messaging','deployment'])if(s[key]!==false)errors.push(key);
 if(s.launchBlockers!=='ALL_SEVEN_OPEN'||s.androidAppointments!=='preserve-existing-two')errors.push('safety');
 return errors;
}
test('actual Android Firebase project is discovered from repository config',()=>{
 assert.deepEqual(validate(state),[]);
 assert.ok(state.observedPaths.includes('app/google-services.json'));
 assert.match(gradle,/com\.google\.gms\.google-services/);
 assert.match(gradle,/firebase-auth/);
 assert.match(gradle,/firebase-firestore/);
});
test('WIF workflow is separately gated and does not prove staging isolation',()=>{
 assert.match(wif,/VERIFY_AUTH_STAGES/);
 assert.match(wif,/id-token: write/);
 assert.equal(state.stagingProjectVerified,false);
});
test('project substitution or unauthorized execution fails closed',()=>{
 const changed=structuredClone(state);changed.androidFirebaseProjectId='demo-unrelated';assert.ok(validate(changed).includes('observed-project'));
 for(const key of ['ownerApproval','realStagingTestsAuthorized','credentialsUsed','liveBookings','payments','messaging','deployment']){const c=structuredClone(state);c[key]=true;assert.ok(validate(c).includes(key));}
 const staging=structuredClone(state);staging.stagingProjectId=android.project_info.project_id;assert.ok(validate(staging).includes('staging'));
});
test('seven blockers open and original Android data not touched',()=>{
 assert.equal(gates.launchBlockers.length,7);
 assert.ok(gates.launchBlockers.every(x=>x.status==='OPEN'&&x.approval===null));
 assert.equal(state.androidAppointments,'preserve-existing-two');
});
test('phase 50.2 workflow has no privileged credentials or deploy',()=>{
 const wf=read('.github/workflows/boustio-phase-502-config-discovery.yml');
 assert.match(wf,/contents: read/);
 assert.doesNotMatch(wf,/firebase deploy|google-github-actions\/auth|secrets\.|pull_request_target|id-token: write|contents: write/);
});
