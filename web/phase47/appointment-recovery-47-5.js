"use strict";
// Synthetic fixtures only. Pure validation; NEVER reads or writes Android appointments.
const {createRecoveryPlan,verifyRestore,rollbackChecklist}=require("../phase46/recovery-plan-46-5");
const {assessLaunchGaps}=require("../phase46/readiness-gaps-46-1");
const deny=reason=>Object.freeze({status:"BLOCKED",reason,accessGranted:false,restoreExecuted:false,rollbackExecuted:false,migrationApproved:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
const valid=x=>typeof x==="string"&&/^synthetic-[a-z0-9-]{3,60}$/.test(x);
function createAppointmentRecoveryPreparation({ownerId,records,revision=1}={}){
 if(!valid(ownerId))return deny("synthetic_owner_required");
 const plan=createRecoveryPlan({ownerId,records,revision});
 if(plan.status!=="SYNTHETIC_INVENTORY_READY")return deny(plan.reason||"invalid_inventory");
 const checklist=rollbackChecklist(plan);
 let active=true,epoch=0;
 function inspect({requestOwnerId,identity,restored,ownerApproval=false,operation="verify"}={}){
  if(!active)return deny("stopped");
  if(operation!=="verify"||requestOwnerId!==ownerId||!identity||identity.uid!==ownerId||identity.emailVerified!==true||identity.revocationVerified!==true||identity.sessionActive!==true||identity.appCheckVerified!==true)return deny("owner_or_operation_denied");
  if(ownerApproval!==true)return deny("owner_approval_required");
  if(assessLaunchGaps().openCount!==7)return deny("launch_gate_changed");
  const result=verifyRestore({plan,restored,ownerApproval});
  if(result.status!=="SYNTHETIC_RESTORE_VERIFIED")return deny(result.reason||"integrity_mismatch");
  return Object.freeze({status:"SYNTHETIC_RECOVERY_PRECHECK_ONLY",checksum:plan.checksum,recordCount:plan.count,accessGranted:false,restoreExecuted:false,rollbackExecuted:false,migrationApproved:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
 }
 return Object.freeze({inspect,plan,checklist,invalidate(){epoch++;return deny("revalidation_required")},stop(){active=false;epoch++;return deny("stopped")},accessGranted:false,restoreExecuted:false,rollbackExecuted:false,migrationApproved:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({createAppointmentRecoveryPreparation});
