'use strict';
const {createMessageBackend}=require('./backend.cjs');
const {authorizeParticipant,enforceRateLimit}=require('./security.cjs');
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const fail=code=>({ok:false,code});
function createIntegratedEmulatorChat({store,media,enabled=false,clock=Date.now}={}){
 if(!store||typeof store.transactMessage!=='function'||!media||typeof media.upload!=='function')throw new TypeError('TRUSTED_ADAPTERS_REQUIRED');
 const textBackend=createMessageBackend({store,enabled,clock});
 return Object.freeze({
  sendText:args=>textBackend.send(args),
  async sendMedia({auth,conversationId,requestId,bytes,declaredMime,type}={}){
   if(!enabled)return fail('MESSAGING_DISABLED');
   if(!auth||auth.emailVerified!==true||!ID.test(auth.uid||''))return fail('AUTH_REQUIRED');
   if(!ID.test(conversationId||'')||!ID.test(requestId||''))return fail('INVALID_ID');
   if(type!=='image'&&type!=='voice')return fail('INVALID_TYPE');
   const now=clock();if(!Number.isSafeInteger(now)||now<0)return fail('INVALID_CLOCK');
   // Upload adapter independently authorizes against server-loaded membership.
   const uploaded=await media.upload({auth,conversationId,bytes,declaredMime,type});
   if(!uploaded.ok)return uploaded;
   const result=await store.transactMessage({
    conversationId,requestId,actorUid:auth.uid,now,
    validateConversation(conversation){
     if(!conversation||conversation.id!==conversationId||conversation.status!=='open')return fail('CONVERSATION_UNAVAILABLE');
     const a=authorizeParticipant({actorUid:auth.uid,actorVerified:auth.emailVerified,ownerUid:conversation.ownerUid,customerUid:conversation.customerUid,conversationBusinessId:conversation.businessId});
     return a.ok?{ok:true,role:a.role}:fail('NOT_AUTHORIZED');
    },
    validateQuota:times=>enforceRateLimit({recentMessageTimes:times,nowMs:now,limit:10,windowMs:60000}),
    makeRecord:role=>({senderUid:auth.uid,senderRole:role,type,attachment:{storagePath:uploaded.storagePath,mime:uploaded.mime,bytes:uploaded.bytes,sha256:uploaded.sha256},createdAtMs:now,requestId})
   });
   // A rejected/duplicate transaction may leave an unreferenced uploaded object.
   // No production use until a reservation-first workflow, idempotent object key
   // and garbage collection/compensation are implemented.
   return result;
  }
 });
}
module.exports={createIntegratedEmulatorChat};
