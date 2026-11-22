"use strict";
// Synthetic appointment fixtures only. No Android, production Firestore, storage, or mutation.
const {createAppointmentRecoveryPreparation}=require("../phase47/appointment-recovery-47-5");
const {prepareStagingReadiness}=require("./staging-readiness-48-1");
const {assertNoCredentialEnvironment}=require("../phase47/staging-boundary-47-1");
const denied=reason=>Object.freeze({status:"BLOCKED",reason,restoreExecuted:false,rollbackExecuted:false,migrationApproved:false,stagingApproved:false,ownerApprovedForRealData:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
function createStagingAppointmentRecovery({ownerId,records,revision=1,environment={}}={}){
 if(assertNoCredentialEnvironment(environment).status!=="NO_EXPLICIT_CREDENTIALS_IN_SUPPLIED_ENVIRONMENT")return denied("credential_boundary");
 const recovery=createAppointmentRecoveryPreparation({ownerId,records,revision});
 if(typeof recovery.inspect!=="function")return denied(recovery.reason||"invalid_synthetic_inventory");
 let active=true,epoch=0;
 function inspect({requestOwnerId,identity,restored,ownerApproval=false,operation="verify",approvalEvidence={}}={}){
  if(!active)return denied("stopped");
  if(!approvalEvidence||typeof approvalEvidence!=="object"||Array.isArray(approvalEvidence))return denied("approval_evidence_invalid");
  if(operation!=="verify"||ownerApproval!==true)return denied("explicit_synthetic_owner_approval_required");
  const result=recovery.inspect({requestOwnerId,identity,restored,ownerApproval,operation});
  if(result.status!=="SYNTHETIC_RECOVERY_PRECHECK_ONLY")return denied(result.reason||"integrity_denied");
  const readiness=prepareStagingReadiness({environment,approvalEvidence});
  if(readiness.status!=="STAGING_READINESS_INVENTORY_ONLY_NOT_APPROVED"||readiness.openCount!==7)return denied("launch_gate_changed");
  return Object.freeze({status:"SYNTHETIC_APPOINTMENT_RECOVERY_PRECHECK_ONLY",checksum:result.checksum,recordCount:result.recordCount,rollbackChecklist:recovery.checklist.steps,originalAndroidAppointments:"NOT_ACCESSED_OR_VERIFIED",ownerApprovedForRealData:false,restoreExecuted:false,rollbackExecuted:false,migrationApproved:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
 }
 return Object.freeze({inspect,plan:recovery.plan,checklist:recovery.checklist,invalidate(){epoch++;recovery.invalidate();return denied("revalidation_required")},stop(){active=false;epoch++;recovery.stop();return denied("stopped")},restoreExecuted:false,rollbackExecuted:false,migrationApproved:false,stagingApproved:false,ownerApprovedForRealData:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({createStagingAppointmentRecovery});
