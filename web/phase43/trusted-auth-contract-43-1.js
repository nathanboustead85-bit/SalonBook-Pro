"use strict";
// Emulator-only, injected trusted-auth contract. No Firebase initialization or remote calls.
const {validateStagingEnvironment}=require("../phase41/staging-contract-41-1");
const {auditPhase42}=require("../phase42/final-audit-42-5");
const deny=reason=>Object.freeze({status:"DENIED",reason,stagingApproved:false,productionReady:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
function validateConfig(config){
 const result=validateStagingEnvironment(config);
 return result.status==="EMULATOR_CONTRACT_VALID"?Object.freeze({status:"ISOLATED_CONFIG_VALID",stagingApproved:false,canDeploy:false}):deny(result.reason||"invalid_environment");
}
function createTrustedAuthBoundary({config,verifyTokenRevocation,verifyAppCheck,now=Date.now}){
 if(validateConfig(config).status!=="ISOLATED_CONFIG_VALID"||typeof verifyTokenRevocation!=="function"||typeof verifyAppCheck!=="function"||typeof now!=="function")throw TypeError("isolated_trusted_auth_contract_required");
 async function verify({uid,token,appCheckToken}={}){
  if(typeof uid!=="string"||!/^[A-Za-z0-9_-]{1,80}$/.test(uid)||!token||typeof token!=="object"||typeof appCheckToken!=="string"||!appCheckToken.trim())return deny("missing_credentials");
  const expiry=Date.parse(token.expirationTime);
  if(token.claims?.user_id!==uid||token.claims?.email_verified!==true||!Number.isFinite(expiry)||expiry<=now())return deny("invalid_or_expired_identity");
  let revoked,app;
  try{revoked=await verifyTokenRevocation({uid,token});if(revoked!==true)return deny("revocation_unverified");app=await verifyAppCheck({uid,appCheckToken});if(app!==true)return deny("app_check_unverified")}catch{return deny("verification_failed")}
  // A synthetic verifier returning true is NOT a real backend attestation.
  return Object.freeze({status:"ISOLATED_AUTH_CONTRACT_VALID",uid,stagingApproved:false,productionReady:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
 }
 return Object.freeze({verify,stagingConnected:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
function assessPhase43Readiness(config){
 const prior=auditPhase42(),environment=validateConfig(config);
 return Object.freeze({status:prior.status==="ISOLATED_AUDIT_CHECKS_PASSED"&&environment.status==="ISOLATED_CONFIG_VALID"?"ISOLATED_FOUNDATIONS_VALID":"NOT_APPROVED",priorAudit:prior.status,environment:environment.status,blockers:prior.blockers,stagingConnected:false,stagingApproved:false,productionReady:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({validateConfig,createTrustedAuthBoundary,assessPhase43Readiness});
