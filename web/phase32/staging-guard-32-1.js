"use strict";
// Phase 32.1: pure validation only. Never initializes an SDK or contacts a project.
const fs=require("node:fs");
const path=require("node:path");
const idPattern=/^[a-z][a-z0-9-]{5,29}$/;
const forbiddenKeys=["GOOGLE_APPLICATION_CREDENTIALS","FIREBASE_TOKEN","GOOGLE_CLOUD_PROJECT","GCLOUD_PROJECT","FIREBASE_CONFIG","FIREBASE_SERVICE_ACCOUNT","FIREBASE_ADMIN_CREDENTIALS"];
const fail=(reason)=>Object.freeze({approved:false,reason,mode:"PREPARATION_ONLY",networkEnabled:false,deployEnabled:false});
function validateStagingConfig(config,repoRoot,env={}){
 if(!config||typeof config!=="object"||Array.isArray(config))return fail("invalid_config");
 if(config.mode!=="PREPARATION_ONLY"||config.networkEnabled!==false||config.deployEnabled!==false||
 config.liveBookings!==false||config.paymentsEnabled!==false||config.messagingEnabled!==false)return fail("unsafe_feature_flags");
 if(typeof config.projectId!=="string"||!idPattern.test(config.projectId)||!config.projectId.startsWith("demo-"))return fail("non_demo_project");
 if(!repoRoot||typeof repoRoot!=="string")return fail("invalid_repository");
 let aliases;
 try{const rc=JSON.parse(fs.readFileSync(path.join(repoRoot,".firebaserc"),"utf8"));aliases=Object.values(rc.projects||{});}catch{return fail("missing_project_aliases");}
 if(aliases.includes(config.projectId))return fail("project_alias_collision");
 if(forbiddenKeys.some(k=>Object.prototype.hasOwnProperty.call(env,k)&&String(env[k]||"").trim()!==""))return fail("credentials_or_live_project_present");
 if(Object.keys(config).some(k=>/secret|token|private.?key|credential|service.?account/i.test(k)))return fail("credential_field_present");
 return Object.freeze({approved:true,reason:"isolated_demo_preparation_only",projectId:config.projectId,mode:"PREPARATION_ONLY",networkEnabled:false,deployEnabled:false});
}
module.exports=Object.freeze({validateStagingConfig});
