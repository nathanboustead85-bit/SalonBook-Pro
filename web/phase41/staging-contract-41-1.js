"use strict";
// Planning-only, explicit emulator/staging separation; no SDK initialization or network.
const {auditPhase40}=require("../phase40/final-audit-40-5");
const id=x=>typeof x==="string"&&/^demo-boustio-[a-z0-9-]{3,50}$/.test(x);
const fail=reason=>Object.freeze({status:"NOT_APPROVED",reason,stagingConnected:false,productionReady:false,canDeploy:false,canBook:false,canPay:false,canMessage:false});
function validateStagingEnvironment(env){
 if(!env||env.mode!=="EMULATOR_ONLY"||!id(env.projectId)||env.projectId==="demo-boustio-production"||env.firestoreHost!=="127.0.0.1:18080"||env.authHost!=="127.0.0.1:19099"||env.allowNetwork!==false||env.allowWrites!==false||env.allowDeploy!==false)return fail("environment_not_isolated");
 if(Object.keys(env).sort().join(",")!=="allowDeploy,allowNetwork,allowWrites,authHost,firestoreHost,mode,projectId")return fail("unexpected_environment_configuration");
 return Object.freeze({status:"EMULATOR_CONTRACT_VALID",projectId:env.projectId,stagingConnected:false,productionReady:false,canDeploy:false,canBook:false,canPay:false,canMessage:false});
}
function validateSdkContract(sdk){
 if(!sdk||Object.keys(sdk).sort().join(",")!=="auth,doc,onAuthStateChanged,runTransaction"||!sdk.auth||typeof sdk.doc!=="function"||typeof sdk.runTransaction!=="function"||typeof sdk.onAuthStateChanged!=="function"||typeof sdk.auth.currentUser==="undefined")return fail("invalid_sdk_contract");
 return Object.freeze({status:"INJECTED_SDK_CONTRACT_VALID",stagingConnected:false,productionReady:false,canDeploy:false,canBook:false,canPay:false,canMessage:false});
}
function assessStagingReadiness(env,sdk){
 const a=auditPhase40(),e=validateStagingEnvironment(env),s=validateSdkContract(sdk);
 return Object.freeze({status:a.status==="ISOLATED_AUDIT_CHECKS_PASSED"&&e.status==="EMULATOR_CONTRACT_VALID"&&s.status==="INJECTED_SDK_CONTRACT_VALID"?"ARCHITECTURE_CONTRACTS_VALID":"NOT_APPROVED",phase40Audit:a.status,environment:e.status,sdk:s.status,openBlockers:a.blockers,stagingConnected:false,stagingApproved:false,productionReady:false,migrationApproved:false,canDeploy:false,canBook:false,canPay:false,canMessage:false});
}
module.exports=Object.freeze({validateStagingEnvironment,validateSdkContract,assessStagingReadiness});
