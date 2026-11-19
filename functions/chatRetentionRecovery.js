"use strict";
// Phase 27.11: isolated failure-classification adapter. No live callable integration.
const RETRYABLE=new Set([4,10,14,"deadline-exceeded","aborted","unavailable"]);
function classifyTransactionFailure(error){
 const code=error&&error.code;
 const retryable=RETRYABLE.has(code);
 return Object.freeze({allowed:false,retryable,reason:retryable?"temporary-transaction-failure":"transaction-failure"});
}
async function consumeFailClosed(consume,db,args){
 if(typeof consume!=="function")throw Error("Budget consumer required");
 try{
  const result=await consume(db,args);
  if(!result||typeof result.allowed!=="boolean")return Object.freeze({allowed:false,retryable:false,reason:"invalid-result"});
  if(result.allowed===false)return Object.freeze({allowed:false,retryable:false,reason:"rate-limited"});
  return Object.freeze({allowed:true,retryable:false,reason:"accepted"});
 }catch(error){return classifyTransactionFailure(error);}
}
module.exports={classifyTransactionFailure,consumeFailClosed};
