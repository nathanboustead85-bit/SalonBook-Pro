"use strict";
// Phase 27.4: isolated privacy-minimised aggregate monitoring.
// No message text, customer identifiers, raw IPs or tokens are accepted or stored.
const METRICS=Object.freeze(["attempts","accepted","rateLimited","authRejected","appCheckRejected","serverErrors"]);
const MAX=1000000;
function validateCounts(counts){
 if(!counts||typeof counts!=="object"||Array.isArray(counts))throw Error("Invalid metrics");
 for(const [key,value] of Object.entries(counts)){
  if(!METRICS.includes(key)||!Number.isSafeInteger(value)||value<0||value>MAX)throw Error("Invalid aggregate metric");
 }
 return Object.fromEntries(METRICS.map(k=>[k,counts[k]||0]));
}
function evaluateChatAbuseMetrics({counts={},windowMinutes=60}={}){
 const safe=validateCounts(counts);
 if(!Number.isInteger(windowMinutes)||windowMinutes<5||windowMinutes>1440)throw Error("Invalid window");
 const alerts=[];
 if(safe.rateLimited>=20&&safe.rateLimited/Math.max(1,safe.attempts)>=0.2)alerts.push("HIGH_RATE_LIMIT_RATIO");
 if(safe.appCheckRejected>=10)alerts.push("APP_CHECK_REJECTION_SPIKE");
 if(safe.authRejected>=20)alerts.push("AUTH_REJECTION_SPIKE");
 if(safe.serverErrors>=5&&safe.serverErrors/Math.max(1,safe.attempts)>=0.05)alerts.push("SERVER_ERROR_RATE");
 if(safe.accepted+safe.rateLimited+safe.authRejected+safe.appCheckRejected+safe.serverErrors>safe.attempts)alerts.push("INCONSISTENT_METRICS");
 return Object.freeze({windowMinutes,counts:Object.freeze(safe),alerts:Object.freeze(alerts),status:alerts.length?"REVIEW_REQUIRED":"NO_ALERT"});
}
module.exports={METRICS,evaluateChatAbuseMetrics};
