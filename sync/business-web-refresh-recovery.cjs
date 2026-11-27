"use strict";
// Only opaque request identity is supplied by the caller. No browser storage or live transport.
async function reconcileRefresh({session,lookup},requestId){
 const before=session();
 if(!before||before.verified!==true||before.uid!==before.businessId||typeof before.token!=="string"||!before.token||typeof requestId!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(requestId))return {state:"blocked"};
 const {uid,businessId,token,epoch}=before;
 let receipt;
 try{receipt=await lookup(token,{businessId,requestId});}catch{return {state:"unresolved"};}
 const after=session();
 if(!after||after.verified!==true||after.uid!==uid||after.businessId!==businessId||after.token!==token||after.epoch!==epoch)return {state:"blocked"};
 if(!receipt||receipt.receiptVersion!==1||receipt.accepted!==true||receipt.status!=="accepted"||receipt.actorId!==uid||receipt.businessId!==businessId||receipt.requestId!==requestId||!Number.isSafeInteger(receipt.revision)||receipt.revision<1)return {state:"unresolved"};
 return {state:"confirmed",revision:receipt.revision};
}
module.exports={reconcileRefresh};
