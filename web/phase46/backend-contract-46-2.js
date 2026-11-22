"use strict";
// Isolated, injected backend contract: no Firebase Admin initialization, credentials or network.
const {assessLaunchGaps}=require("./readiness-gaps-46-1");
const {validateSafeConfiguration,expected}=require("../phase45/secrets-guard-45-2");
const deny=reason=>Object.freeze({status:"DENIED",reason,stagingApproved:false,productionReady:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
const validUid=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
function createBackendVerificationContract({adminAuth,config=expected,environment={},now=Date.now}={}){
 if(!adminAuth||typeof adminAuth.verifyIdToken!=="function"||typeof now!=="function")throw TypeError("injected_isolated_verifier_required");
 let epoch=0,active=true;
 async function verify({uid,token,resourceOwnerId,operation="read"}={}){
  const seq=epoch;
  if(!active)return deny("stopped");
  if(validateSafeConfiguration(config,environment).status!=="ISOLATED_SECRETS_CHECK_PASSED")return deny("credential_boundary");
  if(operation!=="read")return deny("operation_denied");
  if(!validUid(uid)||!validUid(resourceOwnerId)||uid!==resourceOwnerId||typeof token!=="string"||!token.trim()||token.length>4096)return deny("identity_or_owner_denied");
  try{
   const claims=await adminAuth.verifyIdToken(token,true);
   if(!active||seq!==epoch)return deny("session_invalidated");
   const t=now();
   if(!claims||claims.uid!==uid||claims.email_verified!==true||claims.firebase?.sign_in_provider==="anonymous"||!Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.auth_time)||!Number.isSafeInteger(claims.exp)||claims.iat>claims.exp||claims.auth_time>claims.iat||claims.exp*1000<=t||claims.iat*1000>t+30000||t-claims.auth_time*1000>900000)return deny("invalid_revoked_or_stale_identity");
   if(assessLaunchGaps().openCount!==7)return deny("launch_gate_changed");
   // Contract pass only; no real backend or App Check verification and no access grant.
   return Object.freeze({status:"ISOLATED_BACKEND_CONTRACT_CHECK_PASSED",uid,accessGranted:false,stagingApproved:false,productionReady:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
  }catch{return deny(!active||seq!==epoch?"session_invalidated":"token_verification_failed")}
 }
 return Object.freeze({verify,invalidate(){epoch++;return deny("session_invalidated")},stop(){active=false;epoch++;return deny("stopped")},canBook:false,canPay:false,canMessage:false,canDeploy:false,stagingApproved:false});
}
module.exports=Object.freeze({createBackendVerificationContract});
