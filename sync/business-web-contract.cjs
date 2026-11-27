"use strict";
// Isolated business web contract; no browser storage or live endpoint.
const {prepareRequest}=require("./android-request.cjs");
const {transition}=require("./android-contract.cjs");
function prepareWebRequest(session,draft,requestId){
 if(!session||session.verified!==true||session.uid!==session.businessId)throw Error("Owner session required");
 return prepareRequest(session,draft,requestId);
}
function acceptWebReceipt(session,request,receipt){
 if(!session||session.uid!==session.businessId)return {state:"blocked"};
 return transition(request,receipt,session);
}
module.exports={prepareWebRequest,acceptWebReceipt};
