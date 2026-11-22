"use strict";
// Injected Firebase Admin-compatible verifier only. No Admin initialization or credentials.
const {createBackendVerificationContract}=require("../phase46/backend-contract-46-2");
const {assertNoCredentialEnvironment}=require("./staging-boundary-47-1");
const {assessLaunchGaps}=require("../phase46/readiness-gaps-46-1");
const deny=reason=>Object.freeze({status:"DENIED",reason,accessGranted:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
const valid=x=>typeof x==="string"&&/^synthetic-[a-z0-9-]{3,60}$/.test(x);
function createTrustedBackendPreparation({adminAuth,now=Date.now,environment={}}={}){
 if(!adminAuth||typeof adminAuth.verifyIdToken!=="function"||typeof now!=="function")throw TypeError("injected_verifier_required");
 const verifier=createBackendVerificationContract({adminAuth,now,environment});
 let active=true,epoch=0;
 async function check({uid,resourceOwnerId,token,operation="read"}={}){
  if(!active)return deny("stopped");
  if(assertNoCredentialEnvironment(environment).status!=="NO_EXPLICIT_CREDENTIALS_IN_SUPPLIED_ENVIRONMENT")return deny("credential_boundary");
  if(operation!=="read"||!valid(uid)||!valid(resourceOwnerId)||uid!==resourceOwnerId)return deny("owner_or_operation_denied");
  const seq=epoch;
  const result=await verifier.verify({uid,resourceOwnerId,token,operation});
  if(!active||seq!==epoch)return deny("session_invalidated");
  if(result.status!=="ISOLATED_BACKEND_CONTRACT_CHECK_PASSED")return deny(result.reason||"verification_denied");
  if(assessLaunchGaps().openCount!==7)return deny("launch_gate_changed");
  return Object.freeze({status:"SYNTHETIC_TRUSTED_BACKEND_PRECHECK_ONLY",ownerId:uid,accessGranted:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
 }
 return Object.freeze({check,invalidate(){epoch++;verifier.invalidate();return deny("session_invalidated")},stop(){active=false;epoch++;verifier.stop();return deny("stopped")},accessGranted:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({createTrustedBackendPreparation});
