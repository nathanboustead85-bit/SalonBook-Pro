"use strict";
// Synthetic App Check verification contract; in-memory replay guard is NOT distributed protection.
const {assessLaunchGaps}=require("./readiness-gaps-46-1");
const {validateSafeConfiguration,expected}=require("../phase45/secrets-guard-45-2");
const deny=reason=>Object.freeze({status:"DENIED",reason,accessGranted:false,stagingApproved:false,productionReady:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
const validApp=x=>typeof x==="string"&&/^[-_.:A-Za-z0-9]{3,200}$/.test(x);
function createAppCheckReplayContract({adminAppCheck,approvedAppIds,config=expected,environment={},maxAttempts=1000}={}){
 if(!adminAppCheck||typeof adminAppCheck.verifyToken!=="function"||!Array.isArray(approvedAppIds)||!approvedAppIds.length||approvedAppIds.some(x=>!validApp(x))||new Set(approvedAppIds).size!==approvedAppIds.length||!Number.isSafeInteger(maxAttempts)||maxAttempts<1||maxAttempts>100000)throw TypeError("isolated_appcheck_dependencies_required");
 const approved=new Set(approvedAppIds),seen=new Set();let active=true,epoch=0;
 async function verify({token,appId,operation="read"}={}){
  if(!active)return deny("stopped");
  if(validateSafeConfiguration(config,environment).status!=="ISOLATED_SECRETS_CHECK_PASSED")return deny("credential_boundary");
  if(operation!=="read")return deny("operation_denied");
  if(!validApp(appId)||!approved.has(appId)||typeof token!=="string"||!token.trim()||token.length>4096)return deny("app_identity_or_token_denied");
  if(seen.has(token))return deny("replay_denied");
  if(seen.size>=maxAttempts)return deny("replay_capacity_exhausted");
  // Reserve synchronously before awaiting injected verifier to reject concurrent replay.
  seen.add(token);const seq=epoch;
  try{
   const result=await adminAppCheck.verifyToken(token,{consume:true});
   if(!active||seq!==epoch)return deny("session_invalidated");
   if(!result||result.appId!==appId||result.alreadyConsumed!==false)return deny("appcheck_invalid_or_consumed");
   if(assessLaunchGaps().openCount!==7)return deny("launch_gate_changed");
   return Object.freeze({status:"ISOLATED_APPCHECK_CONTRACT_CHECK_PASSED",appId,accessGranted:false,stagingApproved:false,productionReady:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
  }catch{return deny(!active||seq!==epoch?"session_invalidated":"verification_failed")}
 }
 return Object.freeze({verify,invalidate(){epoch++;return deny("session_invalidated")},stop(){active=false;epoch++;seen.clear();return deny("stopped")},canBook:false,canPay:false,canMessage:false,canDeploy:false,stagingApproved:false});
}
module.exports=Object.freeze({createAppCheckReplayContract});
