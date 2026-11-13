"use strict";
/**
 * Phase 12.30: offline release-readiness policy. This module is intentionally
 * incapable of deploying, migrating or enabling bookings.
 */
const REQUIRED=Object.freeze([
 "verifiedOwnerConsent",
 "immutableBackupStored",
 "backupChecksumVerified",
 "restoreDrillPassed",
 "productionRulesReviewed",
 "migrationTransactionReviewed",
 "concurrentWritesProtected",
 "rollbackRunbookApproved",
 "monitoringAndAlertsReady",
 "releaseApprovalRecorded"
]);
function assessReadiness(evidence){
 const checks=evidence && typeof evidence==="object" && !Array.isArray(evidence)?evidence:{};
 const results=REQUIRED.map(key=>{
  const entry=checks[key];
  const valid=entry && typeof entry==="object" &&
    entry.passed===true &&
    typeof entry.evidenceId==="string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:/-]{5,199}$/.test(entry.evidenceId) &&
    typeof entry.reviewedBy==="string" && entry.reviewedBy.trim().length>1 &&
    typeof entry.reviewedAt==="string" &&
    !Number.isNaN(Date.parse(entry.reviewedAt)) &&
    new Date(entry.reviewedAt).toISOString()===entry.reviewedAt;
  return {key,passed:!!valid};
 });
 return Object.freeze({
  status:results.every(x=>x.passed)?"REVIEW_REQUIRED":"NOT_READY",
  checks:results,
  missing:results.filter(x=>!x.passed).map(x=>x.key),
  migrationPerformed:false,
  liveBookingsEnabled:false,
  deploymentAuthorized:false,
  // Even full evidence requires separate human review and release authorization.
  safeToMigrateAutomatically:false
 });
}
module.exports={REQUIRED,assessReadiness};
