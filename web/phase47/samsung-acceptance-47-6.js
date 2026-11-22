"use strict";
// Evidence planning and synthetic checks only; no real Samsung device test or appointment access.
const {createSamsungAcceptance,acceptanceMatrix}=require("../phase46/samsung-acceptance-46-6");
const {createAppointmentRecoveryPreparation}=require("./appointment-recovery-47-5");
const {assessLaunchGaps}=require("../phase46/readiness-gaps-46-1");
const deny=reason=>Object.freeze({status:"PENDING",reason,deviceSignedOff:false,appointmentPreservationVerified:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
const manual=Object.freeze([
 "Verify the two original Android appointments remain unchanged using the existing known-good APK; do not delete or migrate data",
 "Background, force-stop and restart retain calendar and unfinished form safely",
 "Airplane mode denies stale actions; reconnect requires fresh owner and revision verification",
 "Sign-out and account switching clear private data and unfinished sessions",
 "TalkBack labels, focus order, font scaling, contrast and touch targets checked on Samsung",
 "Independent browser and Android owner isolation, revision mismatch and recovery verified"
]);
function createSamsungReadinessPreparation({read,now=Date.now,ownerId,records}={}){
 const samsung=createSamsungAcceptance({read,now});
 const recovery=createAppointmentRecoveryPreparation({ownerId,records});
 if(recovery.status==="BLOCKED")throw TypeError("synthetic_recovery_inventory_required");
 let active=true;
 async function verify({uid,identity,restored,ownerApproval=false}={}){
  if(!active)return deny("stopped");
  if(!identity||identity.uid!==uid||identity.revocationVerified!==true||identity.appCheckVerified!==true||identity.online!==true)return deny("identity_denied");
  const r=recovery.inspect({requestOwnerId:uid,identity,restored,ownerApproval});
  if(r.status!=="SYNTHETIC_RECOVERY_PRECHECK_ONLY")return deny(r.reason||"recovery_denied");
  const s=await samsung.verify({uid,identity});
  if(!active)return deny("stopped");
  if(s.status!=="SYNTHETIC_SAMSUNG_PRECHECK_PASSED")return deny(s.reason||"device_precheck_denied");
  if(assessLaunchGaps().openCount!==7)return deny("launch_gate_changed");
  return Object.freeze({status:"SYNTHETIC_SAMSUNG_READINESS_PRECHECK_ONLY",revision:s.revision,checksum:r.checksum,deviceSignedOff:false,appointmentPreservationVerified:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
 }
 return Object.freeze({verify,offline(){samsung.offline();return deny("offline")},reconnect(){samsung.reconnect();return deny("revalidation_required")},restart(){samsung.signOut();return deny("restart_revalidation_required")},switchAccount(){samsung.switchAccount();return deny("account_switch_revalidation_required")},stop(){active=false;samsung.stop();recovery.stop();return deny("stopped")},matrix:acceptanceMatrix(),manualChecks:manual,deviceSignedOff:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({createSamsungReadinessPreparation,manualSamsungChecks:manual});
