"use strict";
// Prototype: receipt must originate from authenticated transport, not browser input.
const {transition}=require("./android-contract.cjs");
function confirmation(session,request,receipt){
 if(!session||session.verified!==true||!request||request.action!=="create"||request.expectedRevision!==0||session.uid!==request.actorId||session.businessId!==request.businessId)return {state:"blocked"};
 const result=transition(request,receipt,session);
 if(result.state==="confirmed"&&result.revision!==1)return {state:"blocked"};
 return result.state==="confirmed"?{state:"confirmed",appointmentId:request.appointmentId,revision:1}: {state:result.state};
}
module.exports={confirmation};