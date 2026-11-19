"use strict";
/* Phase 28.15: offline policy simulation ONLY. No storage client, upload endpoint or live writes. */
const MAX_SOURCE_BYTES=8*1024*1024;
const MAX_PROCESSED_BYTES=2*1024*1024;
const MAX_DAILY_ATTEMPTS=30;
const MAX_DAILY_ACCEPTED=12;
const MAX_BUSINESS_PHOTOS=21; // 12 services + 8 staff + 1 cover
const idOk=v=>typeof v==="string"&&/^[A-Za-z0-9_-]{1,64}$/.test(v);
const cleanText=v=>typeof v==="string"&&v.length>0&&v.length<=120&&!/[<>\u0000-\u001f]/.test(v);
function decision(reason){return Object.freeze({allowed:false,reason});}
function preflight(request,context){
if(!request||typeof request!=="object"||Array.isArray(request)||!context||typeof context!=="object")return decision("INVALID_INPUT");
if(context.uploadsEnabled!==true)return decision("UPLOADS_DISABLED");
if(context.environment!=="isolated-test")return decision("NON_TEST_ENVIRONMENT_BLOCKED");
if(!context.auth||context.auth.emailVerified!==true||!idOk(context.auth.uid))return decision("VERIFIED_AUTH_REQUIRED");
if(context.auth.uid!==context.verifiedBusinessOwnerUid)return decision("NOT_BUSINESS_OWNER");
if(context.appCheckVerified!==true)return decision("APP_CHECK_REQUIRED");
if(!idOk(request.businessId)||request.businessId!==context.businessId||!idOk(context.businessId))return decision("BUSINESS_MISMATCH");
if(!idOk(request.photoId)||!["service","staff","cover"].includes(request.kind))return decision("INVALID_PHOTO_ID_OR_KIND");
if(request.kind==="cover"){if(request.subjectId!==null)return decision("INVALID_SUBJECT");}
else if(!idOk(request.subjectId)||!Array.isArray(context.allowedSubjectIds)||!context.allowedSubjectIds.includes(request.subjectId))return decision("INVALID_SUBJECT");
if(!["image/jpeg","image/png","image/webp","image/avif"].includes(request.mimeType))return decision("UNSUPPORTED_SOURCE_FORMAT");
if(!Number.isSafeInteger(request.bytes)||request.bytes<1||request.bytes>MAX_SOURCE_BYTES)return decision("SOURCE_TOO_LARGE");
if(!Number.isSafeInteger(request.width)||!Number.isSafeInteger(request.height)||request.width<320||request.height<240||request.width>8192||request.height>8192||request.width*request.height>24000000)return decision("INVALID_IMAGE_DIMENSIONS");
if(!cleanText(request.alt))return decision("INVALID_ALT_TEXT");
if(!Number.isSafeInteger(context.attemptsToday)||context.attemptsToday<0||context.attemptsToday>=MAX_DAILY_ATTEMPTS)return decision("DAILY_ATTEMPT_LIMIT");
if(!Number.isSafeInteger(context.acceptedToday)||context.acceptedToday<0||context.acceptedToday>=MAX_DAILY_ACCEPTED)return decision("DAILY_UPLOAD_LIMIT");
if(!Number.isSafeInteger(context.existingPhotoCount)||context.existingPhotoCount<0||context.existingPhotoCount>=MAX_BUSINESS_PHOTOS)return decision("BUSINESS_PHOTO_LIMIT");
return Object.freeze({allowed:true,reason:"ISOLATED_PREFLIGHT_ONLY",proposedPath:"pending/businesses/"+request.businessId+"/"+context.auth.uid+"/"+request.photoId,maximumProcessedBytes:MAX_PROCESSED_BYTES,requires:["server-side ownership recheck","atomic quota reservation","file signature verification","malware/content review","image re-encoding","strip EXIF","approval before publication"]});
}
function publicationGate(input){
if(!input||input.uploadsEnabled!==true||input.environment!=="isolated-test")return decision("PUBLICATION_DISABLED");
if(input.serverReviewed!==true||input.malwareScanPassed!==true||input.contentApproved!==true||input.exifStripped!==true||input.reencoded!==true)return decision("PROCESSING_INCOMPLETE");
if(!["image/webp","image/avif"].includes(input.mimeType)||!Number.isSafeInteger(input.bytes)||input.bytes<1||input.bytes>MAX_PROCESSED_BYTES)return decision("INVALID_PROCESSED_FILE");
if(!idOk(input.businessId)||!idOk(input.ownerUid)||!idOk(input.photoId))return decision("INVALID_OWNER_OR_PHOTO");
return Object.freeze({allowed:true,reason:"ISOLATED_PUBLICATION_SIMULATION",proposedPublicPath:"/media/businesses/"+input.businessId+"/"+input.ownerUid+"/"+input.photoId+"."+(input.mimeType==="image/webp"?"webp":"avif")});
}
module.exports=Object.freeze({preflight,publicationGate,MAX_SOURCE_BYTES,MAX_PROCESSED_BYTES,MAX_DAILY_ATTEMPTS,MAX_DAILY_ACCEPTED,MAX_BUSINESS_PHOTOS});
