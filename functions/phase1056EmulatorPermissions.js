"use strict";
/** Phase 10.56 emulator-only authorization matrix. No IAM claims or production exports. */
const {PROJECT}=require("./phase1040EmulatorLockedInitialization");
const RIGHTS=Object.freeze({
 owner:Object.freeze(["request-issue","request-consume"]),
 issuer:Object.freeze(["issue-record"]),
 consumer:Object.freeze(["consume-record"]),
 operator:Object.freeze(["sign-approval"]),
 auditor:Object.freeze(["verify-receipt"])
});
function deny(){throw Error("phase1056 permission denied");}
function authorize({role,action,projectId,ownerUid,businessId,verified,operatorRole}={}){
 if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST||
 process.env.GCLOUD_PROJECT!==PROJECT||process.env.GOOGLE_CLOUD_PROJECT!==PROJECT||
 process.env.GOOGLE_APPLICATION_CREDENTIALS||projectId!==PROJECT)deny();
 if(typeof role!=="string"||!Object.hasOwn(RIGHTS,role)||
 !RIGHTS[role].includes(action))deny();
 if(role==="owner"&&(verified!==true||!ownerUid||ownerUid!==businessId))deny();
 if(role==="operator"&&operatorRole!=="legacy-mode-approver")deny();
 return Object.freeze({allowed:true,productionWriteAllowed:false});
}
module.exports={authorize,RIGHTS};
