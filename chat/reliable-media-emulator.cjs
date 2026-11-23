'use strict';
// Emulator-only compensation layer. Does not claim exactly-once semantics.
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const deny=code=>({ok:false,code});
function createReliableMediaEmulator({store,media,enabled=false,clock=Date.now}={}){
 if(!store||typeof store.transactMessage!=='function'||!media||typeof media.upload!=='function'||typeof media.deleteObject!=='function')throw new TypeError('TRUSTED_ADAPTERS_REQUIRED');
 const inFlight=new Map();
 async function send({auth,conversationId,requestId,bytes,declaredMime,type}={}){
  if(!enabled)return deny('MESSAGING_DISABLED');
  if(!auth||auth.emailVerified!==true||!ID.test(auth.uid||''))return deny('AUTH_REQUIRED');
  if(!ID.test(conversationId||'')||!ID.test(requestId||''))return deny('INVALID_ID');
  if(!['image','voice'].includes(type))return deny('INVALID_TYPE');
  const key=auth.uid+'/'+conversationId+'/'+requestId;
  if(inFlight.has(key))return inFlight.get(key);
  const task=(async()=>{
   // Reservation/duplicate check must run BEFORE allocating storage.
   // This uses the same transaction API, with a record that explicitly marks
   // pending. No external client is allowed to read pending records.
   const now=clock();
   const reservation=await store.transactMessage({
    conversationId,requestId,actorUid:auth.uid,now,
    validateConversation(c){
     if(!c||c.id!==conversationId||c.status!=='open'||c.ownerUid!==c.businessId||![c.ownerUid,c.customerUid].includes(auth.uid))return deny('NOT_AUTHORIZED');
     return {ok:true,role:auth.uid===c.ownerUid?'owner':'customer'};
    },
    validateQuota:times=>({ok:times.filter(t=>t>now-60000).length<10,code:'RATE_LIMITED'}),
    makeRecord:role=>({senderUid:auth.uid,senderRole:role,type,status:'pending',createdAtMs:now,requestId})
   });
   if(!reservation.ok)return reservation;
   if(reservation.duplicate)return reservation.record.status==='ready'?{ok:true,duplicate:true,record:reservation.record}:deny('UPLOAD_PENDING_OR_FAILED');
   let uploaded;
   try{
    uploaded=await media.upload({auth,conversationId,bytes,declaredMime,type});
    if(!uploaded.ok){
     await store.failReservation({conversationId,actorUid:auth.uid,requestId,reason:uploaded.code});
     return uploaded;
    }
    const finalized=await store.completeReservation({conversationId,actorUid:auth.uid,requestId,attachment:{storagePath:uploaded.storagePath,mime:uploaded.mime,bytes:uploaded.bytes,sha256:uploaded.sha256}});
    if(!finalized.ok)throw new Error('FINALIZE_FAILED');
    return finalized;
   }catch(error){
    let cleanupFailed=false;
    if(uploaded&&uploaded.ok){
     try{await media.deleteObject({storagePath:uploaded.storagePath})}catch{cleanupFailed=true}
    }
    try{await store.failReservation({conversationId,actorUid:auth.uid,requestId,reason:cleanupFailed?'CLEANUP_REQUIRED':'UPLOAD_FAILED'})}catch{}
    return deny(cleanupFailed?'CLEANUP_REQUIRED':'UPLOAD_FAILED');
   }
  })();
  inFlight.set(key,task);
  try{return await task}finally{inFlight.delete(key)}
 }
 return Object.freeze({send});
}
module.exports={createReliableMediaEmulator};
