"use strict";
const fs=require("node:fs");
const path=require("node:path");
const {execFileSync}=require("node:child_process");
const root=path.join(__dirname,"..");
const say=x=>console.log("Phase 17.23: "+x);
function preflight(){
 if(process.env.BOUSTIO_PHASE1723_APPROVAL!=="VERIFY_DEPLOY_PREFLIGHT"||
 process.env.BOUSTIO_FIREBASE_PROJECT_ID!=="salonbook-pro-ad5ff"||
 process.env.GOOGLE_CLOUD_PROJECT!=="salonbook-pro-ad5ff"){
  say("CONFIGURATION_REJECTED");process.exitCode=1;return;
 }
 const cfg=JSON.parse(fs.readFileSync(path.join(root,"firebase.json"),"utf8"));
 const rc=JSON.parse(fs.readFileSync(path.join(root,".firebaserc"),"utf8"));
 const pkg=JSON.parse(fs.readFileSync(path.join(root,"functions/package.json"),"utf8"));
 const src=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
 if(rc.projects.default!=="salonbook-pro-ad5ff"||cfg.functions.source!=="functions"||
 cfg.functions.codebase!=="default"||cfg.functions.runtime!=="nodejs22"||
 pkg.engines.node!=="22"||!src.includes("exports.publishBusiness = onCall(")||
 !src.includes('region: "europe-west2"')){
  say("SOURCE_CONFIGURATION_REJECTED");process.exitCode=1;return;
 }
 say("EXACT_TARGET functions:publishBusiness");
 say("PROJECT salonbook-pro-ad5ff; REGION europe-west2; RUNTIME nodejs22");
 say("DEPLOYMENT_NOT_AUTHORIZED");
 try{
  const output=execFileSync("gcloud",["functions","list","--project=salonbook-pro-ad5ff","--format=json"],{
   encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:60000,maxBuffer:1024*1024
  });
  const items=JSON.parse(output);
  if(!Array.isArray(items)||items.some(x=>!x||typeof x.name!=="string")){
   say("UNEXPECTED_INVENTORY");process.exitCode=1;return;
  }
  const names=items.map(x=>x.name.split("/").pop());
  const publish=names.filter(x=>x==="publishBusiness");
  say("INVENTORY_VISIBLE_COUNT "+names.length);
  say("PUBLISH_BUSINESS "+(publish.length?"ALREADY_LISTED":"NOT_LISTED"));
  say("EXISTING_FUNCTIONS_REVIEW_REQUIRED "+(names.filter(x=>x!=="publishBusiness").length?"YES":"NO"));
  // Report function names for human review, but never expose environment or configuration.
  for(const name of names) say("EXISTING_FUNCTION "+name.replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,80));
  say("NO_DEPLOYMENT; NO_INVOCATION; NO_FIRESTORE_WRITES; BOOKINGS_DISABLED");
 }catch(error){
  const stderr=String(error.stderr||"");
  say(/PERMISSION_DENIED|403/i.test(stderr)?"INVENTORY_PERMISSION_DENIED":"INVENTORY_CHECK_INCONCLUSIVE");
  say("NO_DEPLOYMENT; NO_INVOCATION; NO_FIRESTORE_WRITES");
  process.exitCode=1;
 }
}
preflight();
