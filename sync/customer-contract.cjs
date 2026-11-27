"use strict";
// Isolated request contract, not an authorization endpoint.
const {prepareRequest}=require("./android-request.cjs");
function prepareCustomerRequest(session,businessId,draft,requestId){
 if(!session||session.verified!==true||session.uid===businessId||!draft||draft.action!=="create")throw Error("Customer creation required");
 return prepareRequest({verified:true,uid:session.uid,businessId},draft,requestId);
}
module.exports={prepareCustomerRequest};