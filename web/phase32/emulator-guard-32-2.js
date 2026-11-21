"use strict";
const fs=require("node:fs"),path=require("node:path");
const {validateStagingConfig}=require("./staging-guard-32-1");
const fail=reason=>Object.freeze({approved:false,reason,emulatorStartAllowed:false,deployEnabled:false});
function validateEmulatorEnvironment(config,root,env={}){
 const base=validateStagingConfig(config,root,env);
 if(!base.approved)return fail("staging_"+base.reason);
 if(config.schemaVersion!==1)return fail("schema_version");
 const em=config.emulators;
 if(!em||typeof em!=="object"||Array.isArray(em)||em.uiEnabled!==false||em.singleProjectMode!==true)return fail("emulator_flags");
 const ports=new Set();
 for(const service of ["firestore","auth"]){
  const item=em[service];
  if(!item||item.host!=="127.0.0.1"||!Number.isInteger(item.port)||item.port<1024||item.port>65535||ports.has(item.port))return fail("invalid_"+service+"_endpoint");
  ports.add(item.port);
 }
 if(Object.keys(em).some(k=>!["firestore","auth","uiEnabled","singleProjectMode"].includes(k)))return fail("unapproved_service");
 let firebase,rc;
 try{firebase=JSON.parse(fs.readFileSync(path.join(root,"firebase.json"),"utf8"));rc=JSON.parse(fs.readFileSync(path.join(root,".firebaserc"),"utf8"))}catch{return fail("missing_repository_configuration")}
 if(!firebase.emulators||firebase.emulators.firestore.host!=="127.0.0.1"||firebase.emulators.auth.host!=="127.0.0.1"||firebase.emulators.singleProjectMode!==true)return fail("repository_emulator_isolation");
 if(Object.values(rc.projects||{}).includes(config.projectId))return fail("alias_collision");
 if(env.FIRESTORE_EMULATOR_HOST&&env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:"+em.firestore.port)return fail("firestore_host_override");
 if(env.FIREBASE_AUTH_EMULATOR_HOST&&env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:"+em.auth.port)return fail("auth_host_override");
 if(env.FIREBASE_PROJECT_ID&&env.FIREBASE_PROJECT_ID!==config.projectId)return fail("project_override");
 return Object.freeze({approved:true,reason:"isolated_emulator_configuration_only",projectId:config.projectId,emulatorStartAllowed:false,deployEnabled:false});
}
module.exports=Object.freeze({validateEmulatorEnvironment});
