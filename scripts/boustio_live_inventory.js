"use strict";
const {spawnSync}=require("node:child_process");
const PROJECT="salonbook-pro-ad5ff",REGION="europe-west2";
function classify(err){
 const s=String(err||"");
 if(/iam\.serviceAccounts\.getAccessToken|GenerateAccessToken/i.test(s))return "IMPERSONATION_DENIED";
 if(/PERMISSION_DENIED|permission denied|403|not authorized/i.test(s))return "PERMISSION_DENIED";
 if(/API has not been used|SERVICE_DISABLED|accessNotConfigured/i.test(s))return "API_DISABLED_OR_BLOCKED";
 if(/not found|NOT_FOUND|404/i.test(s))return "NOT_FOUND";
 if(/unrecognized arguments|Invalid choice|unknown command/i.test(s))return "CLI_COMMAND_ERROR";
 return "UNCLASSIFIED_ERROR";
}
function execute(args){
 const r=spawnSync("gcloud",args,{encoding:"utf8",timeout:65000,maxBuffer:1024*1024});
 if(r.error||r.status!==0)return {ok:false,reason:classify(r.stderr||r.error?.message)};
 try{return {ok:true,data:JSON.parse(r.stdout)}}catch{return {ok:false,reason:"INVALID_JSON"}}
}
function names(v){
 if(!Array.isArray(v))return null;
 return v.map(x=>String(x.name||x.metadata?.name||"")).filter(Boolean);
}
function main(){
 if(process.env.BOUSTIO_READONLY_APPROVAL!=="CHECK_LIVE_INVENTORY"||
 process.env.GITHUB_REF!=="refs/heads/milestone-customer-booking-experience"||
 process.env.GITHUB_REPOSITORY!=="nathanboustead85-bit/SalonBook-Pro"){
  console.log("BOUSTIO_INVENTORY: GUARD_REJECTED");process.exitCode=1;return;
 }
 const functions=execute(["functions","list","--regions="+REGION,"--project="+PROJECT,"--format=json"]);
 if(!functions.ok)console.log("BOUSTIO_INVENTORY: FUNCTIONS_LIST "+functions.reason);
 else {
  const list=names(functions.data);
  if(!list){console.log("BOUSTIO_INVENTORY: FUNCTIONS_LIST UNEXPECTED_RESPONSE");process.exitCode=1}
  else {
   console.log("BOUSTIO_INVENTORY: FUNCTIONS_LIST SUCCESS");
   for(const id of ["publishBusiness","inspectLegacyBookingMigration"]){
    console.log("BOUSTIO_INVENTORY: "+id+" "+(list.some(n=>n.split("/").pop()===id)?"PRESENT":"NOT_LISTED"));
   }
   console.log("BOUSTIO_INVENTORY: FUNCTION_COUNT "+list.length);
  }
 }
 const run=execute(["run","services","list","--region="+REGION,"--project="+PROJECT,"--format=json"]);
 if(!run.ok)console.log("BOUSTIO_INVENTORY: CLOUD_RUN_LIST "+run.reason);
 else{
  const list=names(run.data);
  console.log("BOUSTIO_INVENTORY: CLOUD_RUN_LIST "+(list?"SUCCESS":"UNEXPECTED_RESPONSE"));
  if(list)console.log("BOUSTIO_INVENTORY: CLOUD_RUN_SERVICE_COUNT "+list.length);
 }
 console.log("BOUSTIO_INVENTORY: DEPLOYMENT_PERMISSIONS NOT_PROVEN_BY_READ_ONLY_LIST");
 console.log("BOUSTIO_INVENTORY: NO_DEPLOYMENT_NO_FUNCTION_INVOCATION_NO_FIRESTORE_WRITES");
}
if(require.main===module)main();
module.exports={classify,names};
