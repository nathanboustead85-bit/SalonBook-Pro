"use strict";
// Phase 27.6: explicit staging-only deletion helper. Not connected to live functions.
const {POLICY}=require("./chatRetentionReliability");
const ALLOWED=Object.freeze(["chatMonitoringAggregates","chatAbuseBudgets","chatTrustedCorrelationBudgets"]);
function validateDeletionRequest({collection,docId,nowMs,expiresAtMs,projectId}={}){
 if(typeof projectId!=="string"||!projectId.startsWith("demo-boustio-"))throw Error("Demo project required");
 if(!ALLOWED.includes(collection))throw Error("Collection not allowed");
 if(typeof docId!=="string"||!/^[a-zA-Z0-9_-]{1,128}$/.test(docId))throw Error("Invalid document ID");
 if(!Number.isSafeInteger(nowMs)||!Number.isSafeInteger(expiresAtMs)||nowMs<0||expiresAtMs<0)throw Error("Invalid expiry");
 return Object.freeze({eligible:nowMs>=expiresAtMs,collection,docId,projectId});
}
async function deleteExpiredStagingRecord({db,collection,docId,nowMs,projectId}={}){
 const ref=db.collection(collection).doc(docId);
 validateDeletionRequest({collection,docId,nowMs,expiresAtMs:0,projectId});
 return db.runTransaction(async tx=>{
  const snap=await tx.get(ref);
  if(!snap.exists)return Object.freeze({deleted:false,reason:"missing"});
  const expiry=snap.get("expiresAtMs");
  const check=validateDeletionRequest({collection,docId,nowMs,expiresAtMs:expiry,projectId});
  if(!check.eligible)return Object.freeze({deleted:false,reason:"not-expired"});
  tx.delete(ref);
  return Object.freeze({deleted:true,reason:"expired"});
 });
}
module.exports={ALLOWED,validateDeletionRequest,deleteExpiredStagingRecord,POLICY};
