"use strict";
const {execFileSync}=require("node:child_process");
const allowed=["functions","describe","publishBusiness","--gen2","--region=europe-west2","--project=salonbook-pro-ad5ff","--format=json"];
function classify(stderr){
 if(/PERMISSION_DENIED|does not have permission|permission denied|403/i.test(stderr))return "METADATA_PERMISSION_DENIED";
 if(/NOT_FOUND|not found|404/i.test(stderr))return "FUNCTION_NOT_FOUND_OR_NOT_VISIBLE";
 return "METADATA_CHECK_INCONCLUSIVE";
}
function main(){
 if(process.env.BOUSTIO_PHASE1728_APPROVAL!=="CHECK_DEPLOYMENT_PERMISSIONS"||
 process.env.GITHUB_REF!=="refs/heads/milestone-customer-booking-experience"||
 process.env.GITHUB_REPOSITORY!=="nathanboustead85-bit/SalonBook-Pro"){
  console.log("Phase 17.28: CONFIGURATION_REJECTED");process.exitCode=1;return;
 }
 try{
  const raw=execFileSync("gcloud",allowed,{encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:60000});
  const info=JSON.parse(raw);
  const expected=typeof info.name==="string"&&info.name.endsWith("/locations/europe-west2/functions/publishBusiness");
  console.log("Phase 17.28: METADATA_READ_SUCCEEDED");
  console.log("Phase 17.28: FUNCTION "+(expected?"MATCHES_TARGET":"UNEXPECTED_TARGET"));
  console.log("Phase 17.28: FUNCTION_STATE "+(info.state==="ACTIVE"?"ACTIVE":"NOT_CONFIRMED_ACTIVE"));
  if(!expected)process.exitCode=1;
 }catch(error){
  console.log("Phase 17.28: "+classify(String(error.stderr||"")));
 }
 console.log("Phase 17.28: DEPLOYMENT_WRITE_PERMISSIONS_NOT_TESTED");
 console.log("Phase 17.28: NO_DEPLOYMENT_NO_FUNCTION_INVOCATION_NO_FIRESTORE_WRITES");
}
if(require.main===module)main();
module.exports={classify,allowed};
