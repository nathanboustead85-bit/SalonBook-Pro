"use strict";
// Phase 27.5: offline retention and reliability policy; no Firestore mutations.
const HOUR=3600000,DAY=24*HOUR;
const POLICY=Object.freeze({aggregateRetentionDays:14,budgetRetentionHours:48,maxClockSkewMinutes:5});
function assessRetentionRecord({kind,createdAtMs,expiresAtMs,nowMs}={}){
 if(!["aggregate","budget"].includes(kind))throw Error("Unknown record type");
 for(const n of [createdAtMs,expiresAtMs,nowMs])if(!Number.isSafeInteger(n)||n<0)throw Error("Invalid timestamp");
 if(createdAtMs>nowMs+POLICY.maxClockSkewMinutes*60000)throw Error("Clock skew exceeds policy");
 const duration=kind==="aggregate"?POLICY.aggregateRetentionDays*DAY:POLICY.budgetRetentionHours*HOUR;
 if(expiresAtMs<=createdAtMs||expiresAtMs>createdAtMs+duration)throw Error("Retention exceeds policy");
 return Object.freeze({kind,expired:nowMs>=expiresAtMs,requiresDeletion:nowMs>=expiresAtMs,ttlConfigured:false});
}
function assessMonitoringReliability({metricsFreshnessMinutes,deliveryHealthy,retentionVerified,ttlPolicyVerified}={}){
 const blockers=[];
 if(!Number.isFinite(metricsFreshnessMinutes)||metricsFreshnessMinutes<0||metricsFreshnessMinutes>15)blockers.push("METRICS_STALE_OR_UNAVAILABLE");
 if(deliveryHealthy!==true)blockers.push("ALERT_DELIVERY_UNVERIFIED");
 if(retentionVerified!==true)blockers.push("RETENTION_UNVERIFIED");
 if(ttlPolicyVerified!==true)blockers.push("FIRESTORE_TTL_UNVERIFIED");
 // This is an isolated assessment, never a production launch authorization.
 return Object.freeze({monitoringReady:blockers.length===0,launchApproved:false,blockers:Object.freeze(blockers)});
}
module.exports={POLICY,assessRetentionRecord,assessMonitoringReliability};
