"use strict";
// Read-only consolidation of synthetic preparation; never closes launch blockers.
const {assessLaunchGaps}=require("./readiness-gaps-46-1");
const {acceptanceMatrix}=require("./samsung-acceptance-46-6");
const phases=Object.freeze([
 Object.freeze({phase:"46.1",scope:"Seven inherited blockers assessed",evidence:"ISOLATED_GAP_ASSESSMENT_ONLY"}),
 Object.freeze({phase:"46.2",scope:"Injected backend token-verification contract",evidence:"SYNTHETIC_CONTRACT_ONLY"}),
 Object.freeze({phase:"46.3",scope:"Injected App Check and in-memory replay simulation",evidence:"SYNTHETIC_CONTRACT_ONLY"}),
 Object.freeze({phase:"46.4",scope:"Synthetic browser/Android revision consistency",evidence:"ISOLATED_MULTI_DEVICE_ONLY"}),
 Object.freeze({phase:"46.5",scope:"Synthetic inventory, checksum, restore and rollback checklist",evidence:"NO_REAL_DATA_PROTECTION_EVIDENCE"}),
 Object.freeze({phase:"46.6",scope:"Samsung acceptance checklist and synthetic session prechecks",evidence:"MANUAL_DEVICE_SIGNOFF_MISSING"})
]);
function reviewPreStaging(){
 const a=assessLaunchGaps(),m=acceptanceMatrix();
 if(a.status!=="ISOLATED_GAP_ASSESSMENT_COMPLETE"||a.openCount!==7||a.gaps.some(g=>g.status!=="OPEN"||g.approved!==false)||m.deviceSignedOff!==false||m.checks.length!==8)throw Error("fail_closed_review_invariant");
 const risks=Object.freeze(a.gaps.map(g=>Object.freeze({id:g.id,priority:g.priority,owner:g.owner,risk:g.required,approvalGate:g.gate,evidenceStatus:"MISSING",approved:false,status:"OPEN"})));
 const checklist=Object.freeze(risks.map(r=>Object.freeze({blockerId:r.id,requirement:r.risk,approvalGate:r.approvalGate,completed:false,independentEvidenceRequired:true})));
 return Object.freeze({status:"PRE_STAGING_REVIEW_PREPARED_NOT_APPROVED",phases,risks,checklist,openCount:7,manualSamsungChecks:m.checks.length,originalAppointments:"NOT_ACCESSED_OR_VERIFIED",stagingApproved:false,productionReady:false,deviceSignedOff:false,appointmentsMigrationApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({reviewPreStaging,phases});
