'use strict';
const fs=require('node:fs');
const path=require('node:path');
const EXPECTED={production:'salonbook-pro-ad5ff',staging:'boustio-staging'};
function inspectConfig(config,environment) {
 if(!Object.hasOwn(EXPECTED,environment))return {ok:false,reason:'UNKNOWN_ENVIRONMENT'};
 if(!config||typeof config!=='object')return {ok:false,reason:'CONFIG_MISSING'};
 const project=config.project_info?.project_id;
 if(project!==EXPECTED[environment])return {ok:false,reason:'PROJECT_MISMATCH'};
 const clients=config.client;
 if(!Array.isArray(clients)||clients.length!==1)return {ok:false,reason:'CLIENT_COUNT_INVALID'};
 const appId=clients[0]?.client_info?.android_client_info?.package_name;
 if(appId!=='com.salonbook.pro')return {ok:false,reason:'PACKAGE_MISMATCH'};
 if(!/^1:\d+:android:[a-zA-Z0-9]+$/.test(clients[0]?.client_info?.mobilesdk_app_id||''))
  return {ok:false,reason:'APP_ID_INVALID'};
 return {ok:true,project,environment};
}
function inspectFile(file,environment) {
 try{return inspectConfig(JSON.parse(fs.readFileSync(file,'utf8')),environment)}
 catch{return {ok:false,reason:'CONFIG_MISSING_OR_INVALID'}}
}
if(require.main===module) {
 const environment=process.argv[2],file=process.argv[3];
 const result=inspectFile(file||'',environment);
 if(!result.ok){console.error('Firebase environment check BLOCKED: '+result.reason);process.exitCode=1}
 else console.log('Firebase environment check OK: '+result.environment+' / '+result.project);
}
module.exports={inspectConfig,inspectFile,EXPECTED};
