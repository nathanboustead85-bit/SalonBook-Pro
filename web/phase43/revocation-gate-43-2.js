"use strict";
// Isolated adapter for a future trusted backend; injected verifiers are synthetic.
const {validateConfig}=require("./trusted-auth-contract-43-1");
const denied=reason=>Object.freeze({status:"DENIED",reason,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
function createRevocationGate({config,verifyIdToken,verifyAppCheckToken,now=Date.now}){
 if(validateConfig(config).status!=="ISOLATED_CONFIG_VALID"||typeof verifyIdToken!=="function"||typeof verifyAppCheckToken!=="function"||typeof now!=="function")throw TypeError("isolated_verifier_dependencies_required");
 let active=true,epoch=0;
 const invalidate=()=>{epoch++;return denied("session_invalidated")};
 async function verify({uid,idToken,appCheckToken}={}){
  const seq=epoch;
  if(!active||typeof uid!=="string"||!/^[A-Za-z0-9_-]{1,80}$/.test(uid)||typeof idToken!=="string"||!idToken.trim()||typeof appCheckToken!=="string"||!appCheckToken.trim())return denied("missing_credentials");
  try{
   // The checkRevoked=true argument is mandatory for a real Admin SDK adapter.
   const identity=await verifyIdToken(idToken,true);
   if(!active||seq!==epoch)return denied("session_invalidated");
   if(!identity||identity.uid!==uid||identity.email_verified!==true||identity.firebase?.sign_in_provider==="anonymous"||!Number.isSafeInteger(identity.exp)||identity.exp*1000<=now()||!Number.isSafeInteger(identity.auth_time)||identity.auth_time>identity.exp)return denied("identity_invalid_or_revoked");
   const attestation=await verifyAppCheckToken(appCheckToken);
   if(!active||seq!==epoch)return denied("session_invalidated");
   if(!attestation||typeof attestation.appId!=="string"||!attestation.appId.trim()||attestation.alreadyConsumed===true)return denied("app_check_unverified");
   // Neither the App Check appId nor a synthetic verifier constitutes staging approval.
   return Object.freeze({status:"ISOLATED_VERIFIER_CONTRACT_VALID",uid,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
  }catch{return denied(!active||seq!==epoch?"session_invalidated":"verification_failed")}
 }
 return Object.freeze({verify,invalidate,stop(){active=false;epoch++;return denied("stopped")},stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({createRevocationGate});
