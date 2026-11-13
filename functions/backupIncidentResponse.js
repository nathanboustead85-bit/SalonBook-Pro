"use strict";
// Phase 12.36: offline incident-response policy. No cloud operations.
const {TYPES}=require("./backupMonitoringPolicy");
const PRIORITY=Object.freeze({
 MISSED_BACKUP:"P1",CHECKSUM_FAILURE:"P1",
 UNAUTHORIZED_DELETE:"P1",RESTORE_FAILURE:"P1"
});
function planIncident({incidentId,type,backupVerified=false,restoreDrillPassed=false,
 independentApproval=false,ownerNotified=false}={}){
 const validId=typeof incidentId==="string"&&/^[A-Za-z0-9][A-Za-z0-9._-]{5,79}$/.test(incidentId);
 const validType=TYPES.includes(type);
 const valid=validId&&validType;
 const steps=valid?[
  "Record incident and preserve audit evidence",
  "Escalate to on-call owner and security reviewer",
  "Freeze automated migration and destructive recovery actions",
  "Verify backup integrity and select isolated restore environment",
  "Rehearse restore and reconcile appointment IDs, locks and counts",
  "Require independent approval before any production action"
 ]:["Reject invalid incident and require manual triage"];
 return Object.freeze({
  status:valid?"ESCALATION_REQUIRED":"INVALID_INCIDENT",
  priority:valid?PRIORITY[type]:null,
  steps:Object.freeze(steps),
  evidenceReady:valid&&backupVerified===true&&restoreDrillPassed===true&&
   independentApproval===true&&ownerNotified===true,
  productionRestoreAuthorized:false,
  productionMigrationAuthorized:false,
  destructiveActionPerformed:false,
  notificationSent:false
 });
}
function closeIncident({incidentId,rootCauseDocumented=false,ownerAcknowledged=false,
 independentReviewComplete=false,followUpTicket}={}){
 const accepted=typeof incidentId==="string"&&/^[A-Za-z0-9][A-Za-z0-9._-]{5,79}$/.test(incidentId)&&
 rootCauseDocumented===true&&ownerAcknowledged===true&&independentReviewComplete===true&&
 typeof followUpTicket==="string"&&followUpTicket.trim().length>=6;
 return Object.freeze({status:accepted?"CLOSURE_REVIEW_REQUIRED":"CLOSURE_BLOCKED",
  closedAutomatically:false,productionChangesPerformed:false});
}
module.exports={PRIORITY,planIncident,closeIncident};
