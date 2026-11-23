'use strict';
const sharp=require('sharp');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {mkdtemp,writeFile,rm}=require('node:fs/promises');
const os=require('node:os'),path=require('node:path');
const {inspectUpload}=require('./media-validation.cjs');
const execFileAsync=promisify(execFile);
const err=code=>({ok:false,code});
async function decodeImage(bytes,mime){
 try{
  const image=sharp(bytes,{failOn:'error',limitInputPixels:20_000_000,animated:false});
  const meta=await image.metadata();
  if(!meta.width||!meta.height||meta.pages>1)return false;
  const expected={'image/png':'png','image/jpeg':'jpeg','image/webp':'webp'}[mime];
  if(meta.format!==expected)return false;
  // Decode pixels, not just header metadata. Strip metadata by re-encoding.
  await image.rotate().resize({width:4096,height:4096,fit:'inside',withoutEnlargement:true}).toBuffer();
  return true;
 }catch{return false}
}
async function sanitizeImage(bytes,mime){
 const accepted=await decodeImage(bytes,mime);
 if(!accepted)return err('IMAGE_DECODE_FAILED');
 try{
  const output=await sharp(bytes,{failOn:'error',limitInputPixels:20_000_000,animated:false})
   .rotate().resize({width:4096,height:4096,fit:'inside',withoutEnlargement:true})
   .jpeg({quality:85,mozjpeg:true}).toBuffer();
  return {ok:true,bytes:output,mime:'image/jpeg'};
 }catch{return err('IMAGE_REENCODE_FAILED')}
}
async function probeVoiceDuration(bytes,mime,{ffprobe='ffprobe'}={}){
 const dir=await mkdtemp(path.join(os.tmpdir(),'boustio-voice-'));
 const file=path.join(dir,'input.media');
 try{
  await writeFile(file,bytes,{mode:0o600});
  const {stdout}=await execFileAsync(ffprobe,['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',file],{timeout:10000,maxBuffer:100000});
  const seconds=Number(stdout.trim());
  if(!Number.isFinite(seconds)||seconds<=0)return NaN;
  return seconds;
 }catch{return NaN}
 finally{await rm(dir,{recursive:true,force:true})}
}
async function processMediaUpload({bytes,declaredMime,type,ownerUid,conversationId,ffprobe='ffprobe'}={}){
 if(type==='image'){
  const validation=await inspectUpload({bytes,declaredMime,type,ownerUid,conversationId,verifyImage:decodeImage});
  if(!validation.ok)return validation;
  const clean=await sanitizeImage(bytes,declaredMime);
  if(!clean.ok)return clean;
  // Sanitized bytes differ from uploaded bytes: caller must persist these bytes
  // and compute the digest of the sanitized representation.
  const crypto=require('node:crypto');
  return {...validation,mime:clean.mime,bytes:clean.bytes.length,sha256:crypto.createHash('sha256').update(clean.bytes).digest('hex'),processedBytes:clean.bytes};
 }
 if(type==='voice'){
  const validation=await inspectUpload({bytes,declaredMime,type,ownerUid,conversationId,
   probeDuration:(b,m)=>probeVoiceDuration(b,m,{ffprobe})});
  if(!validation.ok)return validation;
  // No audio transcoding, virus scan, or sandboxed processing yet; never expose
  // this result to a live upload route until those controls are implemented.
  return {...validation,processedBytes:bytes};
 }
 return err('INVALID_TYPE');
}
module.exports={decodeImage,sanitizeImage,probeVoiceDuration,processMediaUpload};
