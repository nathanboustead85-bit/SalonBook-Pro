"use strict";
// Injected verifier, synthetic identities only. No Firebase Admin initialization or real credentials.
const {createTrustedBackendPreparation}=require("../phase47/trusted-backend-47-2");
const {prepareStagingReadiness}=require("./staging-readiness-48-1");
const {assertNoCredentialEnvironment}=require("../phase47/staging-boundary-47-1");
const denied=reason=>Object.freeze({status:"DENIED",reason,accessGranted:false,credentialsApproved:false,securityApproved:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
const valid=x=>typeof x==="string"&&/^synthetic-[a-z0-9-]{3,60}$/.test(x);
function createStagingBackendSecurity({adminAuth,environment={},now=Date.now}={}){
 if(!adminAuth||typeof adminAuth.verifyIdToken!=="function")throw TypeError("injected_verifier_required");
 const backend=createTrustedBackendPreparation({adminAuth,environment,now});
 let active=true,epoch=0;
 async function verify({uid,resourceOwnerId,token,operation="read",approvalEvidence={}}={}){
  if(!active)return denied("stopped");
  if(assertNoCredentialEnvironment(environment).status!=="NO_EXPLICIT_CREDENTIALS_IN_SUPPLIED_ENVIRONMENT")return denied("credential_boundary");
  if(!valid(uid)||!valid(resourceOwnerId)||uid!==resourceOwnerId||operation!=="read")return denied("owner_or_operation_denied");
  if(!approvalEvidence||typeof approvalEvidence!=="object"||Array.isArray(approvalEvidence))return denied("approval_evidence_invalid");
  const seq=epoch;
  const r=await backend.check({uid,resourceOwnerId,token,operation});
  if(!active||seq!==epoch)return denied("session_invalidated");
  if(r.status!=="SYNTHETIC_TRUSTED_BACKEND_PRECHECK_ONLY")return denied(r.reason||"verification_denied");
  const readiness=prepareStagingReadiness({environment,approvalEvidence});
  if(readiness.status!=="STAGING_READINESS_INVENTORY_ONLY_NOT_APPROVED"||readiness.openCount!==7)return denied("launch_gate_changed");
  return Object.freeze({status:"SYNTHETIC_BACKEND_SECURITY_PRECHECK_ONLY",ownerId:uid,independentSecurityEvidence:"NOT_VERIFIED",revocationEvidence:"INJECTED_VERIFIER_ONLY",accessGranted:false,credentialsApproved:false,securityApproved:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
 }
 return Object.freeze({verify,invalidate(){epoch++;backend.invalidate();return denied("session_invalidated")},stop(){active=false;epoch++;backend.stop();return denied("stopped")},accessGranted:false,credentialsApproved:false,securityApproved:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({createStagingBackendSecurity});
