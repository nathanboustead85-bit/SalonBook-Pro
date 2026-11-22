"use strict";
// Offline inventory of staging requirements only. Never authenticates, connects or grants approval.
const {auditPhase47}=require("../phase47/final-audit-47-7");
const {assertNoCredentialEnvironment}=require("../phase47/staging-boundary-47-1");
const required=Object.freeze([
 Object.freeze({id:"environment",requirement:"Dedicated staging project identity and ownership independently confirmed",gate:"STAGING_APPROVAL"}),
 Object.freeze({id:"credentials",requirement:"Least-privilege staging credentials reviewed without placing secrets in code or CI",gate:"SECURITY_REVIEW"}),
 Object.freeze({id:"backend",requirement:"Independent real Admin revocation and owner authorization validation",gate:"SECURITY_REVIEW"}),
 Object.freeze({id:"appcheck",requirement:"Real attestation, approved app identity and atomic distributed replay validation",gate:"SECURITY_REVIEW"}),
 Object.freeze({id:"devices",requirement:"Independent browser/Android owner isolation and revision consistency evidence",gate:"STAGING_APPROVAL"}),
 Object.freeze({id:"appointments",requirement:"Non-destructive backup, restore, rollback and explicit owner approval for two original appointments",gate:"OWNER_APPROVAL"}),
 Object.freeze({id:"samsung",requirement:"Physical Samsung accessibility, offline, restart and account-switch sign-off",gate:"DEVICE_SIGNOFF"}),
 Object.freeze({id:"operations",requirement:"Privacy, monitoring, incident response and release authorization",gate:"RELEASE_APPROVAL"}),
 Object.freeze({id:"independent",requirement:"Independent security and concurrency assessment in approved environment",gate:"INDEPENDENT_REVIEW"})
]);
const disabled=Object.freeze({accessGranted:false,credentialsApproved:false,stagingApproved:false,productionReady:false,appointmentsMigrationApproved:false,deviceSignedOff:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
const deny=reason=>Object.freeze({status:"DENIED",reason,...disabled});
function prepareStagingReadiness({environment={},inventory={},approvalEvidence={}}={}){
 if(assertNoCredentialEnvironment(environment).status!=="NO_EXPLICIT_CREDENTIALS_IN_SUPPLIED_ENVIRONMENT")return deny("credential_boundary");
 if(!inventory||typeof inventory!=="object"||Array.isArray(inventory)||Object.keys(inventory).some(k=>!["projectId","authHost","firestoreHost","purpose"].includes(k)))return deny("inventory_invalid");
 if(!approvalEvidence||typeof approvalEvidence!=="object"||Array.isArray(approvalEvidence))return deny("approval_evidence_invalid");
 // Only local emulator fixtures are permitted. Real staging IDs, hosts and credentials are rejected.
 if(Object.keys(inventory).length&&
 (inventory.projectId!=="demo-boustio-phase48-1"||inventory.authHost!=="127.0.0.1:19099"||inventory.firestoreHost!=="127.0.0.1:18080"||inventory.purpose!=="synthetic-read-only"))return deny("non_isolated_environment");
 const audit=auditPhase47({environment});
 if(audit.status!=="PHASE47_ISOLATED_AUDIT_PREPARED_NOT_APPROVED"||audit.openCount!==7||audit.blockers.some(b=>b.status!=="OPEN"||b.approved!==false))return deny("launch_gate_changed");
 const approvals=Object.freeze(required.map(r=>Object.freeze({...r,status:"NOT_VERIFIED",approved:false,independentEvidenceRequired:true})));
 return Object.freeze({status:"STAGING_READINESS_INVENTORY_ONLY_NOT_APPROVED",environment:"EMULATOR_ONLY",inventoryRecorded:Object.keys(inventory).length===4,approvalClaimsRecorded:Object.keys(approvalEvidence).length>0,requirements:approvals,requirementCount:approvals.length,blockers:audit.blockers,openCount:7,originalAppointments:"NOT_ACCESSED_OR_VERIFIED",...disabled});
}
module.exports=Object.freeze({prepareStagingReadiness,required});
