"use strict";
// Phase 27.7: isolated timestamp TTL migration planner. No Firestore writes.
const {POLICY}=require("./chatRetentionReliability");
const COLLECTIONS=Object.freeze({chatMonitoringAggregates:"aggregate",chatAbuseBudgets:"budget",chatTrustedCorrelationBudgets:"budget"});
const MAX_MS=253402300799999;
function planTtlMigration({collection,document,nowMs}={}){
 if(!Object.hasOwn(COLLECTIONS,collection))throw Error("Collection not allowlisted");
 if(!document||typeof document!=="object"||Array.isArray(document))throw Error("Invalid document");
 if(!Number.isSafeInteger(nowMs)||nowMs<0||nowMs>MAX_MS)throw Error("Invalid clock");
 const expiry=document.expiresAtMs;
 if(!Number.isSafeInteger(expiry)||expiry<=0||expiry>MAX_MS)throw Error("Invalid legacy expiry");
 const created=document.createdAtMs;
 if(!Number.isSafeInteger(created)||created<0||created>expiry)throw Error("Missing or invalid creation timestamp");
 const limit=COLLECTIONS[collection]==="aggregate"?POLICY.aggregateRetentionDays*86400000:POLICY.budgetRetentionHours*3600000;
 if(expiry-created>limit)throw Error("Retention exceeds policy");
 if(created>nowMs+POLICY.maxClockSkewMinutes*60000)throw Error("Creation time in future");
 const existing=document.expiresAt;
 if(existing!==undefined&&existing!==null)throw Error("Existing TTL timestamp requires manual review");
 return Object.freeze({collection,field:"expiresAt",expiresAtSeconds:Math.floor(expiry/1000),expiresAtNanoseconds:(expiry%1000)*1000000,expired:expiry<=nowMs,requiresManualReview:false,productionWriteAuthorized:false});
}
module.exports={COLLECTIONS,planTtlMigration};
