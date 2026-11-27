"use strict";
const {prepareWebRequest}=require("./business-web-contract.cjs");
const {createWebConnector}=require("./business-web-connector.cjs");
// In-memory only. Never persist tokens or booking drafts in browser storage.
function createRecoverySession({session,transport}){
 const submit=createWebConnector({session,transport});
 let pending=null, busy=false;
 return {
 async send(draft,requestId){
  const current=session(), request=prepareWebRequest(current,draft,requestId);
  if(busy)throw Error("Submission in progress");
  if(pending&&(pending.epoch!==current.epoch||pending.token!==current.token||JSON.stringify(pending.request)!==JSON.stringify(request)))throw Error("Unresolved request");
  pending={request,epoch:current.epoch,token:current.token};
  busy=true;
  try{const receipt=await submit(draft,requestId);pending=null;return receipt;}
  finally{busy=false;}
 },
 state(){return busy?"submitting":pending?"unresolved":"idle";}
 };
}
module.exports={createRecoverySession};
