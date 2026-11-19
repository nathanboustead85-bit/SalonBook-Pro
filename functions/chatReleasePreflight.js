"use strict";
// Phase 27.1: immutable, fail-closed preflight for a FUTURE controlled launch.
// This module does not enable messaging, configure App Check or trust env declarations.
const {assessChatLaunchReadiness}=require("./chatLaunchReadiness");
const CONTROL_NAMES=Object.freeze(["appCheckVerified","trustedAbuseCorrelationVerified","monitoringVerified","authTransportVerified","storageAttachmentsDisabled","privacyReviewApproved"]);
function evaluateMessagingRelease({environment={},evidence={}}={}){
 const declared=assessChatLaunchReadiness(environment);
 const blockers=[...declared.blockers.map(x=>"configuration:"+x)];
 for(const control of CONTROL_NAMES)if(evidence[control]!==true)blockers.push("evidence:"+control);
 // External attestation and manual approval are always required, and cannot be forged
 // by simply passing true values to this local helper.
 blockers.push("manual:independentSecuritySignoff");
 blockers.push("manual:explicitProductionLaunchApproval");
 return Object.freeze({decision:"BLOCKED",mayEnableMessaging:false,blockers:Object.freeze(blockers)});
}
module.exports={evaluateMessagingRelease,CONTROL_NAMES};
