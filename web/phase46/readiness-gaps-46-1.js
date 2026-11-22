"use strict";
// Pure assessment of inherited OPEN blockers. No credentials, SDKs, network, or writes.
const {auditPhase45}=require("../phase45/final-audit-45-5");
const evidence=Object.freeze([
 {priority:1,owner:"Backend security",required:"Independent staging-only Firebase Admin verifyIdToken(checkRevoked) evidence, trusted backend identity and credential boundary review",plan:"Design an approval-gated staging-only verification exercise; never use production credentials",gate:"SECURITY_REVIEW"},
 {priority:2,owner:"App integrity",required:"Real App Check attestation, approved app identity and atomic replay prevention test evidence",plan:"Document attestation and replay threat model, then request approval for controlled staging validation",gate:"SECURITY_REVIEW"},
 {priority:3,owner:"Staging integration",required:"Approved browser/Android end-to-end results and cross-device revision/conflict evidence",plan:"Prepare synthetic multi-device staging scenarios and require explicit environment approval",gate:"STAGING_APPROVAL"},
 {priority:4,owner:"Data protection",required:"Verified non-destructive backup, restore drill, owner-approved migration and rollback evidence for the two original Android appointments",plan:"Prepare backup inventory and rollback checklist; do not read, migrate or modify appointments",gate:"OWNER_APPROVAL"},
 {priority:5,owner:"Device acceptance",required:"Samsung accessibility, offline, multi-device and recovery acceptance records",plan:"Prepare Samsung manual test matrix and sign-off criteria without live customer data",gate:"DEVICE_SIGNOFF"},
 {priority:6,owner:"Operations",required:"Privacy, monitoring, incident response, deployment controls and launch approvals",plan:"Draft privacy and incident response checklist; require separate release authorization",gate:"RELEASE_APPROVAL"},
 {priority:7,owner:"Independent validation",required:"Independent real-environment authorization, revocation, App Check and concurrency verification",plan:"Define independent test evidence and threat-model review; emulator results alone cannot close this gap",gate:"INDEPENDENT_REVIEW"}
].map(x=>Object.freeze(x)));
function assessLaunchGaps(){
 const prior=auditPhase45(),failures=[];
 if(prior.status!=="ISOLATED_AUDIT_CHECKS_PASSED")failures.push("phase45_audit_not_passed");
 if(prior.blockers.length!==7||prior.blockers.some(x=>x.status!=="OPEN"))failures.push("unexpected_prior_blocker_state");
 if(evidence.length!==prior.blockers.length||new Set(evidence.map(x=>x.priority)).size!==7)failures.push("incomplete_prioritization");
 const gaps=Object.freeze(prior.blockers.map((b,i)=>Object.freeze({...b,...evidence[i],evidenceStatus:"MISSING",remediationStatus:"NOT_STARTED",approved:false})));
 return Object.freeze({status:failures.length?"ASSESSMENT_FAILED":"ISOLATED_GAP_ASSESSMENT_COMPLETE",failures:Object.freeze(failures),gaps,openCount:gaps.length,productionReady:false,stagingApproved:false,appointmentsMigrationApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({assessLaunchGaps,evidence});
