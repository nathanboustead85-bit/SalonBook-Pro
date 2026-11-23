'use strict';
const crypto=require('node:crypto');
const MAX_IMAGE=5*1024*1024,MAX_VOICE=10*1024*1024;
const allowedImages=new Set(['image/jpeg','image/png','image/webp']);
const allowedAudio=new Set(['audio/webm','audio/mp4','audio/mpeg','audio/ogg']);
const ID=/^[a-zA-Z0-9_-]{1,80}$/;
const fail=code=>({ok:false,code});
function detectedMime(bytes){
 if(!Buffer.isBuffer(bytes))return null;
 if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
 if(bytes.length>=4&&bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])))return 'audio/webm';
 if(bytes.length>=4&&bytes.toString('ascii',0,4)==='OggS')return 'audio/ogg';
 if(bytes.length>=8&&bytes.toString('ascii',4,8)==='ftyp')return 'audio/mp4';
 if(bytes.length>=3&&bytes.toString('ascii',0,3)==='ID3')return 'audio/mpeg';
 if(bytes.length>=2&&bytes[0]===255&&(bytes[1]&0xe0)===0xe0)return 'audio/mpeg';
 return null;
}
async function inspectUpload({bytes,declaredMime,type,ownerUid,conversationId,probeDuration,verifyImage}={}){
 if(!Buffer.isBuffer(bytes)||bytes.length===0)return fail('INVALID_BYTES');
 if(!ID.test(ownerUid||'')||!ID.test(conversationId||''))return fail('INVALID_CONTEXT');
 if(type!=='image'&&type!=='voice')return fail('INVALID_TYPE');
 const mime=detectedMime(bytes);
 const accepted=type==='image'?allowedImages:allowedAudio;
 const max=type==='image'?MAX_IMAGE:MAX_VOICE;
 if(bytes.length>max)return fail('TOO_LARGE');
 if(!accepted.has(mime)||declaredMime!==mime)return fail('MIME_MISMATCH');
 // Signature checks alone cannot prove image decode or reject polyglots.
 // Require trusted image decoder to validate full image before accepting.
 if(type==='image'){
  if(typeof verifyImage!=='function')return fail('IMAGE_DECODER_REQUIRED');
  let verified=false;
  try{verified=await verifyImage(bytes,mime)}catch{return fail('IMAGE_DECODE_FAILED')}
  if(verified!==true)return fail('IMAGE_DECODE_FAILED');
 }
 if(type==='voice'){
  // Never trust duration metadata from the sender. The probe must inspect
  // actual bytes with a trusted parser (e.g. ffprobe in sandbox).
  if(typeof probeDuration!=='function')return fail('DURATION_PROBE_REQUIRED');
  let duration;
  try{duration=await probeDuration(bytes,mime)}catch{return fail('DURATION_PROBE_FAILED')}
  if(typeof duration!=='number'||!Number.isFinite(duration)||duration<=0||duration>60)return fail('INVALID_DURATION');
 }
 const digest=crypto.createHash('sha256').update(bytes).digest('hex');
 const assetId=crypto.randomBytes(16).toString('hex');
 return {ok:true,type,mime,bytes:bytes.length,sha256:digest,storagePath:`staging-chat/${ownerUid}/${conversationId}/${assetId}`};
}
module.exports={inspectUpload,detectedMime};
