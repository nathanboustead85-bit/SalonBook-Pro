"use strict";
// Pure validation; no SDK initialization, network, filesystem writes, or deployment.
const {auditPhase44}=require("../phase44/final-audit-44-5");
const denied=reason=>Object.freeze({status:"BLOCKED",reason,stagingApproved:false,productionReady:false,canDeploy:false,canBook:false,canPay:false,canMessage:false});
function validateIsolatedEnvironment(config,env={}){
 if(!config||typeof config!=="object")return denied("missing_configuration");
 const expected="demo-boustio-phase45-1";
 if(config.mode!=="EMULATOR_ONLY"||config.projectId!==expected||!config.projectId.startsWith("demo-"))return denied("non_isolated_project");
 if(config.firestoreHost!=="127.0.0.1:18080"||config.authHost!=="127.0.0.1:19099")return denied("non_local_emulator");
 if(config.allowNetwork!==false||config.allowWrites!==false||config.allowDeploy!==false)return denied("unsafe_capability");
 for(const key of ["GOOGLE_APPLICATION_CREDENTIALS","GOOGLE_CLOUD_PROJECT","FIREBASE_CONFIG","FIREBASE_TOKEN","GCLOUD_PROJECT","FIREBASE_PROJECT_ID"]){
  if(env[key]!==undefined&&env[key]!==""&&!(key==="GCLOUD_PROJECT"&&env[key]===expected))return denied("ambient_cloud_configuration:"+key);
 }
 if(env.FIRESTORE_EMULATOR_HOST!==undefined&&env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:18080")return denied("emulator_host_mismatch");
 if(env.FIREBASE_AUTH_EMULATOR_HOST!==undefined&&env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:19099")return denied("auth_emulator_host_mismatch");
 return Object.freeze({status:"ISOLATED_CONFIG_VALID",projectId:expected,stagingApproved:false,productionReady:false,canDeploy:false,canBook:false,canPay:false,canMessage:false});
}
function stagingReadiness(config,env={}){
 const environment=validateIsolatedEnvironment(config,env),audit=auditPhase44();
 return Object.freeze({status:environment.status==="ISOLATED_CONFIG_VALID"&&audit.status==="ISOLATED_AUDIT_CHECKS_PASSED"?"PREPARATION_ONLY":"BLOCKED",environment,auditStatus:audit.status,blockers:audit.blockers,rollback:Object.freeze({approved:false,originalAndroidAppointmentsProtected:true,requiresVerifiedBackup:true,requiresRestoreDrill:true,requiresOwnerApproval:true,requiresProductionChangeReview:true}),stagingApproved:false,productionReady:false,canDeploy:false,canBook:false,canPay:false,canMessage:false});
}
module.exports=Object.freeze({validateIsolatedEnvironment,stagingReadiness});
