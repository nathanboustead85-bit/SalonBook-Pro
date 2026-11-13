"use strict";
const assert=require("node:assert/strict");
const {TYPES}=require("../functions/backupMonitoringPolicy");
const {planIncident,closeIncident}=require("../functions/backupIncidentResponse");
const base={incidentId:"INC-1236-001",type:"MISSED_BACKUP"};
for(const type of TYPES){
 const p=planIncident({...base,type});
 assert.equal(p.status,"ESCALATION_REQUIRED");
 assert.equal(p.priority,"P1");
 assert.equal(p.productionRestoreAuthorized,false);
 assert.equal(p.productionMigrationAuthorized,false);
 assert.equal(p.destructiveActionPerformed,false);
 assert.equal(p.notificationSent,false);
 assert(p.steps.some(s=>s.includes("Escalate")));
}
console.log("PASS all four backup incident types escalate without production actions");
for(const data of [undefined,{}, {...base,incidentId:""}, {...base,type:"UNKNOWN"}, {...base,incidentId:"../bad"}]){
 const p=planIncident(data);
 assert.equal(p.status,"INVALID_INCIDENT");
 assert.equal(p.productionRestoreAuthorized,false);
}
console.log("PASS missing or malformed incidents fail closed");
const incomplete=planIncident({...base,backupVerified:true,restoreDrillPassed:true,independentApproval:true});
assert.equal(incomplete.evidenceReady,false);
console.log("PASS missing owner notification blocks recovery evidence readiness");
const ready=planIncident({...base,backupVerified:true,restoreDrillPassed:true,
 independentApproval:true,ownerNotified:true});
assert.equal(ready.evidenceReady,true);
assert.equal(ready.productionRestoreAuthorized,false);
assert.equal(ready.productionMigrationAuthorized,false);
console.log("PASS complete evidence never authorizes production restore");
const blocked=closeIncident({incidentId:base.incidentId,rootCauseDocumented:true,
 ownerAcknowledged:true,independentReviewComplete:false,followUpTicket:"OPS-1236"});
assert.equal(blocked.status,"CLOSURE_BLOCKED");
console.log("PASS incident closure requires independent review");
const closure=closeIncident({incidentId:base.incidentId,rootCauseDocumented:true,
 ownerAcknowledged:true,independentReviewComplete:true,followUpTicket:"OPS-1236"});
assert.equal(closure.status,"CLOSURE_REVIEW_REQUIRED");
assert.equal(closure.closedAutomatically,false);
console.log("PASS complete closure evidence still requires manual review");
assert.equal(Object.isFrozen(ready),true);
assert.equal(Object.isFrozen(ready.steps),true);
console.log("PASS response plan immutable");
