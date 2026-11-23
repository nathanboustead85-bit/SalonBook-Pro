'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const policy=JSON.parse(fs.readFileSync(path.join(root,'security/phase503-staging-policy.json'),'utf8'));
const observed=JSON.parse(fs.readFileSync(path.join(root,'app/google-services.json'),'utf8')).project_info.project_id;
const gates=JSON.parse(fs.readFileSync(path.join(root,'security/phase494-gates.json'),'utf8'));
const booleans=['stagingProjectCreated','ownerApproval','independentReviewerApproval','iamReviewed','authIsolationVerified','firestoreIsolationVerified','storageIsolationVerified','functionsIsolationVerified','secretIsolationVerified','billingAlertsVerified','rollbackReviewed','credentialProvisioningAuthorized','realTestsAuthorized','liveBookings','payments','messaging','deployment'];
function validateDesign(p=policy){
 const errors=[];
 if(p.phase!=='50.3'||p.mode!=='DESIGN_ONLY')errors.push('design-only');
 if(p.existingAndroidProjectId!==observed)errors.push('existing-project-mismatch');
 if(p.stagingProjectId!==null)errors.push('staging-project-must-be-unassigned');
 for(const key of booleans)if(p[key]!==false)errors.push(key+'-not-disabled');
 if(p.allowedData!=='SYNTHETIC_ONLY'||p.launchBlockers!=='ALL_SEVEN_OPEN'||p.androidAppointments!=='preserve-existing-two')errors.push('data-or-launch-safety');
 if(gates.launchBlockers.length!==7||gates.launchBlockers.some(b=>b.status!=='OPEN'||b.approval!==null))errors.push('launch-blockers');
 return errors;
}
function validateProposedStaging(candidate){
 const errors=[];
 if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))return ['missing-candidate'];
 const id=candidate.projectId;
 if(typeof id!=='string'||!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(id))errors.push('invalid-project-id');
 if(id===observed||id===policy.existingAndroidProjectId)errors.push('existing-android-project-prohibited');
 if(candidate.dataClass!=='SYNTHETIC_ONLY')errors.push('synthetic-data-required');
 if(candidate.accessMode!=='NO_CREDENTIALS')errors.push('no-credentials-during-design');
 if(candidate.executionAuthorized!==false)errors.push('execution-not-authorized');
 return errors;
}
function assertDesignSafe(){const errors=validateDesign();if(errors.length)throw Error('Phase 50.3 blocked: '+errors.join(', '));return true;}
if(require.main===module){assertDesignSafe();console.log('Phase 50.3 design-only guard passed; staging not authorized');}
module.exports={validateDesign,validateProposedStaging,assertDesignSafe};
