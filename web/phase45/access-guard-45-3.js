"use strict";
// Pure emulator-only authorization policy. Not a substitute for Firebase security rules.
const {validateSafeConfiguration,expected}=require("./secrets-guard-45-2");
const blocked=reason=>Object.freeze({status:"DENIED",reason,readOnly:false,canBook:false,canPay:false,canMessage:false,canDeploy:false,stagingApproved:false});
const validId=id=>typeof id==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(id);
function authorizeOwnerRead({config=expected,environment={},identity,ownerId,resourceOwnerId,operation="read"}={}){
 const validation=validateSafeConfiguration(config,environment);
 if(validation.status!=="ISOLATED_SECRETS_CHECK_PASSED")return blocked("environment_denied");
 if(operation!=="read")return blocked("operation_denied");
 if(!validId(ownerId)||!validId(resourceOwnerId)||!identity||typeof identity!=="object")return blocked("identity_missing");
 if(!validId(identity.uid)||identity.uid!==ownerId||resourceOwnerId!==ownerId)return blocked("owner_mismatch");
 if(identity.emailVerified!==true||identity.revocationVerified!==true||identity.appCheckVerified!==true)return blocked("verification_missing");
 if(identity.sessionActive!==true||identity.online!==true)return blocked("session_unavailable");
 return Object.freeze({status:"ISOLATED_OWNER_READ_ALLOWED",ownerId,readOnly:true,canBook:false,canPay:false,canMessage:false,canDeploy:false,stagingApproved:false});
}
module.exports=Object.freeze({authorizeOwnerRead,blocked});
