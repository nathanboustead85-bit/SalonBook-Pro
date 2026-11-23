'use strict';
const {validateMessage,authorizeParticipant,enforceRateLimit}=require('./security.cjs');
const deny=code=>({ok:false,code});
const ID=/^[A-Za-z0-9_-]{1,80}$/;
function createMessageBackend({store,enabled=false,clock=Date.now}={}){
 if(!store||typeof store.transactMessage!=='function')throw new TypeError('trusted transactional store required');
 // No Firebase SDK, credentials, HTTP listener or deployment hook in this module.
 return Object.freeze({
  async send({auth,conversationId,message,requestId}={}){
   if(enabled!==true)return deny('MESSAGING_DISABLED');
   if(!auth||typeof auth.uid!=='string'||!auth.uid||auth.emailVerified!==true)return deny('AUTH_REQUIRED');
   if(!ID.test(conversationId||'')||!ID.test(requestId||''))return deny('INVALID_ID');
   const validated=validateMessage(message);
   if(!validated.ok)return validated;
   // Media metadata is not proof of content safety. Do not allow it until a
   // trusted upload scanner and ownership verifier are implemented.
   if(validated.type!=='text')return deny('MEDIA_NOT_READY');
   const now=clock();
   if(!Number.isSafeInteger(now)||now<0)return deny('INVALID_CLOCK');
   // Adapter must load membership, check idempotency, reserve quota and persist
   // the message within ONE serializable transaction; it must not trust client
   // supplied membership, timestamps, sender, or quota counters.
   return store.transactMessage({conversationId,requestId,actorUid:auth.uid,now,
    validateConversation(conversation){
     if(!conversation||conversation.id!==conversationId||conversation.status!=='open')return deny('CONVERSATION_UNAVAILABLE');
     const access=authorizeParticipant({actorUid:auth.uid,actorVerified:auth.emailVerified,
      ownerUid:conversation.ownerUid,customerUid:conversation.customerUid,
      conversationBusinessId:conversation.businessId});
     return access.ok?{ok:true,role:access.role}:deny('NOT_AUTHORIZED');
    },
    validateQuota(recentMessageTimes){return enforceRateLimit({recentMessageTimes,nowMs:now,limit:10,windowMs:60000})},
    makeRecord(role){return Object.freeze({senderUid:auth.uid,senderRole:role,type:'text',text:validated.text,createdAtMs:now,requestId})}
   });
  }
 });
}
module.exports={createMessageBackend};
