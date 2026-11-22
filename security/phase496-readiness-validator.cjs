'use strict';
const REQUIRED=['stagingIsolationVerified','independentReviewerAssigned','leastPrivilegeReviewed','credentialsApproved','adminRevocationVerified','ownerIsolationVerified','sessionExpiryVerified','negativeTestsVerified','rollbackVerified','evidenceReviewed','authorizedStagingExecution','independentSignoff'];
function assessReadiness(x){
 const reasons=[];
 if(!x||x.phase!=='49.6')reasons.push('invalid-phase');
 if(x?.status!=='NOT_APPROVED')reasons.push('approval-state-must-remain-pending');
 if(x?.executionMode!=='documentation-and-synthetic-tests-only')reasons.push('execution-mode');
 if(x?.stagingProjectId!==null||x?.productionProjectId!==null)reasons.push('project-identifiers-not-allowed-in-preparation');
 for(const field of REQUIRED)if(x?.[field]!==false)reasons.push('not-yet-verified:'+field);
 if(x?.launchBlockers!=='ALL_SEVEN_OPEN')reasons.push('launch-blockers');
 for(const field of ['liveBookings','payments','messaging','deployment'])if(x?.[field]!==false)reasons.push('live-feature:'+field);
 if(x?.androidAppointments!=='preserve-existing-two')reasons.push('android-data');
 return {safePreparation:reasons.length===0,stagingExecutionAuthorized:false,launchAuthorized:false,reasons};
}
module.exports={assessReadiness,REQUIRED};
