"use strict";
const {prepareWebRequest}=require("./business-web-contract.cjs");
// Isolated injected transport only; no production endpoints or storage.
function createWebConnector({session,transport}){
 return async(draft,requestId)=>{
  const before=session();
  const request=prepareWebRequest(before,draft,requestId);
  if(typeof before.token!=="string"||!before.token)throw Error("Missing token");
  const token=before.token,epoch=before.epoch;
  const receipt=await transport(token,request);
  const after=session();
  if(!after||after.uid!==request.actorId||after.businessId!==request.businessId||after.verified!==true||after.token!==token||after.epoch!==epoch)throw Error("Session changed");
  if(!receipt||receipt.receiptVersion!==1||receipt.accepted!==true||receipt.status!=="accepted"||receipt.businessId!==request.businessId||receipt.actorId!==request.actorId||receipt.appointmentId!==request.appointmentId||receipt.requestId!==request.requestId||receipt.revision!==request.expectedRevision+1)throw Error("Invalid receipt");
  return receipt;
 };
}
module.exports={createWebConnector};
