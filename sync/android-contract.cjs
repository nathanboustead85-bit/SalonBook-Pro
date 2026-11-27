"use strict";
// Isolated contract prototype; no network or local storage access.
function transition(pending,receipt,session){
 if(!pending||!session||session.verified!==true||pending.businessId!==session.businessId||pending.actorId!==session.uid)return {state:"blocked"};
 if(!receipt)return {state:"pending",requestId:pending.requestId};
 if(receipt.requestId!==pending.requestId||receipt.businessId!==pending.businessId||receipt.actorId!==pending.actorId||receipt.appointmentId!==pending.appointmentId)return {state:"blocked"};
 if(receipt.status==="accepted"&&Number.isSafeInteger(receipt.revision)&&receipt.revision>pending.expectedRevision)return {state:"confirmed",revision:receipt.revision};
 if(receipt.status==="conflict")return {state:"conflict"};
 return {state:"pending",requestId:pending.requestId};
}
module.exports={transition};
