"use strict";
// Phase 12.33: backup architecture policy validation only. No cloud APIs.
const REQUIRED=Object.freeze([
 "separateBackupProject","dedicatedBackupBucket","uniformBucketAccess",
 "versioningEnabled","retentionLockReviewed","retentionDays",
 "backupWriterIdentity","restoreReaderIdentity","deletionAdminIdentity",
 "auditLoggingEnabled","encryptionKeyPolicy","recoveryDrillDocumented",
 "alertingConfigured","costBudgetConfigured"
]);
function validateBackupArchitecture(c){
 const issues=[];
 if(!c||typeof c!=="object"||Array.isArray(c))return {status:"NOT_READY",issues:["Missing architecture configuration"],deploymentAuthorized:false};
 for(const key of REQUIRED)if(!(key in c))issues.push("Missing "+key);
 for(const key of ["separateBackupProject","dedicatedBackupBucket","uniformBucketAccess","versioningEnabled","retentionLockReviewed","auditLoggingEnabled","recoveryDrillDocumented","alertingConfigured","costBudgetConfigured"]){
  if(c[key]!==true)issues.push(key+" must be explicitly verified");
 }
 if(!Number.isInteger(c.retentionDays)||c.retentionDays<30||c.retentionDays>3650)issues.push("retentionDays must be 30–3650");
 for(const key of ["backupWriterIdentity","restoreReaderIdentity","deletionAdminIdentity","encryptionKeyPolicy"]){
  if(typeof c[key]!=="string"||c[key].trim().length<6)issues.push("Invalid "+key);
 }
 const identities=[c.backupWriterIdentity,c.restoreReaderIdentity,c.deletionAdminIdentity];
 if(identities.some(x=>typeof x!=="string")||new Set(identities).size!==3)issues.push("Backup, restore and deletion identities must be distinct");
 return {status:issues.length?"NOT_READY":"DESIGN_REVIEW_REQUIRED",issues,deploymentAuthorized:false};
}
module.exports={REQUIRED,validateBackupArchitecture};
