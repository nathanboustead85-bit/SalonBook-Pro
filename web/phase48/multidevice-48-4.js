"use strict";
// Injected read-only cross-device checks; no live SDK, credentials, writes or staging approval.
const {createStagingConsistencyPreparation}=require("../phase47/multidevice-47-4");
const {prepareStagingReadiness}=require("./staging-readiness-48-1");
const {assertNoCredentialEnvironment}=require("../phase47/staging-boundary-47-1");
const deny=reason=>Object.freeze({status:"UNAVAILABLE",reason,accessGranted:false,stagingApproved:false,deviceSignedOff:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
function createMultiDeviceStagingSecurity({read,now=Date.now,maxAgeMs=300000,environment={}}={}){
 if(assertNoCredentialEnvironment(environment).status!=="NO_EXPLICIT_CREDENTIALS_IN_SUPPLIED_ENVIRONMENT")throw TypeError("credential_environment_denied");
 const gate=createStagingConsistencyPreparation({read,now,maxAgeMs});
 let active=true,epoch=0;
 async function refresh({device,uid,identity,approvalEvidence={}}={}){
  if(!active)return deny("stopped");
  if(!approvalEvidence||typeof approvalEvidence!=="object"||Array.isArray(approvalEvidence))return deny("approval_evidence_invalid");
  const seq=epoch;
  const result=await gate.refresh({device,uid,identity});
  if(!active||seq!==epoch)return deny("session_invalidated");
  if(result.status!=="SYNTHETIC_DEVICE_CONSISTENCY_ONLY")return deny(result.reason||"consistency_denied");
  const readiness=prepareStagingReadiness({environment,approvalEvidence});
  if(readiness.status!=="STAGING_READINESS_INVENTORY_ONLY_NOT_APPROVED"||readiness.openCount!==7)return deny("launch_gate_changed");
  return Object.freeze({status:"SYNTHETIC_MULTIDEVICE_PRECHECK_ONLY",device,revision:result.revision,openBlockers:7,independentEvidence:"NOT_VERIFIED",accessGranted:false,stagingApproved:false,deviceSignedOff:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
 }
 function clear(reason,action){epoch++;action();return deny(reason)}
 return Object.freeze({refresh,snapshot:device=>gate.snapshot(device),offline:()=>clear("offline",()=>gate.offline()),reconnect:()=>clear("revalidation_required",()=>gate.reconnect()),switchAccount:uid=>clear("account_switch_revalidation_required",()=>gate.switchAccount(uid)),invalidate:()=>clear("session_invalidated",()=>gate.invalidate()),stop:()=>{active=false;return clear("stopped",()=>gate.stop())},accessGranted:false,stagingApproved:false,deviceSignedOff:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({createMultiDeviceStagingSecurity});
