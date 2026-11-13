"use strict";
const assert=require("node:assert/strict");
const {REQUIRED,validateBackupArchitecture}=require("../functions/backupArchitecturePolicy");
const valid={
 separateBackupProject:true,dedicatedBackupBucket:true,uniformBucketAccess:true,
 versioningEnabled:true,retentionLockReviewed:true,retentionDays:90,
 backupWriterIdentity:"backup-writer@separate-project.iam.gserviceaccount.com",
 restoreReaderIdentity:"restore-reader@separate-project.iam.gserviceaccount.com",
 deletionAdminIdentity:"deletion-admin@separate-project.iam.gserviceaccount.com",
 auditLoggingEnabled:true,encryptionKeyPolicy:"managed-key-rotation-reviewed",
 recoveryDrillDocumented:true,alertingConfigured:true,costBudgetConfigured:true
};
for(const value of [undefined,null,[],{}]){
 const result=validateBackupArchitecture(value);
 assert.equal(result.status,"NOT_READY");
 assert.equal(result.deploymentAuthorized,false);
}
console.log("PASS missing and malformed architecture fails closed");
for(const key of REQUIRED){
 const config={...valid};delete config[key];
 const result=validateBackupArchitecture(config);
 assert.equal(result.status,"NOT_READY",key);
 assert.equal(result.deploymentAuthorized,false);
}
console.log("PASS all 14 required architecture controls independently enforced");
for(const key of ["separateBackupProject","dedicatedBackupBucket","uniformBucketAccess","versioningEnabled","retentionLockReviewed","auditLoggingEnabled","recoveryDrillDocumented","alertingConfigured","costBudgetConfigured"]){
 const result=validateBackupArchitecture({...valid,[key]:false});
 assert.equal(result.status,"NOT_READY",key);
}
console.log("PASS explicit security and operations confirmations required");
for(const retentionDays of [0,29,3651,90.5,"90",null]){
 assert.equal(validateBackupArchitecture({...valid,retentionDays}).status,"NOT_READY");
}
console.log("PASS invalid retention durations rejected");
assert.equal(validateBackupArchitecture({...valid,restoreReaderIdentity:valid.backupWriterIdentity}).status,"NOT_READY");
assert.equal(validateBackupArchitecture({...valid,deletionAdminIdentity:valid.backupWriterIdentity}).status,"NOT_READY");
console.log("PASS identity separation required");
const reviewed=validateBackupArchitecture(valid);
assert.equal(reviewed.status,"DESIGN_REVIEW_REQUIRED");
assert.equal(reviewed.deploymentAuthorized,false);
assert.deepEqual(reviewed.issues,[]);
console.log("PASS complete architecture still requires independent design review");
