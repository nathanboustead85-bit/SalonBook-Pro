'use strict';
// Emulator-only Firestore reservation finalizer. Callers must use a trusted business binding.
const ID=/^[A-Za-z0-9_-]{1,80}$/;
function createReservationFinalizer(db,{businessId}={}){
 if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('FIRESTORE_EMULATOR_REQUIRED');
 if(!db||!ID.test(businessId||''))throw new TypeError('TRUSTED_FIRESTORE_BINDING_REQUIRED');
 const ref=(conversationId,actorUid,requestId)=>{
  if(![conversationId,actorUid,requestId].every(v=>ID.test(v||'')))throw new TypeError('INVALID_ID');
  return db.doc('businesses/'+businessId+'/conversations/'+conversationId+'/messages/'+actorUid+'_'+requestId);
 };
 return Object.freeze({
  async completeReservation({conversationId,actorUid,requestId,attachment}){
   return db.runTransaction(async tx=>{
    const doc=ref(conversationId,actorUid,requestId);
    const snap=await tx.get(doc);
    if(!snap.exists||snap.data().status!=='pending'||snap.data().senderUid!==actorUid)return {ok:false,code:'RESERVATION_NOT_PENDING'};
    tx.update(doc,{status:'ready',attachment});
    return {ok:true,record:{...snap.data(),status:'ready',attachment}};
   });
  },
  async failReservation({conversationId,actorUid,requestId,reason}){
   return db.runTransaction(async tx=>{
    const doc=ref(conversationId,actorUid,requestId);
    const snap=await tx.get(doc);
    if(!snap.exists||snap.data().status!=='pending')return {ok:false,code:'RESERVATION_NOT_PENDING'};
    tx.update(doc,{status:'failed',failureCode:reason});
    return {ok:true};
   });
  }
 });
}
module.exports={createReservationFinalizer};
