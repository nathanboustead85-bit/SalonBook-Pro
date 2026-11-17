"use strict";
const {spawnSync}=require("node:child_process");
const project="salonbook-pro-ad5ff";
const requested=[
 "cloudfunctions.functions.create",
 "cloudfunctions.functions.update",
 "cloudfunctions.functions.get",
 "cloudfunctions.functions.list",
 "run.services.create",
 "run.services.update",
 "cloudbuild.builds.create",
 "artifactregistry.repositories.uploadArtifacts",
 "iam.serviceAccounts.actAs"
];
function main(){
 if(process.env.BOUSTIO_PERMISSION_APPROVAL!=="CHECK_DEPLOY_PERMISSIONS"||
 process.env.GITHUB_REPOSITORY!=="nathanboustead85-bit/SalonBook-Pro"||
 process.env.GITHUB_REF!=="refs/heads/milestone-customer-booking-experience"){
  console.log("BOUSTIO_PERMISSIONS: GUARD_REJECTED");process.exitCode=1;return;
 }
 const token=spawnSync("gcloud",["auth","print-access-token"],{encoding:"utf8",timeout:30000});
 if(token.status!==0||!token.stdout.trim()){
  console.log("BOUSTIO_PERMISSIONS: ACCESS_TOKEN_UNAVAILABLE");process.exitCode=1;return;
 }
 const endpoint="https://cloudresourcemanager.googleapis.com/v1/projects/"+project+":testIamPermissions";
 const call=spawnSync("curl",["--silent","--show-error","--fail-with-body","--max-time","40","-X","POST",
  "-H","Authorization: Bearer "+token.stdout.trim(),"-H","Content-Type: application/json",
  "--data",JSON.stringify({permissions:requested}),endpoint],{encoding:"utf8",timeout:50000});
 if(call.status!==0){
  console.log("BOUSTIO_PERMISSIONS: PROJECT_PERMISSION_CHECK_FAILED");
  process.exitCode=1;return;
 }
 let data;
 try{data=JSON.parse(call.stdout)}catch{console.log("BOUSTIO_PERMISSIONS: INVALID_RESPONSE");process.exitCode=1;return}
 if(!Array.isArray(data.permissions)){console.log("BOUSTIO_PERMISSIONS: UNEXPECTED_RESPONSE");process.exitCode=1;return}
 const granted=new Set(data.permissions);
 for(const permission of requested){
  console.log("BOUSTIO_PERMISSIONS: "+permission+" "+(granted.has(permission)?"GRANTED_AT_PROJECT":"NOT_CONFIRMED_AT_PROJECT"));
 }
 console.log("BOUSTIO_PERMISSIONS: PROJECT_SCOPE_ONLY_RESOURCE_SPECIFIC_ROLES_AND_DEPLOY_DEPENDENCIES_NOT_VERIFIED");
 console.log("BOUSTIO_PERMISSIONS: NO_IAM_CHANGES_NO_DEPLOYMENT_NO_FIRESTORE_WRITES");
}
if(require.main===module)main();
module.exports={requested};
