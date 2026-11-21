"use strict";
// Phase 34.5: offline integration audit. No SDK, network, credentials or writes.
const {paths}=require("./android-firestore-map-34-2");
const {validateDocumentFreshness}=require("./document-freshness-34-3");
const recovery=require("./recovery-34-4");
const BLOCKERS=Object.freeze([
 "PHASE34_1_PROVISIONAL_PATH_AND_REVISION",
 "CONSISTENT_READ_ATTESTATION_NOT_PROVEN",
 "FIRESTORE_EMULATOR_RULES_NOT_VERIFIED_IN_PHASE34",
 "TRUSTED_AUTH_AND_SERVER_AUTHORIZATION_NOT_CONNECTED",
 "STAFF_SCHEDULE_AND_BUSINESS_HOURS_NOT_COMPLETE",
 "RETRY_CANCELLATION_AND_STALE_CALLBACK_COORDINATION",
 "FRESHNESS_THRESHOLDS_REQUIRE_PRODUCT_REVIEW"
]);
const deny=reason=>Object.freeze({status:"UNAVAILABLE",reason,bookingEnabled:false,editingEnabled:false,data:null});
function auditOfflineDashboard(auth,documents,now,options){
 const result=validateDocumentFreshness(auth,documents,now,options);
 if(result.status!=="FRESH_ANDROID_READ_ONLY")return deny(result.reason);
 return Object.freeze({status:"OFFLINE_AUDIT_ONLY",bookingEnabled:false,editingEnabled:false,
  data:result.data,productionApproved:false,blockers:BLOCKERS,sourcePaths:paths(auth.uid)});
}
function auditRecoverySequence(auth,documents,now){
 let s=recovery.begin(recovery.initial(),auth,"audit_request",now);
 if(s.status!=="LOADING")return deny("session_rejected");
 s=recovery.receive(s,auth,"audit_request",s.epoch,documents,now,{consistentRead:true});
 if(s.status!=="READ_ONLY_READY")return deny("mapping_or_freshness_failed");
 const ready=s;
 const refreshed=recovery.begin(ready,auth,"audit_refresh",now);
 if(refreshed.data!==null)return deny("refresh_retained_private_data");
 const rejected=recovery.fail(refreshed,"audit_refresh",refreshed.epoch,"permission-denied",now);
 if(rejected.data!==null||rejected.nextRetryAt!==null)return deny("permission_failure_not_closed");
 return Object.freeze({status:"OFFLINE_RECOVERY_AUDITED",bookingEnabled:false,editingEnabled:false,productionApproved:false,blockers:BLOCKERS});
}
module.exports=Object.freeze({auditOfflineDashboard,auditRecoverySequence,BLOCKERS});
