'use strict';
const REQUIRED=['admin-revocation','session-expiry','owner-isolation','credential-boundaries','staging-isolation','negative-tests','rollback-readiness'];
function validateReview(r,g,m,s){
 const errors=[];
 if(r?.phase!=='49.7'||r?.reviewStatus!=='NOT_STARTED'||r?.securityDecision!=='PENDING')errors.push('review-not-pending');
 if(r?.independentReviewer!=='UNASSIGNED'||r?.ownerAuthorization!=='NOT_GRANTED'||r?.stagingExecution!=='NOT_AUTHORIZED'||r?.blockerClosureAuthorized!==false)errors.push('unauthorized-review');
 if(!Array.isArray(r?.requiredControls)||r.requiredControls.length!==7||REQUIRED.some(x=>!r.requiredControls.includes(x))||new Set(r.requiredControls).size!==7)errors.push('controls');
 if(!Array.isArray(r?.outstandingRisks)||r.outstandingRisks.length<5||r.outstandingRisks.some(x=>x.status!=='OPEN'))errors.push('risks');
 if(r?.launchBlockers!=='ALL_SEVEN_OPEN'||g?.launchBlockers?.length!==7||g.launchBlockers.some(b=>b.status!=='OPEN'||b.evidence!=='PENDING'||b.approval!==null))errors.push('blockers');
 if(m?.independentApproval!==false||m?.records?.length!==7||m.records.some(x=>x.status!=='PENDING'))errors.push('evidence');
 if(s?.status!=='NOT_APPROVED'||s?.authorizedStagingExecution!==false||s?.independentSignoff!==false)errors.push('staging');
 for(const k of ['liveBookings','payments','messaging','deployment'])if(r?.[k]!==false)errors.push('live-'+k);
 if(r?.androidAppointments!=='preserve-existing-two')errors.push('android-data');
 return {preparationSafe:errors.length===0,independentApproval:false,launchAuthorized:false,errors};
}
module.exports={validateReview};
