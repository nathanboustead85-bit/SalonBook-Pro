'use strict';
// Isolated, trusted-server session for emulator integration tests only.
// The caller must verify Firebase identity and bind the business ID server-side.
const {createMessageBackend}=require('./backend.cjs');
const {createBoundFirestoreMessageStore}=require('./firestore-adapter.cjs');
const {createEmulatorInboxEvents}=require('./emulator-inbox-events.cjs');
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const fail=code=>({ok:false,code});
function createEmulatorConversationSession({db,businessId,auth,enabled=false,clock=Date.now}={}){
 if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('FIRESTORE_EMULATOR_REQUIRED');
 if(!db||!ID.test(businessId||''))throw new TypeError('TRUSTED_SERVER_BINDING_REQUIRED');
 if(!auth||!ID.test(auth.uid||'')||auth.emailVerified!==true)throw new TypeError('VERIFIED_IDENTITY_REQUIRED');
 const store=createBoundFirestoreMessageStore(db,{businessId});
 const backend=createMessageBackend({store,enabled,clock});
 const inbox=createEmulatorInboxEvents({db,businessId,enabled});
 const authorized=async conversationId=>{
  const response=await inbox.listMessages({auth,conversationId,limit:1});
  return response.ok?{ok:true}:response;
 };
 return Object.freeze({
  async sendText({conversationId,requestId,text}={}){
   if(!enabled)return fail('MESSAGING_DISABLED');
   const check=await authorized(conversationId);if(!check.ok)return check;
   return backend.send({auth,conversationId,requestId,message:{type:'text',text}});
  },
  async messages({conversationId,limit}={}){return inbox.listMessages({auth,conversationId,limit})},
  async inbox({limit}={}){return inbox.listBusinessInbox({auth,limit})},
  async notifications({conversationId,sinceMs}={}){return inbox.notificationCandidates({auth,conversationId,sinceMs})}
 });
}
module.exports={createEmulatorConversationSession};
