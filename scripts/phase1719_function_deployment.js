"use strict";
const {execFileSync}=require("node:child_process");
const APPROVED="VERIFY_FUNCTION_DEPLOYMENT";
function report(status){console.log("Phase 17.19: "+status);}
function main(){
 if(process.env.BOUSTIO_PHASE1719_APPROVAL!==APPROVED||
    process.env.BOUSTIO_FIREBASE_PROJECT_ID!=="salonbook-pro-ad5ff"||
    process.env.GOOGLE_CLOUD_PROJECT!=="salonbook-pro-ad5ff"){
  report("CONFIGURATION_REJECTED");process.exitCode=1;return;
 }
 try{
  const output=execFileSync("gcloud",[
   "functions","describe","publishBusiness",
   "--gen2","--region=europe-west2","--project=salonbook-pro-ad5ff",
   "--format=json"
  ],{encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:60000});
  const info=JSON.parse(output);
  const state=info.state;
  const isGen2=info.environment==="GEN_2";
  const region=typeof info.name==="string"&&info.name.includes("/locations/europe-west2/functions/publishBusiness");
  report("FUNCTION "+(region&&isGen2?"FOUND":"CONFIGURATION_MISMATCH"));
  report("DEPLOYMENT_STATE "+(state==="ACTIVE"?"ACTIVE":"NOT_CONFIRMED_ACTIVE"));
  report("GENERATION "+(isGen2?"GEN_2":"UNEXPECTED"));
  report("REGION "+(region?"EXPECTED":"UNEXPECTED"));
  report("NO_FUNCTION_INVOCATION; NO_FIRESTORE_WRITES; BOOKINGS_DISABLED");
  if(!region||!isGen2||state!=="ACTIVE")process.exitCode=1;
 }catch(error){
  const stderr=String(error.stderr||"");
  if(/PERMISSION_DENIED|does not have permission|permission denied|403/i.test(stderr))report("INSUFFICIENT_METADATA_PERMISSIONS");
  else if(/NOT_FOUND|not found|404/i.test(stderr))report("FUNCTION_NOT_FOUND_OR_NOT_VISIBLE");
  else report("DEPLOYMENT_CHECK_INCONCLUSIVE");
  report("NO_FUNCTION_INVOCATION; NO_FIRESTORE_WRITES");
  process.exitCode=1;
 }
}
main();
