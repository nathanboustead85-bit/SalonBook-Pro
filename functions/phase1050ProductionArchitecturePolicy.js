"use strict";
/** Phase 10.50: proposed architecture policy. Design only, no IAM mutations. */
const POLICY=Object.freeze({
 productionWriteAllowed:false,
 emulatorProject:"demo-boustio-legacy-init",
 productionProject:"salonbook-pro-ad5ff",
 roles:Object.freeze({
  ownerClient:Object.freeze({firestoreAdmin:false,sign:false,auditAppend:false}),
  approvalIssuer:Object.freeze({firestoreAdmin:false,sign:false,auditAppend:true}),
  approvalConsumer:Object.freeze({firestoreAdmin:false,sign:false,auditAppend:true}),
  independentAuditor:Object.freeze({firestoreAdmin:false,sign:false,auditAppend:false}),
  signingOperator:Object.freeze({firestoreAdmin:false,sign:true,auditAppend:false})
 }),
 issuanceWrites:Object.freeze([
  "businesses/{businessId}/legacyModeApprovals/{approvalId}",
  "businesses/{businessId}/legacyModeApprovalAudit/{approvalId}",
  "businesses/{businessId}/legacyModeAuditAnchors/{approvalId}",
  "legacyModeOperatorNonces/{nonceHash}"
 ]),
 consumptionWrites:Object.freeze([
  "businesses/{businessId}/legacyModeApprovals/{approvalId}",
  "businesses/{businessId}/settings/bookingMode"
 ]),
 prohibitedWrites:Object.freeze([
  "users/{uid}/liveData/bookings",
  "businesses/{businessId}/appointments/{appointmentId}",
  "businesses/{businessId}/bookingLocks/{lockId}",
  "businesses/{businessId}/migrations/android-bookings-v1"
 ]),
 independentAudit:Object.freeze({
  required:true,configured:false,
  separateAdministrativeBoundary:true,
  appendOnly:true,
  retentionAndLegalHoldRequired:true,
  failClosedOnUnavailable:true
 }),
 keyCustody:Object.freeze({
  required:true,configured:false,
  privateKeyInRepository:false,
  privateKeyInGitHubActions:false,
  publicKeyRegistryTrustedBootstrapRequired:true,
  rotationRevocationAndRecoveryRequired:true
 })
});
function evaluateReadiness(p=POLICY){
 const blockers=[];
 if(p.productionWriteAllowed!==false)blockers.push("production write gate");
 if(p.independentAudit.configured!==true)blockers.push("independent audit not configured");
 if(p.keyCustody.configured!==true)blockers.push("key custody not configured");
 if(Object.values(p.roles).some(r=>r.firestoreAdmin||r.sign&&r.auditAppend))
  blockers.push("privilege separation violation");
 if(p.prohibitedWrites.some(x=>p.issuanceWrites.includes(x)||p.consumptionWrites.includes(x)))
  blockers.push("protected bookings write scope");
 return Object.freeze({approved:false,productionWriteAllowed:false,blockers:Object.freeze(blockers)});
}
module.exports={POLICY,evaluateReadiness};
