"use strict";
// Isolated, dependency-injected policy. No SDK initialization, network, writes or production approvals.
const {validateConfig}=require("./trusted-auth-contract-43-1");
const deny=reason=>Object.freeze({status:"DENIED",reason,stagingApproved:false,productionReady:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
function createAppCheckPolicy({config,approvedAppIds,verifyIdToken,verifyAppCheckToken,consumeReplayKey,now=Date.now,maxAuthAgeMs=15*60*1000}={}){
 if(validateConfig(config).status!=="ISOLATED_CONFIG_VALID"||!Array.isArray(approvedAppIds)||approvedAppIds.length===0||approvedAppIds.some(x=>typeof x!=="string"||!/^[-_.:A-Za-z0-9]{3,200}$/.test(x))||new Set(approvedAppIds).size!==approvedAppIds.length||typeof verifyIdToken!=="function"||typeof verifyAppCheckToken!=="function"||typeof consumeReplayKey!=="function"||typeof now!=="function"||!Number.isSafeInteger(maxAuthAgeMs)||maxAuthAgeMs<1000||maxAuthAgeMs>3600000)throw TypeError("isolated_app_check_policy_dependencies_required");
 const allowed=new Set(approvedAppIds);
 let epoch=0,active=true;
 const invalidate=()=>{epoch++;return deny("session_invalidated")};
 const current=seq=>active&&epoch===seq;
 async function verify({uid,idToken,appCheckToken,replayKey}={}){
  const seq=epoch;
  if(!current(seq))return deny("session_invalidated");
  if(typeof uid!=="string"||!/^[A-Za-z0-9_-]{1,80}$/.test(uid)||typeof idToken!=="string"||!idToken.trim()||typeof appCheckToken!=="string"||!appCheckToken.trim()||typeof replayKey!=="string"||!/^[A-Za-z0-9_-]{16,128}$/.test(replayKey))return deny("missing_or_invalid_credentials");
  try{
   const identity=await verifyIdToken(idToken,true);
   if(!current(seq))return deny("session_invalidated");
   const t=now();
   if(!identity||identity.uid!==uid||identity.email_verified!==true||identity.firebase?.sign_in_provider==="anonymous"||!Number.isSafeInteger(identity.exp)||!Number.isSafeInteger(identity.iat)||!Number.isSafeInteger(identity.auth_time)||identity.iat*1000>t+30000||identity.auth_time*1000>t+30000||identity.auth_time>identity.iat||identity.iat>identity.exp||identity.exp*1000<=t||t-identity.auth_time*1000>maxAuthAgeMs)return deny("revoked_expired_or_stale_identity");
   // A real backend must use Admin SDK App Check verification and approved app IDs.
   const app=await verifyAppCheckToken(appCheckToken);
   if(!current(seq))return deny("session_invalidated");
   const t2=now();
   if(!app||!allowed.has(app.appId)||app.alreadyConsumed===true||!Number.isSafeInteger(app.iat)||!Number.isSafeInteger(app.exp)||app.iat*1000>t2+30000||app.exp*1000<=t2||app.iat>=app.exp)return deny("app_check_policy_rejected");
   // Atomic single-use key store must be supplied by a trusted backend; synthetic callbacks are not proof.
   const consumed=await consumeReplayKey({key:replayKey,uid,appId:app.appId,expiresAt:app.exp*1000});
   if(!current(seq))return deny("session_invalidated");
   if(consumed!==true)return deny("replay_unverified_or_detected");
   // Revalidate time after all asynchronous work, preventing stale decisions.
   if(identity.exp*1000<=now()||app.exp*1000<=now()||now()-identity.auth_time*1000>maxAuthAgeMs)return deny("expired_during_verification");
   return Object.freeze({status:"ISOLATED_POLICY_CONTRACT_VALID",uid,stagingApproved:false,productionReady:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
  }catch{return deny(current(seq)?"verification_unavailable":"session_invalidated")}
 }
 return Object.freeze({verify,invalidate,stop(){active=false;epoch++;return deny("stopped")},stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({createAppCheckPolicy});
