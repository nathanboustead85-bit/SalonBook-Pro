'use strict';
// Trusted-server-only adapter. The Firebase Admin SDK must be configured to a
// disposable Firestore emulator by the caller; this module never deploys.
const ID=/^[A-Za-z0-9_-]{1,80}$/;
function createFirestoreMessageStore(db,{emulatorOnly=true}={}){
 if(!db||typeof db.runTransaction!=='function')throw new TypeError('Firestore Admin instance required');
 if(emulatorOnly&&!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('FIRESTORE_EMULATOR_REQUIRED');
 return Object.freeze({
  async transactMessage({conversationId,requestId,actorUid,now,validateConversation,validateQuota,makeRecord}){
   if(![conversationId,requestId,actorUid].every(s=>typeof s==='string'&&ID.test(s)))return {ok:false,code:'INVALID_ID'};
   // Conversation location must be resolved from a trusted server index.
   // For now the caller supplies the owner's UID via a separately authenticated
   // routing binding, not an untrusted business ID.
   return {ok:false,code:'ROUTING_NOT_CONFIGURED'};
  }
 });
}
function createBoundFirestoreMessageStore(db,{businessId,emulatorOnly=true}={}){
 if(!ID.test(businessId||''))throw new TypeError('trusted business ID required');
 if(emulatorOnly&&!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('FIRESTORE_EMULATOR_REQUIRED');
 return Object.freeze({
  async transactMessage({conversationId,requestId,actorUid,now,validateConversation,validateQuota,makeRecord}){
   if(![conversationId,requestId,actorUid].every(s=>typeof s==='string'&&ID.test(s)))return {ok:false,code:'INVALID_ID'};
   const conversationRef=db.doc('businesses/'+businessId+'/conversations/'+conversationId);
   const messageRef=conversationRef.collection('messages').doc(actorUid+'_'+requestId);
   const quotaRef=conversationRef.collection('rateLimits').doc(actorUid);
   return db.runTransaction(async tx=>{
    // Read all docs before any writes to satisfy Firestore transaction contract.
    const [conversationSnap,messageSnap,quotaSnap]=await Promise.all([tx.get(conversationRef),tx.get(messageRef),tx.get(quotaRef)]);
    const access=validateConversation(conversationSnap.exists?{...conversationSnap.data(),id:conversationSnap.id}:null);
    if(!access.ok)return access;
    if(messageSnap.exists)return {ok:true,duplicate:true,record:messageSnap.data()};
    const timestamps=quotaSnap.exists&&Array.isArray(quotaSnap.data().timestamps)?quotaSnap.data().timestamps:[];
    const quota=validateQuota(timestamps);if(!quota.ok)return quota;
    const record=makeRecord(access.role);
    tx.create(messageRef,record);
    tx.set(quotaRef,{timestamps:[...timestamps.filter(t=>t>now-60000),now]});
    return {ok:true,duplicate:false,record};
   });
  }
 });
}
module.exports={createFirestoreMessageStore,createBoundFirestoreMessageStore};
