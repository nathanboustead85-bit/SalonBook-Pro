"use strict";
// Configuration-only, offline and fail-closed. No Firebase SDK or credential access.
const {reviewPreStaging}=require("../phase46/prestaging-review-46-7");
const deny=reason=>Object.freeze({status:"DENIED",reason,stagingApproved:false,accessGranted:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
function validateStagingBoundary(config,approval){
 if(!config||typeof config!=="object"||Array.isArray(config)||Object.getPrototypeOf(config)!==Object.prototype)return deny("invalid_configuration");
 const keys=Object.keys(config).sort();
 if(JSON.stringify(keys)!==JSON.stringify(["authHost","firestoreHost","projectId"].sort()))return deny("unexpected_configuration_keys");
 if(config.projectId!=="demo-boustio-phase47-1"||config.authHost!=="127.0.0.1:19099"||config.firestoreHost!=="127.0.0.1:18080")return deny("non_isolated_environment");
 if(approval!==undefined&&(!approval||typeof approval!=="object"||approval.ownerApproved!==true))return deny("invalid_approval_evidence");
 const r=reviewPreStaging();
 if(r.openCount!==7||r.risks.some(x=>x.status!=="OPEN"))return deny("launch_gate_changed");
 return Object.freeze({status:"ISOLATED_CONFIGURATION_VALIDATED_NOT_APPROVED",environment:"EMULATOR_ONLY",ownerApprovalRecorded:approval?.ownerApproved===true,independentStagingApprovalRequired:true,openBlockers:7,stagingApproved:false,accessGranted:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
function assertNoCredentialEnvironment(env){
 if(!env||typeof env!=="object")return deny("invalid_environment");
 const forbidden=["GOOGLE_APPLICATION_CREDENTIALS","FIREBASE_SERVICE_ACCOUNT","FIREBASE_TOKEN","GCLOUD_SERVICE_KEY","PRODUCTION_PROJECT_ID","FIREBASE_ADMIN_PRIVATE_KEY"];
 if(forbidden.some(k=>Object.prototype.hasOwnProperty.call(env,k)&&env[k]))return deny("ambient_credential_detected");
 return Object.freeze({status:"NO_EXPLICIT_CREDENTIALS_IN_SUPPLIED_ENVIRONMENT",stagingApproved:false,accessGranted:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({validateStagingBoundary,assertNoCredentialEnvironment});
