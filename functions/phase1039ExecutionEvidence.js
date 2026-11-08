"use strict";
/**
 * Phase 10.39: pure, fail-closed policy evaluation ONLY.
 * This is not an authorization issuer, IAM enforcer, executable entrypoint or deployment.
 * All assertions must be backed by independently verified evidence at future execution.
 */
const ID=/^[A-Za-z0-9_-]{1,100}$/;
const EXPECTED="INITIALISE_LEGACY_BOOKING_MODE_ONLY";
const PATH="businesses/";
function assessExecutionEvidence({businessId,authenticatedUid,approvalEvidence,identityEvidence,
 permissionEvidence,nowMs}={}){
 const deny=reason=>({approved:false,reason,productionWriteAllowed:false});
 if(typeof businessId!=="string"||!ID.test(businessId)||businessId!==authenticatedUid)
  return deny("Owner identity mismatch");
 if(!Number.isSafeInteger(nowMs)||nowMs<=0)return deny("Trusted time required");
 if(!identityEvidence||identityEvidence.verifiedByTrustedOperator!==true||
    identityEvidence.ownerUid!==businessId||
    typeof identityEvidence.operatorId!=="string"||!identityEvidence.operatorId.trim())
  return deny("Independent identity evidence required");
 const a=approvalEvidence;
 if(!a||a.verifiedByTrustedOperator!==true||a.ownerUid!==businessId||
    a.operation!==EXPECTED||typeof a.approvalId!=="string"||!a.approvalId.trim()||
    a.used!==false||!Number.isSafeInteger(a.issuedAtMs)||
    !Number.isSafeInteger(a.expiresAtMs)||a.issuedAtMs>nowMs||
    a.expiresAtMs<=nowMs||a.expiresAtMs-a.issuedAtMs>15*60*1000)
  return deny("Fresh unused owner approval evidence required");
 const p=permissionEvidence;
 if(!p||p.verifiedByTrustedOperator!==true||p.projectId!=="salonbook-pro-ad5ff"||
    p.targetPath!==PATH+businessId+"/settings/bookingMode"||
    p.allowCreateOnly!==true||p.allowDelete!==false||p.allowUpdate!==false||
    p.allowOtherWrites!==false||p.readonlyVerifierUnchanged!==true)
  return deny("Independently verified narrow write permissions required");
 // This assessment is never itself an execution permit; external proof, atomic
 // approval consumption and real IAM enforcement are still mandatory.
 return {approved:true,productionWriteAllowed:false,
  reason:"Evidence shape valid; external verification and atomic approval consumption still required"};
}
module.exports={assessExecutionEvidence};
