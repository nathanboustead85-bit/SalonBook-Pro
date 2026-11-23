'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {processMediaUpload}=require('./media-processing.cjs');
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const deny=code=>({ok:false,code});
function createStagingMediaStore({root,enabled=false}={}){
 if(typeof root!=='string'||!path.isAbsolute(root))throw new Error('ABSOLUTE_TEST_ROOT_REQUIRED');
 if(!root.includes('boustio-media-test-'))throw new Error('DISPOSABLE_TEST_ROOT_REQUIRED');
 async function upload({auth,conversation,bytes,declaredMime,type}={}){
  if(!enabled)return deny('MEDIA_DISABLED');
  if(!auth||auth.emailVerified!==true||!ID.test(auth.uid||''))return deny('AUTH_REQUIRED');
  if(!conversation||!ID.test(conversation.id||'')||!ID.test(conversation.businessId||'')||conversation.status!=='open')return deny('CONVERSATION_UNAVAILABLE');
  if(conversation.ownerUid!==conversation.businessId||![conversation.ownerUid,conversation.customerUid].includes(auth.uid))return deny('NOT_AUTHORIZED');
  const processed=await processMediaUpload({bytes,declaredMime,type,ownerUid:conversation.businessId,conversationId:conversation.id});
  if(!processed.ok)return processed;
  const destination=path.join(root,processed.storagePath);
  const dir=path.dirname(destination);
  await fs.mkdir(dir,{recursive:true,mode:0o700});
  // Random filename, exclusive creation, no caller-provided paths.
  await fs.writeFile(destination,processed.processedBytes,{flag:'wx',mode:0o600});
  const {processedBytes,...meta}=processed;
  return {...meta,ok:true};
 }
 async function read({auth,conversation,storagePath}={}){
  if(!enabled)return deny('MEDIA_DISABLED');
  if(!auth||auth.emailVerified!==true||!ID.test(auth.uid||''))return deny('AUTH_REQUIRED');
  if(!conversation||conversation.status!=='open'||conversation.ownerUid!==conversation.businessId||![conversation.ownerUid,conversation.customerUid].includes(auth.uid))return deny('NOT_AUTHORIZED');
  const prefix=`staging-chat/${conversation.businessId}/${conversation.id}/`;
  if(typeof storagePath!=='string'||!storagePath.startsWith(prefix)||!/^staging-chat\/[A-Za-z0-9_-]{1,80}\/[A-Za-z0-9_-]{1,80}\/[a-f0-9]{32}$/.test(storagePath))return deny('INVALID_STORAGE_PATH');
  try{return {ok:true,bytes:await fs.readFile(path.join(root,storagePath))}}catch(e){if(e.code==='ENOENT')return deny('NOT_FOUND');throw e}
 }
 return Object.freeze({upload,read});
}
module.exports={createStagingMediaStore};
