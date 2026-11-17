"use strict";
const {execFileSync}=require("node:child_process");
function line(s){console.log("Phase 17.21: "+s);}
function main(){
 if(process.env.BOUSTIO_PHASE1721_APPROVAL!=="VERIFY_FUNCTION_INVENTORY"||
    process.env.BOUSTIO_FIREBASE_PROJECT_ID!=="salonbook-pro-ad5ff"||
    process.env.GOOGLE_CLOUD_PROJECT!=="salonbook-pro-ad5ff"){
  line("CONFIGURATION_REJECTED");process.exitCode=1;return;
 }
 try{
  const output=execFileSync("gcloud",["functions","list","--project=salonbook-pro-ad5ff","--format=json"],{
   encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:60000,maxBuffer:1024*1024
  });
  const items=JSON.parse(output);
  if(!Array.isArray(items)){line("UNEXPECTED_RESPONSE");process.exitCode=1;return;}
  const names=items.filter(x=>x&&typeof x.name==="string");
  const targets=names.filter(x=>x.name.split("/").pop()==="publishBusiness");
  line("INVENTORY_READ_SUCCESS");
  line("FUNCTIONS_VISIBLE "+names.length);
  line("PUBLISH_BUSINESS "+(targets.length?"FOUND":"NOT_LISTED"));
  for(const item of targets){
   const region=item.name.match(/\/locations\/([^/]+)\/functions\//);
   line("PUBLISH_REGION "+(region&&region[1]==="europe-west2"?"EXPECTED":"OTHER"));
   line("PUBLISH_STATE "+(item.state==="ACTIVE"?"ACTIVE":"NOT_CONFIRMED_ACTIVE"));
   line("PUBLISH_GENERATION "+(item.environment==="GEN_2"?"GEN_2":"OTHER_OR_UNSPECIFIED"));
  }
  line("NO_FUNCTION_INVOCATION; NO_FIRESTORE_WRITES; BOOKINGS_DISABLED");
 }catch(error){
  const stderr=String(error.stderr||"");
  line(/PERMISSION_DENIED|permission denied|403/i.test(stderr)?"INVENTORY_PERMISSION_DENIED":"INVENTORY_CHECK_INCONCLUSIVE");
  line("NO_FUNCTION_INVOCATION; NO_FIRESTORE_WRITES");
  process.exitCode=1;
 }
}
main();
