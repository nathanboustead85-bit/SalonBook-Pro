'use strict';
const MAX_TEXT_LENGTH=4000, MAX_VOICE_SECONDS=60, MAX_IMAGE_BYTES=5*1024*1024, MAX_VOICE_BYTES=10*1024*1024;
const IMAGE_MIMES=new Set(['image/jpeg','image/png','image/webp']);
const VOICE_MIMES=new Set(['audio/webm','audio/mp4','audio/mpeg','audio/ogg']);
const fail=(code)=>({ok:false,code});
function validateMessage(input){
 if(!input||typeof input!=='object'||Array.isArray(input))return fail('INVALID_MESSAGE');
 const keys=Object.keys(input);
 if(keys.some(k=>!['type','text','attachment'].includes(k)))return fail('UNKNOWN_FIELD');
 if(input.type==='text'){
  if(keys.includes('attachment')||typeof input.text!=='string'||!input.text.trim()||input.text.length>MAX_TEXT_LENGTH)return fail('INVALID_TEXT');
  return {ok:true,type:'text',text:input.text.trim()};
 }
 if(input.type!=='image'&&input.type!=='voice')return fail('INVALID_TYPE');
 if(keys.includes('text'))return fail('UNEXPECTED_TEXT');
 const a=input.attachment;
 if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!['mime','bytes','durationSeconds','storagePath'].includes(k)))return fail('INVALID_ATTACHMENT');
 if(typeof a.storagePath!=='string'||!/^staging-chat\/[a-zA-Z0-9_-]{1,80}\/[a-zA-Z0-9_-]{1,80}\/[a-zA-Z0-9_-]{1,100}$/.test(a.storagePath))return fail('INVALID_STORAGE_PATH');
 if(!Number.isSafeInteger(a.bytes)||a.bytes<=0)return fail('INVALID_SIZE');
 if(input.type==='image'){
  if(!IMAGE_MIMES.has(a.mime)||a.bytes>MAX_IMAGE_BYTES||'durationSeconds'in a)return fail('INVALID_IMAGE');
 }else{
  if(!VOICE_MIMES.has(a.mime)||a.bytes>MAX_VOICE_BYTES||typeof a.durationSeconds!=='number'||!Number.isFinite(a.durationSeconds)||a.durationSeconds<=0||a.durationSeconds>MAX_VOICE_SECONDS)return fail('INVALID_VOICE');
 }
 return {ok:true,type:input.type,attachment:{...a}};
}
function authorizeParticipant({actorUid,ownerUid,customerUid,actorVerified,conversationBusinessId}={}){
 if(![actorUid,ownerUid,customerUid,conversationBusinessId].every(x=>typeof x==='string'&&x.length>0))return fail('INVALID_IDENTITY');
 if(ownerUid!==conversationBusinessId)return fail('BUSINESS_MISMATCH');
 if(actorUid===ownerUid)return actorVerified===true?{ok:true,role:'business'}:fail('UNVERIFIED_OWNER');
 if(actorUid===customerUid)return {ok:true,role:'customer'};
 return fail('NOT_PARTICIPANT');
}
function enforceRateLimit({recentMessageTimes,nowMs,limit=10,windowMs=60000}={}){
 if(!Array.isArray(recentMessageTimes)||!Number.isFinite(nowMs)||!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(windowMs)||windowMs<1000)return fail('INVALID_RATE_CONTEXT');
 if(recentMessageTimes.some(t=>!Number.isFinite(t)||t>nowMs))return fail('INVALID_RATE_CONTEXT');
 const count=recentMessageTimes.filter(t=>t>nowMs-windowMs).length;
 return count>=limit?fail('RATE_LIMITED'):{ok:true,remaining:limit-count};
}
module.exports={validateMessage,authorizeParticipant,enforceRateLimit,MAX_VOICE_SECONDS,MAX_IMAGE_BYTES};
