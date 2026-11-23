'use strict';
// Server-side emulator-only inbox projections and notification candidates.
// No push service, browser endpoint, credentials or production listener.
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const fail=code=>({ok:false,code});
function createEmulatorInboxEvents({db,businessId,enabled=false}={}){
 if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('FIRESTORE_EMULATOR_REQUIRED');
 if(!db||typeof db.doc!=='function'||!ID.test(businessId||''))throw new TypeError('TRUSTED_DEPENDENCIES_REQUIRED');
 const root=db.collection('businesses').doc(businessId).collection('conversations');
 async function access({auth,conversationId}={}){
  if(!enabled)return fail('MESSAGING_DISABLED');
  if(!auth||auth.emailVerified!==true||!ID.test(auth.uid||''))return fail('AUTH_REQUIRED');
  if(!ID.test(conversationId||''))return fail('INVALID_CONVERSATION');
  const snap=await root.doc(conversationId).get();
  if(!snap.exists)return fail('CONVERSATION_UNAVAILABLE');
  const c=snap.data();
  if(c.businessId!==businessId||c.ownerUid!==businessId||c.status!=='open'||![c.ownerUid,c.customerUid].includes(auth.uid))return fail('NOT_AUTHORIZED');
  return {ok:true,conversation:c};
 }
 function safeMessage(doc){
  const d=doc.data();
  if(!['text','image','voice'].includes(d.type)||!ID.test(d.senderUid||'')||!Number.isSafeInteger(d.createdAtMs))return null;
  return {id:doc.id,senderUid:d.senderUid,type:d.type,createdAtMs:d.createdAtMs,
   text:d.type==='text'&&typeof d.text==='string'?d.text.slice(0,4000):null,
   mediaReady:d.type!=='text'&&d.status==='ready'};
 }
 return Object.freeze({
  async listMessages({auth,conversationId,limit=50}={}){
   const a=await access({auth,conversationId});if(!a.ok)return a;
   if(!Number.isInteger(limit)||limit<1||limit>50)return fail('INVALID_LIMIT');
   const snap=await root.doc(conversationId).collection('messages').orderBy('createdAtMs','desc').limit(limit).get();
   return {ok:true,messages:snap.docs.map(safeMessage).filter(Boolean).reverse()};
  },
  async listBusinessInbox({auth,limit=30}={}){
   if(!enabled)return fail('MESSAGING_DISABLED');
   if(!auth||auth.emailVerified!==true||auth.uid!==businessId)return fail('OWNER_REQUIRED');
   if(!Number.isInteger(limit)||limit<1||limit>30)return fail('INVALID_LIMIT');
   const snap=await root.limit(limit).get();
   const conversations=snap.docs.filter(doc=>doc.data().ownerUid===businessId&&doc.data().businessId===businessId&&doc.data().status==='open');
   const items=[];
   for(const c of conversations){
    const recent=await c.ref.collection('messages').orderBy('createdAtMs','desc').limit(1).get();
    const latest=recent.empty?null:safeMessage(recent.docs[0]);
    items.push({conversationId:c.id,customerUid:c.data().customerUid,lastMessage:latest});
   }
   return {ok:true,items};
  },
  async notificationCandidates({auth,conversationId,sinceMs=0}={}){
   const a=await access({auth,conversationId});if(!a.ok)return a;
   if(!Number.isSafeInteger(sinceMs)||sinceMs<0)return fail('INVALID_CURSOR');
   const snap=await root.doc(conversationId).collection('messages').where('createdAtMs','>',sinceMs).orderBy('createdAtMs').limit(50).get();
   const events=snap.docs.map(safeMessage).filter(m=>m&&m.senderUid!==auth.uid&&(m.type==='text'||m.mediaReady))
    .map(m=>({messageId:m.id,conversationId,createdAtMs:m.createdAtMs,kind:m.type,recipientUid:auth.uid}));
   return {ok:true,events};
  }
 });
}
module.exports={createEmulatorInboxEvents};
