'use strict';
const {processMediaUpload}=require('./media-processing.cjs');
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const fail=code=>({ok:false,code});
function createEmulatorStorage({bucket,loadConversation,enabled=false}={}){
 if(!process.env.FIREBASE_STORAGE_EMULATOR_HOST)throw new Error('STORAGE_EMULATOR_REQUIRED');
 if(!bucket||typeof bucket.file!=='function'||typeof loadConversation!=='function')throw new TypeError('TRUSTED_STORAGE_DEPENDENCIES_REQUIRED');
 async function authorize(auth,conversationId){
  if(!auth||auth.emailVerified!==true||!ID.test(auth.uid||''))return fail('AUTH_REQUIRED');
  if(!ID.test(conversationId||''))return fail('INVALID_CONVERSATION');
  const conversation=await loadConversation(conversationId);
  if(!conversation||conversation.id!==conversationId||conversation.status!=='open'||!ID.test(conversation.businessId||'')||conversation.ownerUid!==conversation.businessId||![conversation.ownerUid,conversation.customerUid].includes(auth.uid))return fail('NOT_AUTHORIZED');
  return {ok:true,conversation};
 }
 return Object.freeze({
  async upload({auth,conversationId,bytes,declaredMime,type}={}){
   if(!enabled)return fail('MEDIA_DISABLED');
   const access=await authorize(auth,conversationId);if(!access.ok)return access;
   const {conversation}=access;
   const processed=await processMediaUpload({bytes,declaredMime,type,ownerUid:conversation.businessId,conversationId});
   if(!processed.ok)return processed;
   const file=bucket.file(processed.storagePath);
   // Admin SDK bypasses Storage Rules: only trusted server can invoke this adapter.
   await file.save(processed.processedBytes,{resumable:false,validation:'crc32c',metadata:{contentType:processed.mime,metadata:{sha256:processed.sha256}},preconditionOpts:{ifGenerationMatch:0}});
   const {processedBytes,...meta}=processed;
   return {...meta,ok:true};
  },
  async download({auth,conversationId,storagePath}={}){
   if(!enabled)return fail('MEDIA_DISABLED');
   const access=await authorize(auth,conversationId);if(!access.ok)return access;
   const {conversation}=access;
   const prefix=`staging-chat/${conversation.businessId}/${conversationId}/`;
   if(typeof storagePath!=='string'||!storagePath.startsWith(prefix)||!/^staging-chat\/[A-Za-z0-9_-]{1,80}\/[A-Za-z0-9_-]{1,80}\/[a-f0-9]{32}$/.test(storagePath))return fail('INVALID_STORAGE_PATH');
   try{
    const [bytes]=await bucket.file(storagePath).download();
    return {ok:true,bytes};
   }catch(e){if(e.code===404)return fail('NOT_FOUND');throw e}
  }
 });
}
module.exports={createEmulatorStorage};
