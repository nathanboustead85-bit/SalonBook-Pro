"use strict";
// Phase 27.8: audit actual source schemas, read-only. No live data access.
const fs=require("node:fs"),path=require("node:path");
const ROOT=__dirname;
const SOURCES=Object.freeze(["chatAbuseBudgetAtomic.js","chatTrustedCorrelation.js","chatAbuseBudget.js"]);
function auditChatRetentionSchema(){
 const sources=Object.fromEntries(SOURCES.map(name=>[name,fs.readFileSync(path.join(ROOT,name),"utf8")]));
 const atomic=sources["chatAbuseBudgetAtomic.js"],trusted=sources["chatTrustedCorrelation.js"],legacy=sources["chatAbuseBudget.js"];
 const findings=[];
 if(!atomic.includes('.collection("chatAbuseBudgets")')||!atomic.includes('bucket.collection(kind).doc(id)'))findings.push("ATOMIC_BUDGET_PATH_UNVERIFIED");
 if(!trusted.includes('.collection("chatTrustedCorrelationBudgets")')||!trusted.includes('.collection("signals").doc(correlation)'))findings.push("TRUSTED_BUDGET_PATH_UNVERIFIED");
 if(!legacy.includes('bucket.collection(kind).doc(id)'))findings.push("LEGACY_BUDGET_PATH_UNVERIFIED");
 if(!SOURCES.every(name=>sources[name].includes("expiresAtMs:")))findings.push("NUMERIC_EXPIRY_UNVERIFIED");
 const hasCreationTimestamp=SOURCES.every(name=>sources[name].includes("createdAtMs:"));
 if(!hasCreationTimestamp)findings.push("CREATION_TIMESTAMP_NOT_WRITTEN");
 const hasFirestoreTtlTimestamp=SOURCES.every(name=>sources[name].includes("expiresAt:"));
 if(!hasFirestoreTtlTimestamp)findings.push("FIRESTORE_TIMESTAMP_TTL_FIELD_NOT_WRITTEN");
 findings.push("NESTED_SUBCOLLECTION_TTL_POLICY_REQUIRED");
 findings.push("REAL_FIRESTORE_TTL_POLICY_UNVERIFIED");
 return Object.freeze({
  auditOnly:true,productionMigrationAuthorized:false,
  observedPaths:Object.freeze([
   "chatAbuseBudgets/{bucket}/identity/{uidHash}",
   "chatAbuseBudgets/{bucket}/business/all",
   "chatAbuseBudgets/{bucket}/signal/{signalHash}",
   "chatTrustedCorrelationBudgets/{bucket}/signals/{correlation}"
  ]),
  observedExpiryField:"expiresAtMs",
  creationTimestampWritten:hasCreationTimestamp,
  timestampTtlFieldWritten:hasFirestoreTtlTimestamp,
  migrationCompatible:findings.length===0,
  blockers:Object.freeze(findings)
 });
}
module.exports={auditChatRetentionSchema};
