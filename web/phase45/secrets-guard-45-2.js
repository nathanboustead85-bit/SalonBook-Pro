"use strict";
// Pure synthetic configuration validator: no filesystem reads, credentials, network or deployment.
const {validateIsolatedEnvironment}=require("./staging-readiness-45-1");
const expected=Object.freeze({mode:"EMULATOR_ONLY",projectId:"demo-boustio-phase45-1",firestoreHost:"127.0.0.1:18080",authHost:"127.0.0.1:19099",allowNetwork:false,allowWrites:false,allowDeploy:false});
const prohibited=/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----|AIza[0-9A-Za-z_-]{35}|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|(?:password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key)\s*[:=]\s*["']?[^\s"',}]{8,}/i;
const blocked=reason=>Object.freeze({status:"BLOCKED",reason,canDeploy:false,canBook:false,canPay:false,canMessage:false,stagingApproved:false});
function validateSafeConfiguration(config,env={}){
 if(!config||typeof config!=="object"||Array.isArray(config)||!env||typeof env!=="object"||Array.isArray(env))return blocked("invalid_input");
 if(Object.getPrototypeOf(config)!==Object.prototype||Object.getPrototypeOf(env)!==Object.prototype)return blocked("unexpected_prototype");
 const keys=Object.keys(expected);
 if(Object.keys(config).length!==keys.length||Object.keys(config).some(k=>!keys.includes(k)))return blocked("configuration_tampering");
 for(const k of keys)if(config[k]!==expected[k])return blocked("configuration_tampering");
 for(const [key,value] of Object.entries(env)){
  if(typeof value!=="string")return blocked("invalid_environment_value");
  if(prohibited.test(key+"="+value))return blocked("credential_material_detected");
  if(/(?:TOKEN|SECRET|PASSWORD|CREDENTIAL|PRIVATE_KEY|API_KEY|SERVICE_ACCOUNT|GOOGLE_CLOUD_PROJECT|FIREBASE_PROJECT_ID|FIREBASE_CONFIG)/i.test(key)&&value!=="")return blocked("credential_environment_rejected");
 }
 const base=validateIsolatedEnvironment(config,env);
 if(base.status!=="ISOLATED_CONFIG_VALID")return blocked(base.reason||"unsafe_environment");
 return Object.freeze({status:"ISOLATED_SECRETS_CHECK_PASSED",canDeploy:false,canBook:false,canPay:false,canMessage:false,stagingApproved:false});
}
function scanSyntheticText(text){
 if(typeof text!=="string"||text.length>1000000)return blocked("invalid_scan_input");
 if(prohibited.test(text))return blocked("credential_material_detected");
 return Object.freeze({status:"NO_KNOWN_SECRET_PATTERN",canDeploy:false,canBook:false,canPay:false,canMessage:false,stagingApproved:false});
}
module.exports=Object.freeze({validateSafeConfiguration,scanSyntheticText,expected});
