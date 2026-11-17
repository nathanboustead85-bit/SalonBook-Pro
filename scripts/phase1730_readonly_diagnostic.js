"use strict";
const {execFileSync}=require("node:child_process");
const TARGET="projects/salonbook-pro-ad5ff/locations/europe-west2/functions/publishBusiness";
const checks=[
 {name:"CLOUD_FUNCTIONS_V2",args:["functions","describe","publishBusiness","--gen2","--region=europe-west2","--project=salonbook-pro-ad5ff","--format=json"]},
 {name:"CLOUD_RUN_SERVICE",args:["run","services","describe","publishbusiness","--region=europe-west2","--project=salonbook-pro-ad5ff","--format=json"]},
 {name:"CLOUD_RUN_SERVICES_LIST",args:["run","services","list","--region=europe-west2","--project=salonbook-pro-ad5ff","--format=json"]}
];
function classify(message){
 const s=String(message||"");
 if(/invalid choice|unrecognized arguments|invalid command|unknown command|usage: gcloud/i.test(s))return "GCLOUD_COMMAND_ERROR";
 if(/INVALID_ARGUMENT|invalid argument|400 Bad Request/i.test(s))return "INVALID_REQUEST";
 if(/UNAUTHENTICATED|401 Unauthorized|invalid_grant/i.test(s))return "AUTHENTICATION_ERROR";
 if(/iam\.serviceAccounts\.getAccessToken|iamcredentials\.googleapis\.com|GenerateAccessToken/i.test(s))return "IDENTITY_TOKEN_IMPERSONATION_DENIED";
 if(/cloudfunctions\.functions\.get/i.test(s))return "CLOUD_FUNCTIONS_GET_PERMISSION_DENIED";
 if(/run\.services\.get/i.test(s))return "CLOUD_RUN_GET_PERMISSION_DENIED";
 if(/SERVICE_DISABLED|API has not been used|API.*disabled|accessNotConfigured/i.test(s))return "API_NOT_ENABLED_OR_ACCESS_BLOCKED";
 if(/PERMISSION_DENIED|does not have permission|permission denied|403|not authorized/i.test(s))return "ACCESS_DENIED_UNSPECIFIED";
 if(/NOT_FOUND|not found|404/i.test(s))return "RESOURCE_NOT_FOUND_OR_NOT_VISIBLE";
 return "OTHER_ERROR";
}
function extractPermissions(message){
 return [...new Set(String(message||"").match(/(?:cloudfunctions\.functions\.get|run\.services\.get|iam\.serviceAccounts\.getAccessToken)/g)||[])];
}
function main(){
 if(process.env.BOUSTIO_PHASE1730_APPROVAL!=="DIAGNOSE_READONLY_ACCESS"||
 process.env.GITHUB_REF!=="refs/heads/milestone-customer-booking-experience"||
 process.env.GITHUB_REPOSITORY!=="nathanboustead85-bit/SalonBook-Pro"){
  console.log("Phase 17.30: CONFIGURATION_REJECTED");process.exitCode=1;return;
 }
 for(const check of checks){
  try{
   const raw=execFileSync("gcloud",check.args,{encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:60000});
   const data=JSON.parse(raw);
   const target=check.name==="CLOUD_FUNCTIONS_V2"?data.name===TARGET:check.name==="CLOUD_RUN_SERVICES_LIST"?Array.isArray(data):typeof data.metadata?.name==="string"||typeof data.name==="string";
   console.log("Phase 17.30: "+check.name+" "+(target?"READ_SUCCEEDED":"RESPONSE_UNEXPECTED"));
   if(check.name==="CLOUD_RUN_SERVICES_LIST"&&target){
    const names=data.map(x=>String(x.metadata?.name||x.name||"").split("/").pop());
    console.log("Phase 17.30: CLOUD_RUN_TARGET_PRESENT "+(names.includes("publishbusiness")?"YES":"NO"));
   }
   if(check.name==="CLOUD_FUNCTIONS_V2"&&target)console.log("Phase 17.30: FUNCTION_STATE "+(data.state==="ACTIVE"?"ACTIVE":"NOT_CONFIRMED_ACTIVE"));
  }catch(error){
   const stderr=String(error.stderr||"")+" "+String(error.message||"");
   console.log("Phase 17.30: "+check.name+" "+classify(stderr));
   const permissions=extractPermissions(stderr);
   if(permissions.length)console.log("Phase 17.30: MENTIONED_PERMISSION "+permissions.join(","));
   // Never print raw CLI errors: they can contain identities or credential details.
  }
 }
 console.log("Phase 17.30: READ_ONLY_DIAGNOSTIC_COMPLETE");
 console.log("Phase 17.30: NO_DEPLOYMENT_NO_FUNCTION_INVOCATION_NO_FIRESTORE_WRITES");
}
if(require.main===module)main();
module.exports={classify,extractPermissions,checks,TARGET};
