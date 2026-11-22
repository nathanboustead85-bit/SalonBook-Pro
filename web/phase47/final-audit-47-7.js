"use strict";
// Consolidated offline assessment only. NO staging authorization, device sign-off, or data access.
const {assessLaunchGaps}=require("../phase46/readiness-gaps-46-1");
const {reviewPreStaging}=require("../phase46/prestaging-review-46-7");
const {assertNoCredentialEnvironment}=require("./staging-boundary-47-1");
const {manualSamsungChecks}=require("./samsung-acceptance-47-6");
const phases=Object.freeze([
 Object.freeze({phase:"47.1",scope:"Synthetic loopback configuration and credential boundary",evidence:"ISOLATED_ONLY"}),
 Object.freeze({phase:"47.2",scope:"Injected backend revocation and owner authorization",evidence:"SYNTHETIC_ONLY"}),
 Object.freeze({phase:"47.3",scope:"Injected App Check and local in-memory replay simulation",evidence:"NOT_DISTRIBUTED_ATOMIC"}),
 Object.freeze({phase:"47.4",scope:"Injected browser/Android revision and session checks",evidence:"NO_REAL_MULTI_DEVICE_SIGNOFF"}),
 Object.freeze({phase:"47.5",scope:"Synthetic appointment checksum and rollback checklist",evidence:"NO_REAL_APPOINTMENT_BACKUP"}),
 Object.freeze({phase:"47.6",scope:"Synthetic Samsung recovery and manual acceptance checklist",evidence:"MANUAL_SAMSUNG_SIGNOFF_MISSING"})
]);
const disabled=Object.freeze({accessGranted:false,stagingApproved:false,productionReady:false,deviceSignedOff:false,appointmentsMigrationApproved:false,appointmentPreservationVerified:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
function auditPhase47({environment={}}={}){
 const gaps=assessLaunchGaps(),prior=reviewPreStaging(),credential=assertNoCredentialEnvironment(environment);
 if(credential.status!=="NO_EXPLICIT_CREDENTIALS_IN_SUPPLIED_ENVIRONMENT")return Object.freeze({status:"AUDIT_DENIED",reason:"credential_boundary",...disabled});
 if(gaps.status!=="ISOLATED_GAP_ASSESSMENT_COMPLETE"||gaps.openCount!==7||prior.openCount!==7||gaps.gaps.some(x=>x.status!=="OPEN"||x.approved!==false)||prior.risks.some(x=>x.status!=="OPEN"||x.approved!==false)||manualSamsungChecks.length!==6||phases.length!==6)throw Error("fail_closed_phase47_audit_invariant");
 const blockers=Object.freeze(gaps.gaps.map(g=>Object.freeze({id:g.id,priority:g.priority,requirement:g.required,approvalGate:g.gate,status:"OPEN",approved:false,independentEvidenceRequired:true})));
 return Object.freeze({status:"PHASE47_ISOLATED_AUDIT_PREPARED_NOT_APPROVED",phases,blockers,openCount:7,manualSamsungChecks:manualSamsungChecks.length,originalAppointments:"NOT_ACCESSED_OR_VERIFIED",realStagingValidation:"NOT_PERFORMED",realAppCheckValidation:"NOT_PERFORMED",distributedReplayValidation:"NOT_PERFORMED",realSamsungSignoff:"NOT_PERFORMED",rollbackExecuted:false,restoreExecuted:false,...disabled});
}
module.exports=Object.freeze({auditPhase47,phases});
