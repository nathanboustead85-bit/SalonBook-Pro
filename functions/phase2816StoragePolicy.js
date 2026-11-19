"use strict";
/* Phase 28.16: offline policy simulation. No cloud SDK or real storage access. */
const pathRx=/^pending\/businesses\/([A-Za-z0-9_-]{1,64})\/([A-Za-z0-9_-]{1,64})\/([A-Za-z0-9_-]{1,64})$/;
const MAX_SOURCE=8*1024*1024;
const MAX_PENDING=12;
const MAX_ATTEMPTS=30;
function reject(reason){return Object.freeze({allowed:false,reason});}
function evaluateUpload({path,auth,verifiedOwnerUid,businessId,appCheckVerified,contentType,bytes,signatureValid,attemptsToday,pendingCount,uploadsEnabled,environment,quotaReservationAtomic}={}){
if(uploadsEnabled!==true||environment!=="isolated-test")return reject("STORAGE_DISABLED");
const match=typeof path==="string"&&path.match(pathRx);
if(!match)return reject("INVALID_PENDING_PATH");
if(!auth||typeof auth.uid!=="string"||auth.emailVerified!==true||auth.uid!==verifiedOwnerUid||auth.uid!==match[2])return reject("NOT_VERIFIED_OWNER");
if(match[1]!==businessId)return reject("CROSS_BUSINESS");
if(appCheckVerified!==true)return reject("APP_CHECK_REQUIRED");
if(!["image/jpeg","image/png","image/webp","image/avif"].includes(contentType))return reject("BAD_CONTENT_TYPE");
if(!Number.isSafeInteger(bytes)||bytes<1||bytes>MAX_SOURCE||signatureValid!==true)return reject("INVALID_FILE");
if(!Number.isSafeInteger(attemptsToday)||attemptsToday<0||attemptsToday>=MAX_ATTEMPTS)return reject("RATE_LIMIT");
if(!Number.isSafeInteger(pendingCount)||pendingCount<0||pendingCount>=MAX_PENDING)return reject("PENDING_LIMIT");
if(quotaReservationAtomic!==true)return reject("ATOMIC_QUOTA_REQUIRED");
return Object.freeze({allowed:true,reason:"ISOLATED_POLICY_SIMULATION_ONLY"});
}
function evaluateClientStorageAccess(){return reject("ALL_CLIENT_STORAGE_ACCESS_DISABLED");}
function evaluatePublication({environment,uploadsEnabled,scanPassed,moderationApproved,exifRemoved,converted,ownerRechecked,atomicQuotaCommitted}={}){
if(environment!=="isolated-test"||uploadsEnabled!==true)return reject("PUBLICATION_DISABLED");
if([scanPassed,moderationApproved,exifRemoved,converted,ownerRechecked,atomicQuotaCommitted].some(v=>v!==true))return reject("PROCESSING_REQUIRED");
return Object.freeze({allowed:true,reason:"ISOLATED_PUBLICATION_SIMULATION_ONLY"});
}
module.exports=Object.freeze({evaluateUpload,evaluateClientStorageAccess,evaluatePublication,MAX_SOURCE,MAX_PENDING,MAX_ATTEMPTS});
