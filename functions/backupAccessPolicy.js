"use strict";
// Phase 12.34: pure offline authorization model. Not IAM or Firestore rules.
const ROLES=Object.freeze(["backup-writer","restore-reader","deletion-admin"]);
const ACTIONS=Object.freeze(["create-version","read-version","list-versions","delete-version","request-deletion"]);
const PERMISSIONS=Object.freeze({
 "backup-writer":Object.freeze(["create-version"]),
 "restore-reader":Object.freeze(["read-version","list-versions"]),
 "deletion-admin":Object.freeze(["request-deletion"])
});
function authorize(role,action,context={}){
 const allowed=ROLES.includes(role)&&ACTIONS.includes(action)&&PERMISSIONS[role].includes(action);
 // Even deletion administrator cannot delete a backup: approvals only create
 // an auditable request, with no destructive operation implemented.
 const reason=!allowed?"DENIED_BY_ROLE":"PERMITTED_SIMULATION_ONLY";
 return Object.freeze({allowed,reason,destructiveOperationPerformed:false,
  productionPermissionGranted:false});
}
function deletionRequest(role,versionId,approval){
 const a=authorize(role,"request-deletion");
 if(!a.allowed||typeof versionId!=="string"||!/^[A-Za-z0-9_-]{3,80}$/.test(versionId)||
   !approval||approval.approved!==true||
   typeof approval.reviewer!=="string"||approval.reviewer.trim().length<3||
   typeof approval.ticket!=="string"||approval.ticket.trim().length<6)
  return Object.freeze({status:"DENIED",deleted:false,auditRequired:true});
 return Object.freeze({status:"REVIEW_ONLY",deleted:false,auditRequired:true,
  versionId,approvalTicket:approval.ticket});
}
module.exports={ROLES,ACTIONS,PERMISSIONS,authorize,deletionRequest};
