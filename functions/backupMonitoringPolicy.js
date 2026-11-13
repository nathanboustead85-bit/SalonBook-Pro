"use strict";
// Phase 12.35: pure offline monitoring policy, no cloud calls or notifications.
const crypto=require("node:crypto");
const TYPES=Object.freeze(["MISSED_BACKUP","CHECKSUM_FAILURE","UNAUTHORIZED_DELETE","RESTORE_FAILURE"]);
function evaluateBackupHealth(input,nowIso){
 const now=Date.parse(nowIso);
 if(!Number.isFinite(now))throw Error("Invalid evaluation time");
 const alerts=[];
 const i=input&&typeof input==="object"&&!Array.isArray(input)?input:{};
 const last=Date.parse(i.lastSuccessfulBackupAt);
 if(!Number.isFinite(last)||last>now||now-last>24*60*60*1000)
  alerts.push({type:"MISSED_BACKUP",severity:"critical"});
 if(i.checksumVerified!==true)alerts.push({type:"CHECKSUM_FAILURE",severity:"critical"});
 if(i.unauthorizedDeletionAttempt===true)alerts.push({type:"UNAUTHORIZED_DELETE",severity:"critical"});
 if(i.lastRestoreStatus==="failed")alerts.push({type:"RESTORE_FAILURE",severity:"critical"});
 if(!["passed","failed","not-run"].includes(i.lastRestoreStatus))
  alerts.push({type:"RESTORE_FAILURE",severity:"critical"});
 return Object.freeze({status:alerts.length?"ALERT":"HEALTHY",alerts:Object.freeze(alerts.map(a=>Object.freeze(a))),
  productionNotificationSent:false,productionWritesPerformed:false});
}
function fingerprintAlert(alert){
 if(!alert||!TYPES.includes(alert.type))throw Error("Unknown alert");
 return crypto.createHash("sha256").update(alert.type).digest("hex").slice(0,16);
}
function deduplicateAlerts(alerts){
 const seen=new Set();
 return alerts.filter(a=>{const k=fingerprintAlert(a);if(seen.has(k))return false;seen.add(k);return true;});
}
module.exports={TYPES,evaluateBackupHealth,fingerprintAlert,deduplicateAlerts};
