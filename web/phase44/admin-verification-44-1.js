"use strict";
// Emulator-only injected Firebase Admin SDK verification contract; never initializes Admin or accesses production.
const {validateConfig}=require("../phase43/trusted-auth-contract-43-1");
const deny=reason=>Object.freeze({status:"DENIED",reason,stagingApproved:false,productionReady:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
function createAdminVerification({config,adminAuth,adminAppCheck,approvedAppIds,now=Date.now}={}){
 if(validateConfig(config).status!=="ISOLATED_CONFIG_VALID"||!adminAuth||typeof adminAuth.verifyIdToken!=="function"||!adminAppCheck||typeof adminAppCheck.verifyToken!=="function"||!Array.isArray(approvedAppIds)||approvedAppIds.length===0||approvedAppIds.some(x=>typeof x!=="string"||!/^[-_.:A-Za-z0-9]{3,200}$/.test(x))||typeof now!=="function")throw TypeError("isolated_admin_verification_dependencies_required");
 const allowed=new Set(approvedAppIds);let epoch=0,active=true;
 const invalidate=()=>{epoch++;return deny("session_invalidated")};
 async function verify({uid,idToken,appCheckToken}={}){
  const seq=epoch;
  if(!active||typeof uid!=="string"||!/^[A-Za-z0-9_-]{1,80}$/.test(uid)||typeof idToken!=="string"||!idToken.trim()||typeof appCheckToken!=="string"||!appCheckToken.trim())return deny("missing_credentials");
  try{
   const identity=await adminAuth.verifyIdToken(idToken,true);
   if(!active||seq!==epoch)return deny("session_invalidated");
   const t=now();
   if(!identity||identity.uid!==uid||identity.email_verified!==true||identity.firebase?.sign_in_provider==="anonymous"||!Number.isSafeInteger(identity.iat)||!Number.isSafeInteger(identity.auth_time)||!Number.isSafeInteger(identity.exp)||identity.iat>identity.exp||identity.auth_time>identity.iat||identity.exp*1000<=t||identity.iat*1000>t+30000||t-identity.auth_time*1000>900000)return deny("identity_invalid_or_stale");
   const app=await adminAppCheck.verifyToken(appCheckToken,{consume:true});
   if(!active||seq!==epoch)return deny("session_invalidated");
   if(!app||!allowed.has(app.appId)||app.alreadyConsumed!==false)return deny("app_check_not_fresh_or_approved");
   if(identity.exp*1000<=now())return deny("expired_during_verification");
   // Synthetic contracts never grant staging, read permissions or live capabilities.
   return Object.freeze({status:"ISOLATED_ADMIN_CONTRACT_VALID",uid,stagingApproved:false,productionReady:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
  }catch{return deny(!active||seq!==epoch?"session_invalidated":"verification_failed")}
 }
 return Object.freeze({verify,invalidate,stop(){active=false;epoch++;return deny("stopped")},stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({createAdminVerification});
