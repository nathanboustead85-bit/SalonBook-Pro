'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const approval=read('security/phase504-staging-approval.json');
const android=read('app/google-services.json').project_info.project_id;
const gates=read('security/phase494-gates.json');
const falseKeys=['creationAuthorized','cloudAccessAuthorized','credentialsAuthorized','stagingTestsAuthorized','projectCreated','iamReviewed','resourceIsolationReviewed','billingBudgetReviewed','rollbackReviewed','liveBookings','payments','messaging','deployment'];
function validate(p=approval){
 const errors=[];
 if(p.phase!=='50.4'||p.status!=='AWAITING_EXPLICIT_OWNER_DECISION')errors.push('status');
 if(p.knownAndroidProjectId!==android)errors.push('android-project');
 if(p.proposedStagingProjectId!==null)errors.push('project-not-approved');
 if(p.ownerDecision!=='NOT_REQUESTED_IN_CONSOLE'||p.independentReviewer!=='UNASSIGNED')errors.push('approvals-not-pending');
 for(const key of falseKeys)if(p[key]!==false)errors.push(key);
 if(p.syntheticDataOnly!==true||p.launchBlockers!=='ALL_SEVEN_OPEN'||p.androidAppointments!=='preserve-existing-two')errors.push('safety');
 if(gates.launchBlockers.length!==7||gates.launchBlockers.some(x=>x.status!=='OPEN'||x.approval!==null))errors.push('launch-blockers');
 return errors;
}
if(require.main===module){const errors=validate();if(errors.length){console.error(errors.join(', '));process.exitCode=1;}else console.log('Phase 50.4 approval planning only: no cloud action authorized');}
module.exports={validate};
