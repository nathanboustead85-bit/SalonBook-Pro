"use strict";
// Synthetic verifier and process-local replay ledger only. NOT distributed atomic consumption.
const {createAppCheckReplayContract}=require("../phase46/appcheck-replay-46-3");
const {prepareStagingReadiness}=require("./staging-readiness-48-1");
const {assertNoCredentialEnvironment}=require("../phase47/staging-boundary-47-1");
const denied=reason=>Object.freeze({status:"DENIED",reason,accessGranted:false,stagingApproved:false,securityApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
function createStagingAttestationPreparation({adminAppCheck,approvedAppIds=["synthetic-boustio-app"],environment={},maxAttempts=1000,now=Date.now}={}){
 if(typeof now!=="function")throw TypeError("clock_required");
 if(assertNoCredentialEnvironment(environment).status!=="NO_EXPLICIT_CREDENTIALS_IN_SUPPLIED_ENVIRONMENT")throw TypeError("credential_environment_denied");
 const app=createAppCheckReplayContract({adminAppCheck,approvedAppIds,environment,maxAttempts});
 let epoch=0,active=true;
 async function verify({token,appId,operation="read",expiresAt,approvalEvidence={}}={}){
  if(!active)return denied("stopped");
  if(operation!=="read")return denied("operation_denied");
  if(!Number.isSafeInteger(expiresAt)||expiresAt<=now()||expiresAt>now()+3600000)return denied("expired_or_invalid_expiry");
  if(!approvalEvidence||typeof approvalEvidence!=="object"||Array.isArray(approvalEvidence))return denied("approval_evidence_invalid");
  const seq=epoch;
  const result=await app.verify({token,appId,operation});
  if(!active||seq!==epoch)return denied("session_invalidated");
  if(result.status!=="ISOLATED_APPCHECK_CONTRACT_CHECK_PASSED")return denied(result.reason||"attestation_denied");
  if(now()>=expiresAt)return denied("expired_during_verification");
  const readiness=prepareStagingReadiness({environment,approvalEvidence});
  if(readiness.status!=="STAGING_READINESS_INVENTORY_ONLY_NOT_APPROVED"||readiness.openCount!==7)return denied("launch_gate_changed");
  return Object.freeze({status:"SYNTHETIC_APPCHECK_PRECHECK_ONLY",openBlockers:7,attestationEvidence:"INJECTED_ONLY",replayEvidence:"PROCESS_LOCAL_ONLY",independentSecurityEvidence:"NOT_VERIFIED",accessGranted:false,stagingApproved:false,securityApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
 }
 return Object.freeze({verify,invalidate(){epoch++;app.invalidate();return denied("session_invalidated")},stop(){active=false;epoch++;app.stop();return denied("stopped")},accessGranted:false,stagingApproved:false,securityApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({createStagingAttestationPreparation});
