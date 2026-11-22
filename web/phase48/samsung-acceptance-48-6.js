"use strict";
// Synthetic-only Samsung acceptance prechecks. No physical device access, no real appointment access.
const {createSamsungReadinessPreparation}=require("../phase47/samsung-acceptance-47-6");
const {prepareStagingReadiness}=require("./staging-readiness-48-1");
const {assertNoCredentialEnvironment}=require("../phase47/staging-boundary-47-1");
const denied=reason=>Object.freeze({status:"PENDING",reason,deviceSignedOff:false,appointmentPreservationVerified:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
function createSamsungStagingAcceptance({read,now=Date.now,ownerId,records,environment={}}={}){
 if(assertNoCredentialEnvironment(environment).status!=="NO_EXPLICIT_CREDENTIALS_IN_SUPPLIED_ENVIRONMENT")throw TypeError("credential_environment_denied");
 const samsung=createSamsungReadinessPreparation({read,now,ownerId,records});
 let active=true,epoch=0;
 async function verify({uid,identity,restored,ownerApproval=false,approvalEvidence={}}={}){
  if(!active)return denied("stopped");
  if(!approvalEvidence||typeof approvalEvidence!=="object"||Array.isArray(approvalEvidence))return denied("approval_evidence_invalid");
  const seq=epoch;
  const result=await samsung.verify({uid,identity,restored,ownerApproval});
  if(!active||seq!==epoch)return denied("session_invalidated");
  if(result.status!=="SYNTHETIC_SAMSUNG_READINESS_PRECHECK_ONLY")return denied(result.reason||"precheck_denied");
  const readiness=prepareStagingReadiness({environment,approvalEvidence});
  if(readiness.status!=="STAGING_READINESS_INVENTORY_ONLY_NOT_APPROVED"||readiness.openCount!==7)return denied("launch_gate_changed");
  return Object.freeze({status:"SYNTHETIC_SAMSUNG_STAGING_PRECHECK_ONLY",revision:result.revision,checksum:result.checksum,openBlockers:7,physicalSamsungEvidence:"NOT_VERIFIED",deviceSignedOff:false,appointmentPreservationVerified:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
 }
 const clear=(reason,action)=>{epoch++;action();return denied(reason)};
 return Object.freeze({verify,matrix:samsung.matrix,manualChecks:samsung.manualChecks,offline:()=>clear("offline",()=>samsung.offline()),reconnect:()=>clear("revalidation_required",()=>samsung.reconnect()),restart:()=>clear("restart_revalidation_required",()=>samsung.restart()),switchAccount:()=>clear("account_switch_revalidation_required",()=>samsung.switchAccount()),stop:()=>{active=false;return clear("stopped",()=>samsung.stop())},deviceSignedOff:false,appointmentPreservationVerified:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({createSamsungStagingAcceptance});
