"use strict";
// Synthetic injected App Check only; local replay reservations are NOT distributed atomic protection.
const {createAppCheckReplayContract}=require("../phase46/appcheck-replay-46-3");
const {createTrustedBackendPreparation}=require("./trusted-backend-47-2");
const {assertNoCredentialEnvironment}=require("./staging-boundary-47-1");
const {assessLaunchGaps}=require("../phase46/readiness-gaps-46-1");
const deny=reason=>Object.freeze({status:"DENIED",reason,accessGranted:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
function createIsolatedAttestationGate({adminAppCheck,adminAuth,approvedAppIds=["synthetic-boustio-app"],environment={},now=Date.now,maxAttempts=1000}={}){
 if(assertNoCredentialEnvironment(environment).status!=="NO_EXPLICIT_CREDENTIALS_IN_SUPPLIED_ENVIRONMENT")throw TypeError("credential_environment_denied");
 const app=createAppCheckReplayContract({adminAppCheck,approvedAppIds,environment,maxAttempts});
 const auth=createTrustedBackendPreparation({adminAuth,environment,now});
 let active=true,epoch=0;
 async function check({uid,resourceOwnerId,idToken,appCheckToken,appId,operation="read"}={}){
  if(!active)return deny("stopped");
  if(operation!=="read"||typeof uid!=="string"||uid!==resourceOwnerId)return deny("owner_or_operation_denied");
  const seq=epoch;
  const identity=await auth.check({uid,resourceOwnerId,token:idToken,operation});
  if(!active||seq!==epoch)return deny("session_invalidated");
  if(identity.status!=="SYNTHETIC_TRUSTED_BACKEND_PRECHECK_ONLY")return deny(identity.reason||"identity_denied");
  const attestation=await app.verify({token:appCheckToken,appId,operation});
  if(!active||seq!==epoch)return deny("session_invalidated");
  if(attestation.status!=="ISOLATED_APPCHECK_CONTRACT_CHECK_PASSED")return deny(attestation.reason||"attestation_denied");
  const gaps=assessLaunchGaps();
  if(gaps.openCount!==7||gaps.gaps.some(g=>g.status!=="OPEN"))return deny("launch_gate_changed");
  return Object.freeze({status:"SYNTHETIC_ATTESTATION_PRECHECK_ONLY",openBlockers:7,accessGranted:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
 }
 return Object.freeze({check,invalidate(){epoch++;auth.invalidate();app.invalidate();return deny("session_invalidated")},stop(){active=false;epoch++;auth.stop();app.stop();return deny("stopped")},accessGranted:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({createIsolatedAttestationGate});
