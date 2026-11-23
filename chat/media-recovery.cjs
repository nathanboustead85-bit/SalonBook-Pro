'use strict';
// Emulator-only recovery: lease-based claims and conservative orphan cleanup.
const ID=/^[A-Za-z0-9_-]{1,80}$/;
const fail=code=>({ok:false,code});
function createMediaRecovery({db,bucket,businessId,clock=Date.now,enabled=false}={}){
 if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_STORAGE_EMULATOR_HOST)throw new Error('EMULATORS_REQUIRED');
 if(!db||!bucket||!ID.test(businessId||''))throw new TypeError('TRUSTED_DEPENDENCIES_REQUIRED');
 const conversationRef=id=>db.doc('businesses/'+businessId+'/conversations/'+id);
 async function expirePending({conversationId,actorUid,requestId,olderThanMs=300000}={}){
  if(!enabled)return fail('RECOVERY_DISABLED');
  if(![conversationId,actorUid,requestId].every(v=>ID.test(v||'')))return fail('INVALID_ID');
  const now=clock(),ref=conversationRef(conversationId).collection('messages').doc(actorUid+'_'+requestId);
  return db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   if(!snap.exists)return fail('NOT_FOUND');
   const d=snap.data();
   if(d.status!=='pending')return fail('NOT_PENDING');
   if(typeof d.createdAtMs!=='number'||now-d.createdAtMs<olderThanMs)return fail('NOT_STALE');
   tx.update(ref,{status:'failed',failureCode:'INTERRUPTED_UPLOAD',recoveredAtMs:now});
   return {ok:true};
  });
 }
 async function sweepOrphans({conversationId,olderThanMs=3600000,dryRun=true}={}){
  if(!enabled)return fail('RECOVERY_DISABLED');
  if(!ID.test(conversationId||'')||olderThanMs<3600000)return fail('INVALID_ARGUMENT');
  const conversation=await conversationRef(conversationId).get();
  if(!conversation.exists||conversation.data().businessId!==businessId)return fail('CONVERSATION_UNAVAILABLE');
  const messages=await conversationRef(conversationId).collection('messages').get();
  const referenced=new Set();
  messages.forEach(doc=>{const a=doc.data().attachment;if(a&&typeof a.storagePath==='string')referenced.add(a.storagePath)});
  const prefix='staging-chat/'+businessId+'/'+conversationId+'/';
  const [objects]=await bucket.getFiles({prefix});
  const candidates=[],deleted=[],errors=[];
  for(const object of objects){
   if(!/^staging-chat\/[A-Za-z0-9_-]{1,80}\/[A-Za-z0-9_-]{1,80}\/[a-f0-9]{32}$/.test(object.name)||referenced.has(object.name))continue;
   const [meta]=await object.getMetadata();
   const created=Date.parse(meta.timeCreated||'');
   if(!Number.isFinite(created)||clock()-created<olderThanMs)continue;
   candidates.push(object.name);
   if(!dryRun){
    try{await object.delete({ifGenerationMatch:Number(meta.generation)});deleted.push(object.name)}
    catch(e){errors.push({path:object.name,code:e.code||'DELETE_FAILED'})}
   }
  }
  return {ok:true,dryRun,candidates,deleted,errors};
 }
 return Object.freeze({expirePending,sweepOrphans});
}
module.exports={createMediaRecovery};
